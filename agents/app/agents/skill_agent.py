"""Skill Assessment Agent — identifies high-level conceptual skills."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_medium_llm
from app.utils.prompts import SKILL_SYSTEM, SKILL_USER


async def skill_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: assess required conceptual skills.

    Reads  : state["blueprint"], state["user_level"]
    Writes : state["suggested_skills"]
    """
    llm = get_medium_llm(temperature=0.3)

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

    response = await llm.ainvoke(messages)
    parsed = _extract_json(response.content)

    return {"suggested_skills": parsed.get("skills", [])}


# ── helper ────────────────────────────────────────

def _extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from LLM response:\n{text[:500]}")
