"""Roadmap router — POST /roadmap with level-based structure and DB persistence."""

from __future__ import annotations

import uuid
import asyncio
import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db

from app.graph import roadmap_graph
from app.agents.file_tree_agent import generate_file_tree
from app.agents.documentation_agent import generate_documentation
from app.auth import get_current_user

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
async def generate_roadmap(body: RoadmapRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Generate consolidated roadmap, persist to DB, and return."""
    if not body.blueprint:
        raise HTTPException(status_code=400, detail="blueprint must not be empty")
    if body.user_level not in ("beginner", "intermediate", "pro"):
        raise HTTPException(status_code=400, detail="user_level must be beginner, intermediate, or pro")

    # This single call now generates EVERYTHING: nodes, specs, documentation, and the file tree.
    result = await roadmap_graph.ainvoke(
        {
            "blueprint": body.blueprint,
            "user_level": body.user_level,
            "suggested_skills": body.suggested_skills,
        }
    )

    nodes: list[dict] = result.get("roadmap", [])
    file_tree: list[dict] = result.get("file_tree", [])

    # ── Persist project ───────────────────────────
    project_id = body.blueprint.get("project_id") or str(uuid.uuid4())
    project_name = body.blueprint.get("name", "Untitled")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        project = Project(id=project_id, user_id=user_id, name=project_name)
        db.add(project)
    elif project.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")
    
    project.set_blueprint(body.blueprint)
    project.set_file_tree(file_tree)
    db.flush()

    # ── Persist nodes ─────────────────────────────
    # Clear old nodes (re-generation scenario)
    db.query(RoadmapNodeModel).filter(RoadmapNodeModel.project_id == project_id).delete()
    db.flush()

    for node_data in nodes:
        node_id = node_data.get("id") or str(uuid.uuid4())
        db_node = RoadmapNodeModel(
            id=node_id,
            project_id=project_id,
            title=node_data.get("title", ""),
            type=node_data.get("type", "code"),
            description=node_data.get("description", ""),
            level_id=f"level-{node_data.get('level', 0)}",
            level_order=node_data.get("level", 0),
            completed=False,
        )
        db_node.set_dependencies(node_data.get("dependencies", []))
        db_node.set_unlock_after(node_data.get("unlock_after", []))
        db_node.set_metadata(node_data.get("metadata", {}))
        
        # Extract integrated spec/docs
        if node_data.get("expected_spec"):
            db_node.set_expected_spec(node_data["expected_spec"])
        if node_data.get("documentation"):
            db_node.set_documentation(node_data["documentation"])
            
        db.add(db_node)

    db.commit()

    # Structure into levels for the flattening helper
    # Group nodes by level to maintain interface compatibility
    levels_map: dict[int, list] = {}
    for n in nodes:
        lv = n.get("level", 0)
        if lv not in levels_map:
            levels_map[lv] = []
        levels_map[lv].append(n)
    
    levels_list = []
    for lv in sorted(levels_map.keys()):
        levels_list.append({
            "level_id": f"level-{lv}",
            "unlocked": lv == 0,
            "nodes": levels_map[lv]
        })

    return {"roadmap": flatten_levels_to_nodes(levels_list), "project_id": project_id}


@router.get("/project/{project_id}/roadmap-levels")
def get_roadmap_levels(project_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Return the level-based roadmap with completion status from DB."""
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
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
def get_flat_roadmap(project_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Return a flat ordered roadmap with completion status, lock state, and spec data."""
    # Re-use the level endpoint logic, then flatten
    result = get_roadmap_levels(project_id, db, user_id)

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
def get_file_tree(project_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Return the file tree with completion status."""
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
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
def complete_node(node_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Mark a node as completed. Unlock next level if all peers are done."""
    node = db.query(RoadmapNodeModel).join(Project).filter(
        RoadmapNodeModel.id == node_id,
        Project.user_id == user_id
    ).first()
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
