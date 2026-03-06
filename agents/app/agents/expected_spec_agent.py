"""Expected Spec Agent — generates structural spec (NOT full code) for a coding node."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import EXPECTED_SPEC_SYSTEM, EXPECTED_SPEC_USER
from app.schemas import ExpectedSpecSchema


async def generate_expected_spec(
    blueprint: dict,
    node: dict,
    user_level: str,
    context: str = "No additional context.",
) -> dict[str, Any]:
    """Return structural spec for validation with context awareness."""
    llm = get_medium_llm(temperature=0.2)
    structured_llm = llm.with_structured_output(ExpectedSpecSchema)

    messages = [
        SystemMessage(content=EXPECTED_SPEC_SYSTEM),
        HumanMessage(
            content=EXPECTED_SPEC_USER.format(
                blueprint_json=json.dumps(blueprint, indent=2),
                node_json=json.dumps(node, indent=2),
                level=user_level,
                context=context,
            )
        ),
    ]

    content: ExpectedSpecSchema = await structured_llm.ainvoke(messages)
    return content.model_dump()
