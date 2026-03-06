"""Blueprint Builder — generates a full project blueprint from selected features."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_large_llm
from app.utils.prompts import BLUEPRINT_SYSTEM, BLUEPRINT_USER
from app.schemas import BlueprintSchema


async def blueprint_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: generate project blueprint."""
    llm = get_large_llm(temperature=0.2)
    structured_llm = llm.with_structured_output(BlueprintSchema)

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

    content: BlueprintSchema = await structured_llm.ainvoke(messages)
    blueprint = content.model_dump()

    # Ensure pass-through of selected features
    blueprint["features"] = features

    return {"blueprint": blueprint}
