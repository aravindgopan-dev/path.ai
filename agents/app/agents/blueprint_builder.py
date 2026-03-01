"""Blueprint Builder — generates a full project blueprint from selected features."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_large_llm
from app.utils.prompts import BLUEPRINT_SYSTEM, BLUEPRINT_USER


async def blueprint_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: generate project blueprint.

    Reads  : state["project_summary"], state["selected_features"],
             state["recommended_tech_stack"], state["user_level"]
    Writes : state["blueprint"]
    """
    llm = get_large_llm(temperature=0.2)

    features = state.get("selected_features", [])
    tech_stack = state.get("recommended_tech_stack", [])
    summary = state.get("project_summary", "")
    level = state.get("user_level", "intermediate")

    features_text = "\n".join(
        f"- {f['name']}: {f['description']}" for f in features
    )

    messages = [
        SystemMessage(content=BLUEPRINT_SYSTEM),
        HumanMessage(
            content=BLUEPRINT_USER.format(
                name=summary.split(".")[0] if summary else "Untitled Project",
                description=summary,
                tech_stack=", ".join(tech_stack) if tech_stack else "To be decided",
                difficulty=level,
                features_text=features_text or "No features selected",
            )
        ),
    ]

    response = await llm.ainvoke(messages)
    blueprint = _extract_json(response.content)

    # Ensure pass-through of selected features
    blueprint["features"] = features

    return {"blueprint": blueprint}


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
