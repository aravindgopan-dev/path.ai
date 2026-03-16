"""Coding router — instruction, skeleton, validation, documentation, and chat endpoints."""

from __future__ import annotations

import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from app.db.database import get_db
from app.db.models import RoadmapNodeModel, Project, LevelNodeContentModel
from app.agents.skeleton_agent import generate_skeleton, generate_skeleton_code
from app.agents.expected_spec_agent import generate_spec_for_node
from app.agents.validator_agent import validate_code
from app.agents.chat_agent import chat_with_node
from app.agents.documentation_agent import generate_documentation
from app.auth import get_current_user

router = APIRouter(prefix="/node")


# ── Request / Response schemas ─────────────────────

class InstructionRequest(BaseModel):
    user_level: str = "intermediate"


class SkeletonRequest(BaseModel):
    user_level: str = "intermediate"
    mode: str = "free"  # "free" | "help"


class ValidateRequest(BaseModel):
    files: list[dict] = Field(..., description="[{filename, content}]")


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = Field(default_factory=list)
    user_code: str = ""


class RegenerateSpecRequest(BaseModel):
    user_level: str = "intermediate"


class HelpRequest(BaseModel):
    user_level: str = "intermediate"
    files: list[dict] = Field(..., description="[{filename, content}]")


class SpecRequest(BaseModel):
    """Request for generating spec for a roadmap level."""
    project_id: str
    level_id: int


class SkeletonCodeRequest(BaseModel):
    """Request for generating skeleton code for a roadmap level."""
    project_id: str
    level_id: int


class CompleteNodeResponse(BaseModel):
    completed: bool
    node_id: str
    level_completed: bool
    next_level_unlocked: bool


# ── Helpers ────────────────────────────────────────

