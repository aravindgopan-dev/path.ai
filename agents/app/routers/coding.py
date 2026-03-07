"""Coding router — instruction, skeleton, validation, documentation, and chat endpoints."""

from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import RoadmapNodeModel, Project
from app.agents.skeleton_agent import generate_skeleton
from app.agents.expected_spec_agent import generate_expected_spec
from app.agents.validator_agent import validate_code
from app.agents.feedback_agent import generate_feedback
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


# ── Endpoints ──────────────────────────────────────

@router.post("/{node_id}/instruction")
async def get_instruction(node_id: str, body: InstructionRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Generate structured coding instruction for a node."""
    node = _get_node_or_404(node_id, db, user_id)
    project = _get_project_for_node(node, db)
    blueprint = project.get_blueprint()

    # 1. Check cache
    cached = node.get_instruction()
    if cached:
        return {"instruction": cached}

    # 2. Generate on-demand
    result = await generate_documentation(
        blueprint=blueprint,
        node=_node_as_dict(node),
        user_level=body.user_level,
    )

    # 3. Cache it
    node.set_instruction(result)
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
    """Validate user code against the expected spec, then generate feedback.

    For code nodes: marks node completed only if status = pass.
    Returns validation score percentage.
    """
    node = _get_node_or_404(node_id, db, user_id)

    expected_spec = node.get_expected_spec()
    if not expected_spec:
        raise HTTPException(
            status_code=400,
            detail="No expected_spec found for this node. Generate one first via POST /node/{id}/regenerate-spec.",
        )

    project = _get_project_for_node(node, db)
    blueprint = project.get_blueprint()
    node_objective = node.get_metadata().get("objective", node.description)

    # 1. AI-Driven Validation (replaces structural check + legacy feedback agent)
    validation_result = await validate_code(
        blueprint=blueprint,
        node=_node_as_dict(node),
        user_files=body.files,
        expected_spec=expected_spec,
        node_objective=node_objective,
    )

    # 2. Auto-complete node if validation passes
    if validation_result["status"] == "pass":
        node.completed = True
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
    node = _get_node_or_404(node_id, db, user_id)
    doc = node.get_documentation()
    
    if doc:
        return {"documentation": doc}
        
    # Generate on-demand if it doesn't exist
    project = _get_project_for_node(node, db)
    blueprint = project.get_blueprint()

    doc = await generate_documentation(
        blueprint=blueprint,
        node=_node_as_dict(node),
        user_level="intermediate", # Defaulting to intermediate for on-demand Generation
    )

    node.set_documentation(doc)
    db.commit()

    return {"documentation": doc}


@router.post("/{node_id}/documentation")
async def regenerate_documentation(node_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """(Re)generate documentation for a learn/setup node."""
    node = _get_node_or_404(node_id, db, user_id)
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


@router.post("/{node_id}/chat")
async def chat(node_id: str, body: ChatRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Node-scoped conversational assistant."""
    node = _get_node_or_404(node_id, db, user_id)
    project = _get_project_for_node(node, db)

    blueprint = project.get_blueprint()
    blueprint_summary = blueprint.get("description", blueprint.get("name", ""))

    node_objective = node.get_metadata().get("objective", node.description)

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
    node = _get_node_or_404(node_id, db, user_id)
    project = _get_project_for_node(node, db)
    blueprint = project.get_blueprint()

    spec = await generate_expected_spec(
        blueprint=blueprint,
        node=_node_as_dict(node),
        user_level=body.user_level,
    )

    node.set_expected_spec(spec)
    db.commit()

    return {"expected_spec": spec}


@router.post("/{node_id}/help")
async def get_help(node_id: str, body: HelpRequest, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Add mentor comments/TODOs to existing user code."""
    node = _get_node_or_404(node_id, db, user_id)
    project = _get_project_for_node(node, db)
    blueprint = project.get_blueprint()

    # We reuse the skeleton agent but with a 'help' mode (to be implemented in the agent)
    result = await generate_skeleton(
        blueprint=blueprint,
        node=_node_as_dict(node),
        user_level=body.user_level,
        mode="help",
        user_code=json.dumps(body.files),
    )

    return {"skeleton": result}
