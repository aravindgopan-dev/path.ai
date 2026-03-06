from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.state import ProjectState
from app.utils.model_factory import get_medium_llm
from app.utils.prompts import SKILL_SYSTEM, SKILL_USER
from app.schemas import SkillSchema

class SkillsResponse(BaseModel):
    skills: list[SkillSchema] = Field(..., description="List of assessed skills")

async def skill_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: assess required conceptual skills."""
    llm = get_medium_llm(temperature=0.3)
    structured_llm = llm.with_structured_output(SkillsResponse)

    blueprint = state.get("blueprint", {})
    level = state.get("user_level", "intermediate")

    messages = [
        SystemMessage(content=SKILL_SYSTEM),
        HumanMessage(
            content=SKILL_USER.format(
                level=level,
                blueprint_json=json.dumps(blueprint, indent=2),
            )
        ),
    ]

    content: SkillsResponse = await structured_llm.ainvoke(messages)

    return {"suggested_skills": [s.model_dump() for s in content.skills]}
