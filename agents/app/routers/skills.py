"""Skills router — POST /skills"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.graph import skill_graph
from app.auth import get_current_user

router = APIRouter()


class SkillsRequest(BaseModel):
    blueprint: dict
    user_level: str  # "beginner" | "intermediate" | "pro"


@router.post("/skills")
async def assess_skills(body: SkillsRequest, user_id: str = Depends(get_current_user)):
    """Return high-level conceptual skills required for the project."""
    if not body.blueprint:
        raise HTTPException(status_code=400, detail="blueprint must not be empty")
    if body.user_level not in ("beginner", "intermediate", "pro"):
        raise HTTPException(status_code=400, detail="user_level must be beginner, intermediate, or pro")

    result = await skill_graph.ainvoke(
        {
            "blueprint": body.blueprint,
            "user_level": body.user_level,
        }
    )

    return {"skills": result.get("suggested_skills", [])}
