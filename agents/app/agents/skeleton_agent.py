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


async def generate_skeleton(
    blueprint: dict,
    node: dict,
    user_level: str,
    mode: str = "signature",
) -> dict[str, Any]:
    """Return partial file scaffolds.

    Parameters
    ----------
    mode : "signature" | "free"
        signature — provide 50% code scaffold with blanks (TODO markers)
        free      — provide minimal file creation only

    Output: { files: [ { filename, content } ] }
    """
    llm = get_medium_llm(temperature=0.3)

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

    response = await llm.ainvoke(messages)
    return _extract_json(response.content)


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
