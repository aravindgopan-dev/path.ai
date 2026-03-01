"""Roadmap router — POST /roadmap with level-based structure and DB persistence."""

from __future__ import annotations

import uuid
import asyncio
import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.graph import roadmap_graph
from app.db.database import get_db
from app.db.models import Project, RoadmapNodeModel
from app.agents.expected_spec_agent import generate_expected_spec
from app.agents.file_tree_agent import generate_file_tree
from app.agents.documentation_agent import generate_documentation

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helper: flatten level-based structure to ordered node list ──

_TYPE_MAP = {"code": "coding", "learn": "learning", "setup": "setup"}

def flatten_levels_to_nodes(
    levels: list[dict],
    db_nodes_by_id: dict | None = None,
) -> list[dict]:
    """Convert level-grouped roadmap into a flat ordered node array.

    Each node gets:
      - order_index  (global position)
      - type mapped to old UI types: setup | learning | coding | milestone
      - dependencies preserved
      - completed preserved
      - locked   — True when any dependency node is not yet completed
      - files    — expected_files from the expected_spec (coding) or empty
      - validationCriteria — validation_rules from expected_spec or empty
    """
    # Pre-compute completed set from level data for lock resolution
    completed_ids: set[str] = set()
    for level_data in levels:
        for node in level_data.get("nodes", []):
            if node.get("completed", False):
                completed_ids.add(node.get("id", ""))

    flat: list[dict] = []
    idx = 0
    for level_data in levels:
        level_unlocked = level_data.get("unlocked", True)
        for node in level_data.get("nodes", []):
            raw_type = node.get("type", "code")
            node_id = node.get("id")
            deps = node.get("dependencies", [])

            # A node is locked if it has unmet dependencies OR its level is locked
            locked = (not level_unlocked) or any(
                d not in completed_ids for d in deps
            )

            # Pull files + validation from DB model if available
            files: list[str] = []
            validation_criteria: list[str] = []
            if db_nodes_by_id and node_id in db_nodes_by_id:
                db_node = db_nodes_by_id[node_id]
                spec = db_node.get_expected_spec()
                if spec:
                    files = spec.get("expected_files", [])
                    rules = spec.get("validation_rules", [])
                    validation_criteria = [
                        r if isinstance(r, str) else r.get("contains", str(r))
                        for r in rules
                    ]

            flat.append({
                "id": node_id,
                "title": node.get("title", ""),
                "type": _TYPE_MAP.get(raw_type, raw_type),
                "description": node.get("description", ""),
                "dependencies": deps,
                "order_index": idx,
                "completed": node.get("completed", False),
                "locked": locked,
                "files": files,
                "validationCriteria": validation_criteria,
            })
            idx += 1
    return flat


class RoadmapRequest(BaseModel):
    blueprint: dict
    user_level: str
    suggested_skills: list


@router.post("/roadmap")
async def generate_roadmap(body: RoadmapRequest, db: Session = Depends(get_db)):
    """Generate level-based roadmap, persist to DB, and return."""
    if not body.blueprint:
        raise HTTPException(status_code=400, detail="blueprint must not be empty")
    if body.user_level not in ("beginner", "intermediate", "pro"):
        raise HTTPException(status_code=400, detail="user_level must be beginner, intermediate, or pro")

    result = await roadmap_graph.ainvoke(
        {
            "blueprint": body.blueprint,
            "user_level": body.user_level,
            "suggested_skills": body.suggested_skills,
        }
    )

    levels: list[dict] = result.get("roadmap", [])

    # ── Persist project + nodes ───────────────────
    project_id = body.blueprint.get("project_id") or str(uuid.uuid4())
    project_name = body.blueprint.get("name", "Untitled")

    # Upsert project
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        project.set_blueprint(body.blueprint)
    else:
        project = Project(id=project_id, name=project_name)
        project.set_blueprint(body.blueprint)
        db.add(project)
    db.flush()

    # Remove old nodes for this project (re-generation scenario)
    db.query(RoadmapNodeModel).filter(RoadmapNodeModel.project_id == project_id).delete()
    db.flush()

    coding_nodes: list[tuple[RoadmapNodeModel, dict]] = []
    learn_setup_nodes: list[tuple[RoadmapNodeModel, dict]] = []

    for level_idx, level_data in enumerate(levels):
        level_id = level_data.get("level_id", f"level-{level_idx + 1}")
        for node_data in level_data.get("nodes", []):
            node_id = node_data.get("id", str(uuid.uuid4()))
            db_node = RoadmapNodeModel(
                id=node_id,
                project_id=project_id,
                title=node_data.get("title", ""),
                type=node_data.get("type", "code"),
                description=node_data.get("description", ""),
                level_id=level_id,
                level_order=level_idx,
                completed=False,
            )
            db_node.set_dependencies(node_data.get("dependencies", []))
            db_node.set_unlock_after(node_data.get("unlock_after", []))
            db_node.set_metadata(node_data.get("metadata", {}))
            db.add(db_node)

            if db_node.type == "code":
                coding_nodes.append((db_node, node_data))
            elif db_node.type in ("learn", "setup"):
                learn_setup_nodes.append((db_node, node_data))

    db.commit()

    # ── Generate expected_spec for coding nodes (background, best-effort) ──
    async def _gen_spec(db_node: RoadmapNodeModel, node_data: dict) -> None:
        try:
            spec = await generate_expected_spec(
                blueprint=body.blueprint,
                node=node_data,
                user_level=body.user_level,
            )
            db_node.set_expected_spec(spec)
            db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to generate expected_spec for node %s: %s", db_node.id, exc)

    # ── Generate documentation for learn/setup nodes (background, best-effort) ──
    async def _gen_docs(db_node: RoadmapNodeModel, node_data: dict) -> None:
        try:
            doc = await generate_documentation(
                blueprint=body.blueprint,
                node=node_data,
                user_level=body.user_level,
            )
            db_node.set_documentation(doc)
            db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to generate documentation for node %s: %s", db_node.id, exc)

    tasks: list = []
    if coding_nodes:
        tasks += [_gen_spec(n, d) for n, d in coding_nodes]
    if learn_setup_nodes:
        tasks += [_gen_docs(n, d) for n, d in learn_setup_nodes]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

    # ── Generate file tree (background, best-effort) ──
    try:
        file_tree = await generate_file_tree(
            blueprint=body.blueprint,
            levels=levels,
        )
        project.set_file_tree(file_tree)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to generate file tree for project %s: %s", project_id, exc)

    return {"roadmap": flatten_levels_to_nodes(levels), "project_id": project_id}


