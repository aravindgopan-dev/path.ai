"""Validator Agent — AI-driven structural and logical comparison of user code against expected spec."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import VALIDATOR_SYSTEM, VALIDATOR_USER
from app.schemas import ValidationSchema


async def validate_code(
    blueprint: dict,
    node: dict,
    user_files: list[dict[str, str]],
    expected_spec: dict,
    node_objective: str = "",
) -> dict[str, Any]:
    """Compare submitted files against expected_spec using AI.

    Parameters
    ----------
    blueprint : dict - The project blueprint for context.
    node : dict - The current roadmap node.
    user_files : list of { "filename": str, "content": str }
    expected_spec : { required_routes, required_functions,
                      required_imports, expected_files, validation_rules }
    node_objective : str - The specific goal of this node.

    Returns
    -------
    { status: "pass" | "fail", missing_items: [...], notes: [...], score: int }
    """
    llm = get_medium_llm(temperature=0.1)  # Low temperature for strict grading
    structured_llm = llm.with_structured_output(ValidationSchema)

    # Prepare user code summary
    user_code_summary = "\n\n".join(
        f"--- {f.get('filename', 'unknown')} ---\n{f.get('content', '')}"
        for f in user_files
    )

    messages = [
        SystemMessage(content=VALIDATOR_SYSTEM),
        HumanMessage(
            content=VALIDATOR_USER.format(
                blueprint_json=json.dumps(blueprint, indent=2),
                objective=node_objective,
                spec_json=json.dumps(expected_spec, indent=2),
                user_code=user_code_summary,
            )
        ),
    ]

    result: ValidationSchema = await structured_llm.ainvoke(messages)
    return result.model_dump()
