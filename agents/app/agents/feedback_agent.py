"""Feedback Agent — produces human-friendly feedback from validation results."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import FEEDBACK_SYSTEM, FEEDBACK_USER
from app.schemas import FeedbackSchema


async def generate_feedback(
    validation_result: dict,
    user_code_summary: str,
    expected_spec: dict,
    node_objective: str,
) -> dict[str, Any]:
    """Return structured feedback."""
    llm = get_medium_llm(temperature=0.4)
    structured_llm = llm.with_structured_output(FeedbackSchema)

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

    content: FeedbackSchema = await structured_llm.ainvoke(messages)
    return content.model_dump()