def _get_node_or_404(node_id: str, db: Session, user_id: str) -> RoadmapNodeModel:
    node = db.query(RoadmapNodeModel).join(Project).filter(
        RoadmapNodeModel.id == node_id,
        Project.user_id == user_id
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found or unauthorized")
    return node


def _get_project_for_node(node: RoadmapNodeModel, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == node.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found for this node")
    return project


def _node_as_dict(node: RoadmapNodeModel) -> dict:
    return {
        "id": node.id,
        "title": node.title,
        "type": node.type,
        "description": node.description,
        "dependencies": node.get_dependencies(),
        "unlock_after": node.get_unlock_after(),
        "metadata": node.get_metadata(),
    }


def _parse_level_node_id(node_id: str) -> tuple[str, int] | None:
    """Parse synthetic node IDs like '<project_id>:level:<level_id>'."""
    if ":level:" not in node_id:
        return None
    project_id, level_id_str = node_id.split(":level:", 1)
    if not project_id:
        return None
    try:
        level_id = int(level_id_str)
    except (TypeError, ValueError):
        return None
    return project_id, level_id


def _get_validation_criteria_from_project_roadmap(project: Project, node: RoadmapNodeModel) -> list[str]:
    roadmap = project.get_roadmap() or {}
    levels = roadmap.get("levels", []) if isinstance(roadmap, dict) else []

    node_level_id = str(node.level_id) if node.level_id is not None else ""
    node_title = (node.title or "").strip().lower()

    for level in levels:
        if not isinstance(level, dict):
            continue
        level_id = str(level.get("level_id", ""))
        level_title = str(level.get("title", "")).strip().lower()

        if (node_level_id and level_id == node_level_id) or (node_title and level_title == node_title):
            return level.get("validation_criteria") or []

    return []


def _level_as_node_dict(node_id: str, level: dict) -> dict:
    """Adapt a roadmap level dict to the node-like shape expected by agents."""
    return {
        "id": node_id,
        "title": level.get("title", f"Level {level.get('level_id', '')}"),
        "type": level.get("type", "coding"),
        "description": level.get("description", ""),
        "dependencies": [],
        "unlock_after": [],
        "metadata": {
            "tasks": level.get("tasks") or [],
            "terminal_commands": level.get("terminal_commands") or [],
            "validation_criteria": level.get("validation_criteria") or [],
            "files": level.get("files") or [],
            "objective": level.get("description", ""),
        },
        "files": [
            file_item.get("path")
            for file_item in (level.get("files") or [])
            if isinstance(file_item, dict) and file_item.get("path")
        ],
    }


def _get_level_from_project_roadmap_or_404(node_id: str, db: Session, user_id: str) -> tuple[Project, dict]:
    """Resolve synthetic level node id to (project, level_dict) from saved roadmap."""
    parsed = _parse_level_node_id(node_id)
    if not parsed:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found or unauthorized")

    project_id, level_id = parsed

    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")

    roadmap = project.get_roadmap() or {}
    levels = roadmap.get("levels", []) if isinstance(roadmap, dict) else []

    level = None
    for lv in levels:
        if isinstance(lv, dict) and lv.get("level_id") == level_id:
            level = lv
            break

    if not level:
        raise HTTPException(status_code=404, detail=f"Level {level_id} not found in roadmap")

    return project, level


def _get_or_create_level_content_cache(
    db: Session,
    project_id: str,
    level_id: int,
    node_type: str,
) -> LevelNodeContentModel:
    cached = db.query(LevelNodeContentModel).filter(
        LevelNodeContentModel.project_id == project_id,
        LevelNodeContentModel.level_id == level_id,
    ).first()

    if cached:
        return cached

    cached = LevelNodeContentModel(
        project_id=project_id,
        level_id=level_id,
        node_type=node_type,
    )
    db.add(cached)
    db.flush()
    return cached


def _documentation_is_thin(doc: dict | None) -> bool:
    if not isinstance(doc, dict):
        return True

    explanation = str(doc.get("explanation", "")).strip()
    algorithm_steps = doc.get("algorithm_steps") or []
    learning_focus = doc.get("learning_focus") or []
    common_mistakes = doc.get("common_mistakes") or []

    return (
        len(explanation) < 220
        or len(algorithm_steps) < 6
        or len(learning_focus) < 4
        or len(common_mistakes) < 3
    )


async def _commit_with_retry(db: Session, retries: int = 3, delay_seconds: float = 0.15) -> None:
    last_error: OperationalError | None = None
    for attempt in range(retries):
        try:
            db.commit()
            return
        except OperationalError as exc:
            db.rollback()
            if "database is locked" not in str(exc).lower() or attempt == retries - 1:
                raise
            last_error = exc
            await asyncio.sleep(delay_seconds * (attempt + 1))

    if last_error:
        raise last_error


# ── Endpoints ──────────────────────────────────────

@router.post("/{node_id}/instruction")
async def get_instruction(node_id: str, body: InstructionRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Generate structured coding instruction for a node."""
    node = db.query(RoadmapNodeModel).join(Project).filter(
        RoadmapNodeModel.id == node_id,
        Project.user_id == user_id
    ).first()

    if node:
        project = _get_project_for_node(node, db)
        blueprint = project.get_blueprint()

        cached = node.get_instruction()
        if cached:
            return {"instruction": cached}

        result = await generate_documentation(
            blueprint=blueprint,
            node=_node_as_dict(node),
            user_level=body.user_level,
        )

        node.set_instruction(result)
        db.commit()
        return {"instruction": result}

    project, level = _get_level_from_project_roadmap_or_404(node_id, db, user_id)
    blueprint = project.get_blueprint()
    level_id = int(level.get("level_id", 0))
    level_cache = _get_or_create_level_content_cache(
        db,
        project_id=project.id,
        level_id=level_id,
        node_type=str(level.get("type", "coding")),
    )

    cached_instruction = level_cache.get_instruction()
    if cached_instruction:
        return {"instruction": cached_instruction}

    result = await generate_documentation(
        blueprint=blueprint,
        node=_level_as_node_dict(node_id, level),
        user_level=body.user_level,
    )

    level_cache.set_instruction(result)
    db.commit()

    return {"instruction": result}


@router.post("/{node_id}/skeleton")
async def get_skeleton(node_id: str, body: SkeletonRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Generate skeleton scaffold for a coding node.

    Supports two modes via body.mode:
      - "signature" : 50% code scaffold with TODO markers
      - "free"      : minimal file creation only
    """
    node = _get_node_or_404(node_id, db, user_id)
    project = _get_project_for_node(node, db)
    blueprint = project.get_blueprint()

    mode = body.mode if body.mode in ("free", "help") else "free"

    # 1. Check cache (note: currently caches by node, independent of level/mode for simplicity)
    # Improvement: could cache keying by (node_id, user_level, mode)
    cached = node.get_skeleton()
    if cached:
        return {"skeleton": cached}

    # 2. Generate on-demand
    result = await generate_skeleton(
        blueprint=blueprint,
        node=_node_as_dict(node),
        user_level=body.user_level,
        mode=mode,
    )

    # 3. Cache it
    node.set_skeleton(result)
    db.commit()

    return {"skeleton": result}


@router.post("/{node_id}/validate")
async def validate_node(node_id: str, body: ValidateRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Validate user code against node validation_criteria and generate feedback.

    For code nodes: marks node completed only if status = pass.
    Returns validation score percentage.
    """
    node = db.query(RoadmapNodeModel).join(Project).filter(
        RoadmapNodeModel.id == node_id,
        Project.user_id == user_id
    ).first()

    if node:
        project = _get_project_for_node(node, db)
        blueprint = project.get_blueprint()
        node_payload = _node_as_dict(node)
        node_objective = node.get_metadata().get("objective", node.description)

        metadata = node.get_metadata() or {}
        validation_criteria = metadata.get("validation_criteria") or []

        # Fallback to roadmap JSON criteria for this node's level/title.
        if not validation_criteria:
            validation_criteria = _get_validation_criteria_from_project_roadmap(project, node)
            if validation_criteria:
                metadata["validation_criteria"] = validation_criteria
                node.set_metadata(metadata)
                db.commit()

        # Fallback/backfill from legacy expected_spec if present.
        if not validation_criteria:
            expected_spec = node.get_expected_spec() or {}
            validation_criteria = expected_spec.get("validation_criteria") or []
            if validation_criteria:
                metadata["validation_criteria"] = validation_criteria
                node.set_metadata(metadata)
                db.commit()

            node_payload.setdefault("metadata", {})
            node_payload["metadata"]["validation_criteria"] = validation_criteria
    else:
        project, level = _get_level_from_project_roadmap_or_404(node_id, db, user_id)
        blueprint = project.get_blueprint()
        node_payload = _level_as_node_dict(node_id, level)
        node_objective = node_payload.get("description", "")
        validation_criteria = level.get("validation_criteria") or []

        # Fallback: generate once and persist criteria if missing in roadmap.
        if not validation_criteria:
            generated_spec = await generate_spec_for_node(node=level, blueprint=blueprint)
            validation_criteria = generated_spec.get("validation_criteria") or []
            if validation_criteria:
                roadmap = project.get_roadmap() or {}
                levels = roadmap.get("levels", []) if isinstance(roadmap, dict) else []
                for lv in levels:
                    if isinstance(lv, dict) and lv.get("level_id") == level.get("level_id"):
                        lv["validation_criteria"] = validation_criteria
                        break
                project.set_roadmap(roadmap)
                db.commit()

    if not validation_criteria:
        raise HTTPException(
            status_code=400,
            detail="No validation_criteria found for this node. Regenerate roadmap/spec to populate criteria.",
        )

    # 1. AI-Driven Validation (replaces structural check + legacy feedback agent)
    validation_result = await validate_code(
        node=node_payload,
        user_files=body.files,
        validation_criteria=validation_criteria,
        node_objective=node_objective,
    )

    # 2. Auto-complete node if validation passes
    if validation_result["status"] == "pass":
        if node:
            node.completed = True
            db.commit()
        else:
            roadmap = project.get_roadmap() or {}
            levels = roadmap.get("levels", []) if isinstance(roadmap, dict) else []
            for lv in levels:
                if isinstance(lv, dict) and lv.get("level_id") == level.get("level_id"):
                    lv["completed"] = True
                    break
            project.set_roadmap(roadmap)
            db.commit()

    return {
        "validation": validation_result,
        "feedback": {
            "feedback_message": "Validation complete.",
            "hints": validation_result.get("notes", []),
            "improvement_points": validation_result.get("missing_items", []),
        },
    }


@router.get("/{node_id}/documentation")
async def get_documentation(node_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Return pre-generated documentation for a learn/setup node, or generate it on-demand."""
    # First try persisted roadmap node rows (legacy path)
    node = db.query(RoadmapNodeModel).join(Project).filter(
        RoadmapNodeModel.id == node_id,
        Project.user_id == user_id
    ).first()

    if node:
        doc = node.get_documentation()
        if doc and not _documentation_is_thin(doc):
            return {"documentation": doc}

        project = _get_project_for_node(node, db)
        blueprint = project.get_blueprint()

        doc = await generate_documentation(
            blueprint=blueprint,
            node=_node_as_dict(node),
            user_level="intermediate",
        )

        node.set_documentation(doc)
        db.commit()
        return {"documentation": doc}

    # Fallback: synthetic level node ids like '<project_id>:level:<level_id>'
    project, level = _get_level_from_project_roadmap_or_404(node_id, db, user_id)
    blueprint = project.get_blueprint()
    level_id = int(level.get("level_id", 0))
    level_cache = _get_or_create_level_content_cache(
        db,
        project_id=project.id,
        level_id=level_id,
        node_type=str(level.get("type", "learning")),
    )

    cached_doc = level_cache.get_documentation()
    if cached_doc and not _documentation_is_thin(cached_doc):
        return {"documentation": cached_doc}

    level_node = {
        "id": node_id,
        "title": level.get("title", f"Level {level.get('level_id', '')}"),
        "type": level.get("type", "learning"),
        "description": level.get("description", ""),
        "dependencies": [],
        "unlock_after": [],
        "metadata": {
            "tasks": level.get("tasks") or [],
            "terminal_commands": level.get("terminal_commands") or [],
            "validation_criteria": level.get("validation_criteria") or [],
            "files": level.get("files") or [],
        },
    }

    doc = await generate_documentation(
        blueprint=blueprint,
        node=level_node,
        user_level="intermediate",
    )

    level_cache.set_documentation(doc)
    db.commit()

    return {"documentation": doc}


@router.post("/{node_id}/documentation")
async def regenerate_documentation(node_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """(Re)generate documentation for a learn/setup node."""
    node = db.query(RoadmapNodeModel).join(Project).filter(
        RoadmapNodeModel.id == node_id,
        Project.user_id == user_id
    ).first()

    if node:
        project = _get_project_for_node(node, db)
        blueprint = project.get_blueprint()

        doc = await generate_documentation(
            blueprint=blueprint,
            node=_node_as_dict(node),
            user_level="intermediate",
        )

        node.set_documentation(doc)
        db.commit()
        return {"documentation": doc}

    project, level = _get_level_from_project_roadmap_or_404(node_id, db, user_id)
    blueprint = project.get_blueprint()
    level_id = int(level.get("level_id", 0))
    level_cache = _get_or_create_level_content_cache(
        db,
        project_id=project.id,
        level_id=level_id,
        node_type=str(level.get("type", "learning")),
    )

    level_node = {
        "id": node_id,
        "title": level.get("title", f"Level {level.get('level_id', '')}"),
        "type": level.get("type", "learning"),
        "description": level.get("description", ""),
        "dependencies": [],
        "unlock_after": [],
        "metadata": {
            "tasks": level.get("tasks") or [],
            "terminal_commands": level.get("terminal_commands") or [],
            "validation_criteria": level.get("validation_criteria") or [],
            "files": level.get("files") or [],
        },
    }

    doc = await generate_documentation(
        blueprint=blueprint,
        node=level_node,
        user_level="intermediate",
    )

    level_cache.set_documentation(doc)
    db.commit()

    return {"documentation": doc}


@router.post("/{node_id}/chat")
async def chat(node_id: str, body: ChatRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Node-scoped conversational assistant."""
    node = db.query(RoadmapNodeModel).join(Project).filter(
        RoadmapNodeModel.id == node_id,
        Project.user_id == user_id
    ).first()

    if node:
        project = _get_project_for_node(node, db)
        blueprint = project.get_blueprint()
        node_objective = node.get_metadata().get("objective", node.description)
    else:
        project, level = _get_level_from_project_roadmap_or_404(node_id, db, user_id)
        blueprint = project.get_blueprint()
        node_objective = level.get("description", level.get("title", ""))

    blueprint_summary = blueprint.get("description", blueprint.get("name", ""))

    result = await chat_with_node(
        blueprint_summary=blueprint_summary,
        node_objective=node_objective,
        user_code=body.user_code,
        history=body.history,
        message=body.message,
    )
    return result


@router.post("/{node_id}/regenerate-spec")
async def regenerate_spec(node_id: str, body: RegenerateSpecRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """(Re)generate the expected spec for a coding node and persist it."""
    node = db.query(RoadmapNodeModel).join(Project).filter(
        RoadmapNodeModel.id == node_id,
        Project.user_id == user_id
    ).first()

    if node:
        project = _get_project_for_node(node, db)
        blueprint = project.get_blueprint()
        spec = await generate_spec_for_node(node=_node_as_dict(node), blueprint=blueprint)
        node.set_expected_spec(spec)
        db.commit()
        return {"expected_spec": spec}

    project, level = _get_level_from_project_roadmap_or_404(node_id, db, user_id)
    blueprint = project.get_blueprint()
    spec = await generate_spec_for_node(node=level, blueprint=blueprint)
    return {"expected_spec": spec}


@router.post("/{node_id}/help")
async def get_help(node_id: str, body: HelpRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Add mentor comments/TODOs to existing user code."""
    node = db.query(RoadmapNodeModel).join(Project).filter(
        RoadmapNodeModel.id == node_id,
        Project.user_id == user_id
    ).first()

    if node:
        project = _get_project_for_node(node, db)
        blueprint = project.get_blueprint()
        node_payload = _node_as_dict(node)
    else:
        project, level = _get_level_from_project_roadmap_or_404(node_id, db, user_id)
        blueprint = project.get_blueprint()
        node_payload = _level_as_node_dict(node_id, level)

    # We reuse the skeleton agent but with a 'help' mode (to be implemented in the agent)
    result = await generate_skeleton(
        blueprint=blueprint,
        node=node_payload,
        user_level=body.user_level,
        mode="help",
        user_code=json.dumps(body.files),
    )

    return {"skeleton": result}


@router.post("/{node_id}/complete", response_model=CompleteNodeResponse)
async def complete_node(node_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Mark a roadmap node completed.

    Supports:
    - Persisted `RoadmapNodeModel` IDs
    - Synthetic IDs in format `<project_id>:level:<level_id>`
    """
    node = db.query(RoadmapNodeModel).join(Project).filter(
        RoadmapNodeModel.id == node_id,
        Project.user_id == user_id
    ).first()

    if node:
        node.completed = True
        await _commit_with_retry(db)
        return {
            "completed": True,
            "node_id": node_id,
            "level_completed": True,
            "next_level_unlocked": True,
        }

    # Fallback for synthetic level IDs
    project, level = _get_level_from_project_roadmap_or_404(node_id, db, user_id)
    roadmap = project.get_roadmap() or {}
    levels = roadmap.get("levels", []) if isinstance(roadmap, dict) else []

    completed_index = None
    for idx, lv in enumerate(levels):
        if isinstance(lv, dict) and lv.get("level_id") == level.get("level_id"):
            lv["completed"] = True
            completed_index = idx
            break

    if completed_index is None:
        raise HTTPException(status_code=404, detail="Level not found in roadmap")

    next_level_unlocked = completed_index < len(levels) - 1

    project.set_roadmap(roadmap)
    await _commit_with_retry(db)

    return {
        "completed": True,
        "node_id": node_id,
        "level_completed": True,
        "next_level_unlocked": next_level_unlocked,
    }


# ── New Endpoints for Roadmap-based Spec & Skeleton Generation ──────

@router.post("/spec")
async def get_spec_for_level(
    body: SpecRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Generate detailed spec (instructions) for a setup or coding level.
    
    Frontend calls this when user clicks on a setup/coding node in roadmap.
    Returns frontend-renderable task overview, technical requirements, and step-by-step guide.
    """
    # Fetch project
    project = db.query(Project).filter(
        Project.id == body.project_id,
        Project.user_id == user_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")
    
    # Get roadmap
    roadmap = project.get_roadmap()
    if not roadmap:
        raise HTTPException(status_code=400, detail="Roadmap not generated yet for this project")
    
    # Find the level
    levels = roadmap.get("levels", [])
    level = None
    for lv in levels:
        if lv.get("level_id") == body.level_id:
            level = lv
            break
    
    if not level:
        raise HTTPException(status_code=404, detail=f"Level {body.level_id} not found in roadmap")
    
    level_type = level.get("type", "")
    if level_type not in ("setup", "coding"):
        raise HTTPException(status_code=400, detail=f"Spec generation only works for 'setup' or 'coding' levels, got '{level_type}'")
    
    # Get blueprint
    blueprint = project.get_blueprint()

    level_cache = _get_or_create_level_content_cache(
        db,
        project_id=project.id,
        level_id=body.level_id,
        node_type=level_type,
    )

    cached_spec = level_cache.get_expected_spec()
    if cached_spec:
        return {
            "level_id": body.level_id,
            "level_type": level_type,
            "spec": cached_spec,
        }
    
    # Generate spec
    spec = await generate_spec_for_node(node=level, blueprint=blueprint)

    level_cache.set_expected_spec(spec)
    db.commit()
    
    return {
        "level_id": body.level_id,
        "level_type": level_type,
        "spec": spec,
    }


@router.post("/skeleton")
async def get_skeleton_for_level(
    body: SkeletonCodeRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Generate partial code skeleton with TODO markers for a coding level.
    
    Frontend calls this when user clicks the "Help" button on a coding node.
    Returns partial code (~30-50% complete) with algorithm comments and TODO gaps.
    """
    # Fetch project
    project = db.query(Project).filter(
        Project.id == body.project_id,
        Project.user_id == user_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")
    
    # Get roadmap
    roadmap = project.get_roadmap()
    if not roadmap:
        raise HTTPException(status_code=400, detail="Roadmap not generated yet for this project")
    
    # Find the level
    levels = roadmap.get("levels", [])
    level = None
    for lv in levels:
        if lv.get("level_id") == body.level_id:
            level = lv
            break
    
    if not level:
        raise HTTPException(status_code=404, detail=f"Level {body.level_id} not found in roadmap")
    
    level_type = level.get("type", "")
    if level_type != "coding":
        raise HTTPException(status_code=400, detail=f"Skeleton generation only works for 'coding' levels, got '{level_type}'")
    
    # Get blueprint
    blueprint = project.get_blueprint()

    level_cache = _get_or_create_level_content_cache(
        db,
        project_id=project.id,
        level_id=body.level_id,
        node_type=level_type,
    )

    cached_skeleton = level_cache.get_skeleton()
    if cached_skeleton:
        return {
            "level_id": body.level_id,
            "skeleton": cached_skeleton,
        }
    
    # Generate skeleton code
    skeleton = await generate_skeleton_code(node=level, blueprint=blueprint)

    level_cache.set_skeleton(skeleton)
    db.commit()
    
    return {
        "level_id": body.level_id,
        "skeleton": skeleton,
    }
