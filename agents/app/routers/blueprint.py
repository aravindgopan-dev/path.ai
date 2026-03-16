"""Blueprint router — POST /blueprint to generate and save project blueprint"""

from __future__ import annotations

import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.graph import blueprint_graph
from app.auth import get_current_user
from app.db.database import get_db
from app.db.models import Project

router = APIRouter()


class FeatureInput(BaseModel):
    id: str
    name: str
    description: str


class BlueprintRequest(BaseModel):
    """Blueprint generation request — takes architect output and user level."""
    project_summary: str
    suggested_features: list[FeatureInput]
    recommended_tech_stack: list[str]
    user_level: Optional[str] = "beginner"


class BlueprintData(BaseModel):
    """Blueprint data with all required fields."""
    project_id: str
    name: str
    description: str
    tech_stack: list[str]
    features: list
    entities: list
    api_contract: list
    file_structure_plan: list
    learning_objectives: list | None
    non_functional_requirements: dict


class BlueprintResponseWrapper(BaseModel):
    """Wrapper for blueprint response."""
    blueprint: BlueprintData


@router.post("/blueprint", response_model=BlueprintResponseWrapper)
async def generate_blueprint(
    body: BlueprintRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a full project blueprint from architect output.
    
    This endpoint:
    1. Takes architect's analysis (summary, features, tech_stack) + user level
    2. Generates comprehensive blueprint
    3. Saves to database immediately
    4. Returns blueprint with project_id
    """
    if not body.suggested_features:
        raise HTTPException(status_code=400, detail="suggested_features must not be empty")

    # Convert FeatureInput to dict format for graph
    features_dict = [f.model_dump() for f in body.suggested_features]

    # Call blueprint graph node
    result = await blueprint_graph.ainvoke(
        {
            "project_summary": body.project_summary,
            "suggested_features": features_dict,
            "recommended_tech_stack": body.recommended_tech_stack,
            "user_level": body.user_level,
        }
    )

    blueprint = result.get("blueprint", {})
    
    # Generate project_id if not already present
    if "project_id" not in blueprint:
        blueprint["project_id"] = str(uuid.uuid4())
    
    project_id = blueprint["project_id"]
    
    # Save blueprint to database immediately
    try:
        # Check if project already exists
        existing_project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == user_id
        ).first()
        
        if existing_project:
            # Update existing project
            existing_project.name = blueprint.get("name", "Untitled Project")
            existing_project.description = blueprint.get("description", "")
            existing_project.set_blueprint(blueprint)
            existing_project.set_tech_stack(blueprint.get("tech_stack", []))
        else:
            # Create new project
            project = Project(
                id=project_id,
                user_id=user_id,
                name=blueprint.get("name", "Untitled Project"),
                description=blueprint.get("description", ""),
            )
            project.set_blueprint(blueprint)
            project.set_tech_stack(blueprint.get("tech_stack", []))
            db.add(project)
        
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save blueprint: {str(e)}")
    
    return {"blueprint": blueprint}
