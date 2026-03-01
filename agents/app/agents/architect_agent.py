"""Architect Agent — analyses a raw project idea and returns structured JSON."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_medium_llm
from app.utils.prompts import ARCHITECT_SYSTEM, ARCHITECT_USER


async def architect_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: process a raw project idea.

    Reads  : state["project_idea"]
    Writes : state["project_summary"], state["suggested_features"],
             state["recommended_tech_stack"]
    """
    idea = state["project_idea"]
    llm = get_medium_llm(temperature=0.3)

    messages = [
        SystemMessage(content=ARCHITECT_SYSTEM),
        HumanMessage(content=ARCHITECT_USER.format(idea=idea)),
    ]

    response = await llm.ainvoke(messages)
    content = _extract_json(response.content)

    return {
        "project_summary": content.get("project_summary", ""),
        "suggested_features": content.get("features", []),
        "recommended_tech_stack": content.get("tech_stack", []),
    }


# ── helper ────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Best-effort extraction of a JSON object from LLM output."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find the first { ... } block
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from LLM response:\n{text[:500]}")