@router.get("/project/{project_id}/roadmap-levels")
def get_roadmap_levels(project_id: str, db: Session = Depends(get_db)):
    """Return the level-based roadmap with completion status from DB."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    nodes = db.query(RoadmapNodeModel).filter(
        RoadmapNodeModel.project_id == project_id
    ).order_by(RoadmapNodeModel.level_order, RoadmapNodeModel.id).all()

    # Group nodes into levels
    levels_map: dict[str, dict] = {}
    for node in nodes:
        lid = node.level_id or "level-0"
        if lid not in levels_map:
            levels_map[lid] = {
                "level_id": lid,
                "title": "",
                "description": "",
                "order": node.level_order or 0,
                "unlocked": False,
                "nodes": [],
            }
        levels_map[lid]["nodes"].append({
            "id": node.id,
            "title": node.title,
            "type": node.type,
            "description": node.description,
            "dependencies": node.get_dependencies(),
            "unlock_after": node.get_unlock_after(),
            "metadata": node.get_metadata(),
            "completed": node.completed,
        })

    # Sort levels by order
    levels_list = sorted(levels_map.values(), key=lambda l: l["order"])

    # Apply unlock logic: level 1 always unlocked; next level if all previous completed
    for i, level in enumerate(levels_list):
        if i == 0:
            level["unlocked"] = True
        else:
            prev_nodes = levels_list[i - 1]["nodes"]
            level["unlocked"] = all(n["completed"] for n in prev_nodes)

    return {"levels": levels_list, "project_id": project_id}


@router.get("/project/{project_id}/roadmap")
def get_flat_roadmap(project_id: str, db: Session = Depends(get_db)):
    """Return a flat ordered roadmap with completion status, lock state, and spec data."""
    # Re-use the level endpoint logic, then flatten
    result = get_roadmap_levels(project_id, db)

    # Build a lookup of DB node models for enrichment
    nodes = db.query(RoadmapNodeModel).filter(
        RoadmapNodeModel.project_id == project_id
    ).all()
    db_nodes_by_id = {n.id: n for n in nodes}

    return {
        "roadmap": flatten_levels_to_nodes(result["levels"], db_nodes_by_id),
        "project_id": project_id,
    }


@router.get("/project/{project_id}/file-tree")
def get_file_tree(project_id: str, db: Session = Depends(get_db)):
    """Return the file tree with completion status."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    file_tree = project.get_file_tree()
    if file_tree is None:
        return {"file_tree": [], "progress": 0}

    # Get completion map
    nodes = db.query(RoadmapNodeModel).filter(
        RoadmapNodeModel.project_id == project_id
    ).all()
    completed_ids = {n.id for n in nodes if n.completed}
    total_nodes = len(nodes)
    completed_count = len(completed_ids)

    # Annotate file tree with completion status
    def _annotate(tree_nodes: list[dict]) -> list[dict]:
        for entry in tree_nodes:
            linked = entry.get("linked_nodes", [])
            entry["is_completed"] = bool(linked) and all(nid in completed_ids for nid in linked)
            if entry.get("children"):
                _annotate(entry["children"])
        return tree_nodes

    annotated = _annotate(file_tree)
    progress = round((completed_count / total_nodes * 100) if total_nodes > 0 else 0, 1)

    return {"file_tree": annotated, "progress": progress}


@router.post("/node/{node_id}/complete")
def complete_node(node_id: str, db: Session = Depends(get_db)):
    """Mark a node as completed. Unlock next level if all peers are done."""
    node = db.query(RoadmapNodeModel).filter(RoadmapNodeModel.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    node.completed = True
    db.commit()

    # Check if this unlocks the next level
    level_id = node.level_id
    project_id = node.project_id

    same_level_nodes = db.query(RoadmapNodeModel).filter(
        RoadmapNodeModel.project_id == project_id,
        RoadmapNodeModel.level_id == level_id,
    ).all()

    all_level_completed = all(n.completed for n in same_level_nodes)

    # Determine next level
    next_level_unlocked = False
    if all_level_completed and node.level_order is not None:
        next_order = node.level_order + 1
        next_level_nodes = db.query(RoadmapNodeModel).filter(
            RoadmapNodeModel.project_id == project_id,
            RoadmapNodeModel.level_order == next_order,
        ).all()
        if next_level_nodes:
            next_level_unlocked = True

    return {
        "completed": True,
        "node_id": node_id,
        "level_completed": all_level_completed,
        "next_level_unlocked": next_level_unlocked,
    }
