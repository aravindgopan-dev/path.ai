"""Roadmap Agent — generates a simple, progressive step-by-step roadmap.

This agent:
1. Takes ONLY blueprint.json from the database as input
2. Generates 4-7 progressive levels based on file_structure_plan
3. Creates setup, learning, and coding nodes
4. Output includes project_id, total_levels, and levels array
5. No hosting/Docker/CI-CD - just simple web development
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_medium_llm
from app.utils.prompts import ROADMAP_SYSTEM, ROADMAP_USER
from app.schemas import NewRoadmapSchema


async def roadmap_planner_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: generate simple step-by-step roadmap from blueprint.
    
    Input: blueprint (dict) with:
      - project_id: Project identifier
      - file_structure_plan: Files to create (guides level organization)
      - learning_objectives: Skills to learn
      - tech_stack: Technologies
      - features: Project features
      - difficulty_target: User's skill level
    
    Output: Roadmap with project_id, total_levels, and levels array
    """
    llm = get_medium_llm(temperature=0.3)
    structured_llm = llm.with_structured_output(NewRoadmapSchema)

    blueprint = state.get("blueprint", {})

    messages = [
        SystemMessage(content=ROADMAP_SYSTEM),
        HumanMessage(
            content=ROADMAP_USER.format(
                blueprint_json=json.dumps(blueprint, indent=2),
            )
        ),
    ]

    content: NewRoadmapSchema = await structured_llm.ainvoke(messages)
    result = content.model_dump()

    return {
        "roadmap": result.get("levels", []),
        "project_id": result.get("project_id", blueprint.get("project_id", "")),
        "total_levels": result.get("total_levels", 0),
    }
