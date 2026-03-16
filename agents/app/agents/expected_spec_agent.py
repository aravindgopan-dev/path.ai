"""Expected Spec Agent — generates detailed instructions for setup and coding nodes.

This agent ONLY works for setup and coding node types.
It takes node-specific data from the roadmap and generates:
- For SETUP: Step-by-step terminal commands and setup instructions
- For CODING: Technical requirements, file structure, and implementation steps
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import EXPECTED_SPEC_SYSTEM, EXPECTED_SPEC_USER
from app.schemas import NodeSpecSchema


async def generate_spec_for_node(
    node: dict,
    blueprint: dict,
) -> dict[str, Any]:
    """
    Generate detailed specification for a setup or coding node.
    
    Args:
        node: Node data from roadmap with:
              - level_id, type, title, description
              - tasks, files, terminal_commands (setup) or validation_criteria (coding)
        blueprint: Project blueprint with tech_stack, features, description, difficulty_target
    
    Returns:
        Dict with instructions/technical details for frontend rendering
    """
    node_type = node.get("type", "")
    
    # Only accept setup and coding nodes
    if node_type not in ("setup", "coding"):
        raise ValueError(f"Expected spec agent only works for 'setup' or 'coding' nodes, got '{node_type}'")
    
    llm = get_medium_llm(temperature=0.2)
    structured_llm = llm.with_structured_output(NodeSpecSchema)
    
    # Prepare node-specific data
    node_files = node.get("files", [])
    node_files_str = "\n".join(f"- {f.get('path', '')} (role: {f.get('role', '')})" for f in node_files)
    
    node_tasks = node.get("tasks", [])
    node_tasks_str = "\n".join(f"- {task}" for task in node_tasks)
    
    tech_stack = blueprint.get("tech_stack", [])
    tech_stack_str = ", ".join(tech_stack)
    
    # Setup-specific additions
    setup_specific = ""
    if node_type == "setup":
        terminal_commands = node.get("terminal_commands", [])
        setup_specific = f"Terminal Commands:\n" + "\n".join(f"- {cmd}" for cmd in terminal_commands)
    
    # Coding-specific additions
    if node_type == "coding":
        validation_criteria = node.get("validation_criteria", [])
        setup_specific = f"Validation Criteria:\n" + "\n".join(f"- {crit}" for crit in validation_criteria)
    
    messages = [
        SystemMessage(content=EXPECTED_SPEC_SYSTEM),
        HumanMessage(
            content=EXPECTED_SPEC_USER.format(
                node_type=node_type,
                node_title=node.get("title", ""),
                node_description=node.get("description", ""),
                node_tasks=node_tasks_str,
                node_files=node_files_str,
                setup_or_coding_specific=setup_specific,
                tech_stack=tech_stack_str,
                difficulty_target=blueprint.get("difficulty_target", "intermediate"),
                project_description=blueprint.get("description", ""),
            )
        ),
    ]

    content: NodeSpecSchema = await structured_llm.ainvoke(messages)
    return content.model_dump()
