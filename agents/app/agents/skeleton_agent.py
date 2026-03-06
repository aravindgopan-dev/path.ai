"""Skeleton Agent — generates partial file scaffolds for a coding node.

Supports two modes:
  - "signature" : 50% code scaffold with TODO markers
  - "free"      : minimal file creation only
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import (
    SKELETON_SYSTEM,
    SKELETON_USER,
    SKELETON_FREE_SYSTEM,
    SKELETON_FREE_USER,
)
from app.schemas import SkeletonSchema


async def generate_skeleton(
    blueprint: dict,
    node: dict,
    user_level: str,
    mode: str = "signature",
) -> dict[str, Any]:
    """Return partial file scaffolds."""
    llm = get_medium_llm(temperature=0.3)
    structured_llm = llm.with_structured_output(SkeletonSchema)

    if mode == "free":
        system_prompt = SKELETON_FREE_SYSTEM
        user_prompt = SKELETON_FREE_USER
    else:
        system_prompt = SKELETON_SYSTEM
        user_prompt = SKELETON_USER

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(
            content=user_prompt.format(
                blueprint_json=json.dumps(blueprint, indent=2),
                node_json=json.dumps(node, indent=2),
                level=user_level,
            )
        ),
    ]

    content: SkeletonSchema = await structured_llm.ainvoke(messages)
    return content.model_dump()
