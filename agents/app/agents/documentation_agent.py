"""Documentation Agent — generates algorithmic explanations for learn/setup nodes."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import DOCUMENTATION_SYSTEM, DOCUMENTATION_USER


async def generate_documentation(
    blueprint: dict,
    node: dict,
    user_level: str,
) -> dict[str, Any]:
    """Return structured documentation for a learn/setup node.

    Output: {
        explanation,
        algorithm_steps: [],
        common_mistakes: [],
        implementation_strategy: []
    }
    """
    llm = get_medium_llm(temperature=0.3)

    messages = [
        SystemMessage(content=DOCUMENTATION_SYSTEM),
        HumanMessage(
            content=DOCUMENTATION_USER.format(
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
