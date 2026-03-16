"""Tutor router — POST /tutor to generate learning documentation"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.agents.tutor_agent import generate_tutor_documentation
from app.auth import get_current_user

router = APIRouter()


class TutorRequest(BaseModel):
    """Request to generate learning documentation for a level."""
    level_title: str
    level_description: str
    level_tasks: list[str]
    tech_stack: list[str]
    difficulty_target: str  # beginner|advanced


class ResourceOutput(BaseModel):
    """External learning resource."""
    title: str
    url: str
    description: str


class TutorDocumentationOutput(BaseModel):
    """Learning documentation output."""
    title: str
    definition: str
    why_it_matters: str
    key_concepts: list[str]
    resources: list[ResourceOutput]
    example_code: str = None
    common_mistakes: list[str] = []


@router.post("/tutor", response_model=TutorDocumentationOutput)
async def get_tutor_documentation(
    body: TutorRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Generate engaging learning documentation for a specific learning level.
    
    This endpoint:
    1. Takes level info (title, description, tasks)
    2. Takes project context (tech_stack, difficulty)
    3. Generates simple definitions, key concepts, and resources
    4. Returns documentation ready to display in UI
    """
    if not body.level_title:
        raise HTTPException(status_code=400, detail="level_title is required")
    if body.difficulty_target not in ("beginner", "advanced"):
        raise HTTPException(status_code=400, detail="difficulty_target must be beginner or advanced")

    try:
        documentation = await generate_tutor_documentation(
            level_title=body.level_title,
            level_description=body.level_description,
            level_tasks=body.level_tasks,
            tech_stack=body.tech_stack,
            difficulty_target=body.difficulty_target,
        )
        return documentation
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate documentation: {str(e)}")
