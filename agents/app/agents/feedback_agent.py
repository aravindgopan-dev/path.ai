"""Feedback Agent — produces human-friendly feedback from validation results."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_small_llm
from app.utils.prompts import FEEDBACK_SYSTEM, FEEDBACK_USER


async def generate_feedback(
    validation_result: dict,
    user_code_summary: str,
    expected_spec: dict,
    node_objective: str,
) -> dict[str, Any]:
    """Return { feedback_message, hints, improvement_points }."""
    llm = get_small_llm(temperature=0.4)

    messages = [
        SystemMessage(content=FEEDBACK_SYSTEM),
        HumanMessage(
            content=FEEDBACK_USER.format(
                validation_json=json.dumps(validation_result, indent=2),
                user_code=user_code_summary[:3000],
                spec_json=json.dumps(expected_spec, indent=2),
                objective=node_objective,
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

    # Graceful fallback — return the raw text as the message
    return {
        "feedback_message": text.strip(),
        "hints": [],
        "improvement_points": [],
    }
