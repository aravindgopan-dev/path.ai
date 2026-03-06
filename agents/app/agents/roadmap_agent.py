"""Roadmap Agent — builds a level-based progressive learning/build roadmap."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_medium_llm
from app.utils.prompts import ROADMAP_SYSTEM, ROADMAP_USER
from app.schemas import RoadmapSchema


async def roadmap_planner_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: generate high-level project roadmap and file tree."""
    llm = get_medium_llm(temperature=0.3)
    structured_llm = llm.with_structured_output(RoadmapSchema)

    blueprint = state.get("blueprint", {})
    level = state.get("user_level", "intermediate")
    skills = state.get("suggested_skills", [])

    messages = [
        SystemMessage(content=ROADMAP_SYSTEM),
        HumanMessage(
            content=ROADMAP_USER.format(
                level=level,
                blueprint_json=json.dumps(blueprint, indent=2),
                skills_json=json.dumps(skills, indent=2),
            )
        ),
    ]

    content: RoadmapSchema = await structured_llm.ainvoke(messages)

    return {
        "roadmap": [node.model_dump() for node in content.nodes],
        "file_tree": [entry.model_dump() for entry in content.file_tree],
    }
