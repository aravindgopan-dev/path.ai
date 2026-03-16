"""Validator Agent — AI-driven structural and logical comparison of user code against expected spec."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import VALIDATOR_SYSTEM, VALIDATOR_USER
from app.schemas import ValidationSchema


async def validate_code(
    node: dict,
    user_files: list[dict[str, str]],
    validation_criteria: list[str],
    node_objective: str = "",
) -> dict[str, Any]:
    """Compare submitted files against node validation_criteria using AI.

    Parameters
    ----------
    node : dict - The current roadmap node.
    user_files : list of { "filename": str, "content": str }
    validation_criteria : list[str] - Criteria to validate for this node.
    node_objective : str - The specific goal of this node.

    Returns
    -------
    { status: "pass" | "fail", missing_items: [...], notes: [...], score: int }
    """
    if not validation_criteria:
        return {
            "status": "fail",
            "score": 0,
            "missing_items": ["No validation_criteria configured for this node."],
            "notes": [
                "This node is missing validation criteria in the roadmap metadata.",
                "Regenerate the node spec or roadmap to populate validation_criteria before validating.",
            ],
        }

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
                node_json=json.dumps(node, indent=2),
                objective=node_objective,
                criteria_json=json.dumps(validation_criteria, indent=2),
                user_code=user_code_summary,
            )
        ),
    ]

    result: ValidationSchema = await structured_llm.ainvoke(messages)
    return result.model_dump()
