"""Skills router — POST /skills to generate web development skills"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.graph import skill_graph
from app.auth import get_current_user
from app.db.database import get_db
from app.db.models import Project

router = APIRouter()


class SkillsRequest(BaseModel):
    """Skills assessment request — takes blueprint and generates relevant skills.
    
    Can provide either blueprint directly or project_id to fetch from database.
    """
    blueprint: Optional[dict] = None
    project_id: Optional[str] = None
    user_level: Optional[str] = None


class SkillsResponse(BaseModel):
    skills: list[dict]


@router.post("/skills", response_model=SkillsResponse)
async def assess_skills(
    body: SkillsRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate web development skills relevant to the project.
    
    Input:
    - blueprint: Project blueprint (either provided or fetched from DB if project_id given)
    - project_id: Optional project ID to fetch blueprint from database
    
    Output:
    - skills: Array of {id, name, description} skill objects
    
    Skills are generated based on:
    - Project's tech stack
    - Project features
    - User's difficulty level (from blueprint.difficulty_target)
    """
    blueprint = body.blueprint
    
    # If project_id provided, fetch blueprint from database
    if body.project_id and not blueprint:
        project = db.query(Project).filter(
            Project.id == body.project_id,
            Project.user_id == user_id
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        blueprint = project.get_blueprint()
    
    if not blueprint:
        raise HTTPException(status_code=400, detail="blueprint must be provided or project_id must be valid")

    difficulty = str((blueprint or {}).get("difficulty_target", body.user_level or "beginner")).lower()
    if difficulty == "advanced":
        return {"skills": []}

    result = await skill_graph.ainvoke(
        {
            "blueprint": blueprint,
        }
    )

    return {"skills": result.get("suggested_skills", [])}

class SaveSelectedSkillsRequest(BaseModel):
    """Request to save selected skills to blueprint learning_objectives."""
    project_id: str
    selected_skills: list[dict]  # [{id, name, description}, ...]


@router.post("/skills/save")
async def save_selected_skills(
    body: SaveSelectedSkillsRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save selected skills to blueprint's learning_objectives.
    
    This endpoint:
    1. Fetches the project's blueprint from database
    2. Updates learning_objectives with selected skills
    3. Saves the updated blueprint back to database
    """
    project = db.query(Project).filter(
        Project.id == body.project_id,
        Project.user_id == user_id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        # Get current blueprint
        blueprint = project.get_blueprint()
        
        difficulty = str(blueprint.get("difficulty_target", "beginner")).lower()

        if difficulty == "advanced":
            blueprint["learning_objectives"] = None
        else:
            blueprint["learning_objectives"] = [
                f"{skill.get('name', '')} — {skill.get('description', '')}"
                for skill in body.selected_skills
            ]
        
        # Save updated blueprint back to database
        project.set_blueprint(blueprint)
        db.commit()
        
        return {
            "status": "success",
            "message": "Learning objectives updated with selected skills",
            "project_id": body.project_id,
            "learning_objectives": blueprint["learning_objectives"],
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save skills: {str(e)}")
