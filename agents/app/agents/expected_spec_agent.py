"""Expected Spec Agent — generates structural spec (NOT full code) for a coding node."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import EXPECTED_SPEC_SYSTEM, EXPECTED_SPEC_USER


async def generate_expected_spec(
    blueprint: dict,
    node: dict,
    user_level: str,
) -> dict[str, Any]:
    """Return structural spec for validation.

    Output: {
        required_routes, required_functions, required_imports,
        expected_files, validation_rules
    }
    """
    llm = get_medium_llm(temperature=0.2)

    messages = [
        SystemMessage(content=EXPECTED_SPEC_SYSTEM),
        HumanMessage(
            content=EXPECTED_SPEC_USER.format(
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
