"""Tutor Agent — generates learning documentation for a specific level.

This agent:
1. Takes a learning level (title, description, tasks)
2. Takes project context (tech_stack, difficulty_target)
3. Generates engaging learning documentation with:
   - Simple definitions
   - Key concepts
   - Official resources with links
   - Code examples (optional)
   - Common mistakes
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_small_llm
from app.utils.prompts import TUTOR_SYSTEM, TUTOR_USER
from app.schemas import TutorDocumentationSchema


async def generate_tutor_documentation(
    level_title: str,
    level_description: str,
    level_tasks: list[str],
    tech_stack: list[str],
    difficulty_target: str,
) -> dict[str, Any]:
    """Generate learning documentation for a specific learning level.
    
    Args:
        level_title: Title of the learning level
        level_description: Description of what to learn
        level_tasks: List of specific tasks in this level
        tech_stack: Project's technology stack
        difficulty_target: User's difficulty level (beginner/intermediate/pro)
    
    Returns:
        Dict with learning documentation
    """
    llm = get_small_llm(temperature=0.3)
    structured_llm = llm.with_structured_output(TutorDocumentationSchema)

    tasks_str = "\n".join(f"- {task}" for task in level_tasks)

    messages = [
        SystemMessage(content=TUTOR_SYSTEM),
        HumanMessage(
            content=TUTOR_USER.format(
                title=level_title,
                description=level_description,
                tasks=tasks_str,
                tech_stack=", ".join(tech_stack),
                difficulty_target=difficulty_target,
            )
        ),
    ]

    content: TutorDocumentationSchema = await structured_llm.ainvoke(messages)

    return content.model_dump()
