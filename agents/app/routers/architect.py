"""Architect router — POST /architect"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.graph import architect_graph

router = APIRouter()


class ArchitectRequest(BaseModel):
    idea: str


class ArchitectResponse(BaseModel):
    project_summary: str
    features: list
    tech_stack: list


@router.post("/architect", response_model=ArchitectResponse)
async def process_idea(body: ArchitectRequest):
    """Accept a raw project idea and return structured analysis."""
    if not body.idea.strip():
        raise HTTPException(status_code=400, detail="idea must not be empty")

    result = await architect_graph.ainvoke({"project_idea": body.idea})

    return ArchitectResponse(
        project_summary=result.get("project_summary", ""),
        features=result.get("suggested_features", []),
        tech_stack=result.get("recommended_tech_stack", []),
    )
