"""Roadmap Agent — builds a level-based progressive learning/build roadmap."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_medium_llm
from app.utils.prompts import ROADMAP_SYSTEM, ROADMAP_USER


async def roadmap_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: generate project roadmap with level-based structure.

    Reads  : state["blueprint"], state["user_level"], state["suggested_skills"]
    Writes : state["roadmap"]
    """
    llm = get_medium_llm(temperature=0.3)

    blueprint = state.get("blueprint", {})
    level = state.get("user_level", "intermediate")
    skills = state.get("suggested_skills", [])

    messages = [
        SystemMessage(content=ROADMAP_SYSTEM),
        HumanMessage(
            content=ROADMAP_USER.format(
                level=level,
                skills_json=json.dumps(skills, indent=2),
                blueprint_json=json.dumps(blueprint, indent=2),
            )
        ),
    ]

    response = await llm.ainvoke(messages)
    parsed = _extract_json(response.content)

    return {"roadmap": parsed.get("levels", [])}


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
