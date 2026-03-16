"""Blueprint Builder — generates a full project blueprint from architect output and level selection.

This agent:
1. Takes architect output (project_summary, suggested_features, recommended_tech_stack)
2. Takes user's selected level
3. Generates comprehensive blueprint with:
   - project_id (generated)
   - name (extracted from summary)
   - description (project_summary)
   - tech_stack (from architect)
   - features (from architect)
   - entities (data models)
   - api_contract (API routes)
   - file_structure_plan (project structure)
    - learning_objectives (empty for beginner, null for advanced)
   - non_functional_requirements (security, testing, deployment)
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_medium_llm
from app.utils.prompts import BLUEPRINT_SYSTEM, BLUEPRINT_USER
from app.schemas import BlueprintSchema


async def blueprint_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: generate project blueprint from architect output and level."""
    llm = get_medium_llm(temperature=0.2)
    structured_llm = llm.with_structured_output(BlueprintSchema, method="function_calling")

    features = state.get("suggested_features", [])
    tech_stack = state.get("recommended_tech_stack", [])
    summary = state.get("project_summary", "")
    level = str(state.get("user_level", "beginner")).lower()

    features_text = "\n".join(
        f"- {f['name']}: {f['description']}" for f in features
    )

    # Extract project name from summary (first sentence or first 50 chars)
    project_name = summary.split(".")[0] if summary else "Untitled Project"

    messages = [
        SystemMessage(content=BLUEPRINT_SYSTEM),
        HumanMessage(
            content=BLUEPRINT_USER.format(
                name=project_name,
                description=summary,
                tech_stack=", ".join(tech_stack) if tech_stack else "To be decided",
                difficulty=level,
                features_text=features_text or "No features selected",
            )
        ),
    ]

    content: BlueprintSchema = await structured_llm.ainvoke(messages)
    blueprint = content.model_dump()

    # Generate project_id if not already present
    if "project_id" not in blueprint:
        blueprint["project_id"] = str(uuid.uuid4())

    # Ensure correct structure
    blueprint["description"] = summary  # Use architect's summary as description
    blueprint["features"] = features    # Pass through architect's features
    blueprint["tech_stack"] = tech_stack  # Pass through architect's tech stack
    blueprint["learning_objectives"] = None if level == "advanced" else []
    blueprint["difficulty_target"] = level  # Set difficulty_target to user's selected level
    
    return {"blueprint": blueprint}
