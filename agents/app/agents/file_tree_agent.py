"""File Tree Agent — generates a project file tree linked to roadmap nodes."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import FILE_TREE_SYSTEM, FILE_TREE_USER


async def generate_file_tree(
    blueprint: dict,
    levels: list[dict],
) -> list[dict[str, Any]]:
    """Return a file tree linked to roadmap nodes.

    Output: [
        { path, type: "file"|"folder", children: [], linked_nodes: [] }
    ]
    """
    llm = get_medium_llm(temperature=0.2)

    messages = [
        SystemMessage(content=FILE_TREE_SYSTEM),
        HumanMessage(
            content=FILE_TREE_USER.format(
                blueprint_json=json.dumps(blueprint, indent=2),
                levels_json=json.dumps(levels, indent=2),
            )
        ),
    ]

    response = await llm.ainvoke(messages)
    parsed = _extract_json(response.content)
    return parsed.get("file_tree", [])


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
