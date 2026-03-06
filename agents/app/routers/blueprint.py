"""Blueprint router — POST /blueprint"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.graph import blueprint_graph
from app.auth import get_current_user

router = APIRouter()


class BlueprintRequest(BaseModel):
    project_summary: str
    selected_features: list
    tech_stack: list
    user_level: Optional[str] = "intermediate"


@router.post("/blueprint")
async def generate_blueprint(body: BlueprintRequest, user_id: str = Depends(get_current_user)):
    """Generate a full project blueprint from selected features."""
    if not body.selected_features:
        raise HTTPException(status_code=400, detail="selected_features must not be empty")

    result = await blueprint_graph.ainvoke(
        {
            "project_summary": body.project_summary,
            "selected_features": body.selected_features,
            "recommended_tech_stack": body.tech_stack,
            "user_level": body.user_level,
        }
    )

    blueprint = result.get("blueprint", {})
    return {"blueprint": blueprint}
