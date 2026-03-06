"""Architect Agent — analyses a raw project idea and returns structured JSON."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_medium_llm
from app.utils.prompts import ARCHITECT_SYSTEM, ARCHITECT_USER
from app.schemas import ArchitectSchema


async def architect_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: process a raw project idea."""
    idea = state["project_idea"]
    llm = get_medium_llm(temperature=0.3)
    
    # Standardize via structured output
    structured_llm = llm.with_structured_output(ArchitectSchema)

    messages = [
        SystemMessage(content=ARCHITECT_SYSTEM),
        HumanMessage(content=ARCHITECT_USER.format(idea=idea)),
    ]

    content: ArchitectSchema = await structured_llm.ainvoke(messages)

    return {
        "project_summary": content.project_summary,
        "suggested_features": [f.model_dump() for f in content.features],
        "recommended_tech_stack": content.tech_stack,
    }
