"""Skeleton Agent — generates partial code scaffolds with TODO markers for coding nodes.

When user clicks "Help" on a coding node, this agent generates ~30-50% complete code
with function signatures, algorithm comments, and TODO gaps for the user to fill in.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import SKELETON_FREE_SYSTEM, SKELETON_FREE_USER
from app.schemas import SkeletonSchema


async def generate_skeleton_code(
    node: dict,
    blueprint: dict,
) -> dict[str, Any]:
    """
    Generate partial code skeleton with TODO markers and algorithm steps.
    
    This is invoked when user clicks the "Help" button on a coding node.
    Generated code is ~30-50% complete with:
    - Function signatures
    - Algorithm comments explaining the approach
    - TODO markers for key sections
    - Import statements and basic setup
    - Comments guiding the user on what to implement
    
    Args:
        node: Coding node from roadmap with:
              - level_id, type, title, description, tasks, files
        blueprint: Project blueprint with tech_stack, features, description, difficulty_target
    
    Returns:
        Dict with files array containing partial code skeletons
    """
    node_type = str(node.get("type", "")).lower()
    
    # Only skeleton code for coding nodes
    if node_type not in ("coding", "code"):
        raise ValueError(f"Skeleton agent only works for 'coding' nodes, got '{node_type}'")
    
    llm = get_medium_llm(temperature=0.3)
    structured_llm = llm.with_structured_output(SkeletonSchema)
    
    # Prepare node-specific data
    node_files = node.get("files", [])
    normalized_files: list[dict[str, str]] = []
    for file_item in node_files:
        if isinstance(file_item, dict):
            path = str(file_item.get("path", "")).strip()
            role = str(file_item.get("role", "create")).strip() or "create"
            if path:
                normalized_files.append({"path": path, "role": role})
        elif isinstance(file_item, str):
            path = file_item.strip()
            if path:
                normalized_files.append({"path": path, "role": "create"})

    node_files_str = "\n".join(
        f"- {file_info['path']} (role: {file_info['role']})"
        for file_info in normalized_files
    )
    
    node_tasks = node.get("tasks", [])
    node_tasks_str = "\n".join(f"- {task}" for task in node_tasks)
    
    tech_stack = blueprint.get("tech_stack", [])
    tech_stack_str = ", ".join(tech_stack)
    
    messages = [
        SystemMessage(content=SKELETON_FREE_SYSTEM),
        HumanMessage(
            content=SKELETON_FREE_USER.format(
                node_title=node.get("title", ""),
                node_description=node.get("description", ""),
                node_tasks=node_tasks_str,
                node_files=node_files_str,
                tech_stack=tech_stack_str,
                difficulty_target=blueprint.get("difficulty_target", "beginner"),
                blueprint_description=blueprint.get("description", ""),
                project_description=blueprint.get("description", ""),
            )
        ),
    ]

    content: SkeletonSchema = await structured_llm.ainvoke(messages)
    return content.model_dump()


async def generate_skeleton(
    blueprint: dict,
    node: dict,
    user_level: str,
    mode: str,
    user_code: str | None = None,
) -> dict[str, Any]:
    """
    Generate skeleton with user level and mode preferences.
    
    This is the main entry point for the skeleton agent, supporting both
    free (initial scaffold) and help (augmented with feedback) modes.
    
    Args:
        blueprint: Project blueprint with tech_stack, features, description, difficulty_target
        node: Coding node from roadmap
        user_level: User's skill level (e.g., "beginner", "intermediate", "advanced")
        mode: Generation mode - "free" for initial scaffold or "help" for augmented skeleton
        user_code: Optional user-written code to provide feedback on (used in "help" mode)
    
    Returns:
        Dict with files array containing generated skeleton code
    """
    # For now, both modes use the same generation logic
    # The user_level and mode parameters can be used in future enhancements
    # to customize the skeleton complexity or provide mode-specific guidance
    return await generate_skeleton_code(node=node, blueprint=blueprint)
