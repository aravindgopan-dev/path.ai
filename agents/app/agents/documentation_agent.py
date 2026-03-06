"""Documentation Agent — generates algorithmic explanations for learn/setup nodes."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_medium_llm
from app.utils.prompts import DOCUMENTATION_SYSTEM, DOCUMENTATION_USER
from app.schemas import DocumentationSchema


async def generate_documentation(
    blueprint: dict,
    node: dict,
    user_level: str,
    context: str = "No additional context.",
) -> dict[str, Any]:
    """Return structured documentation for a node with context awareness."""
    llm = get_medium_llm(temperature=0.3)
    structured_llm = llm.with_structured_output(DocumentationSchema)

    messages = [
        SystemMessage(content=DOCUMENTATION_SYSTEM),
        HumanMessage(
            content=DOCUMENTATION_USER.format(
                blueprint_json=json.dumps(blueprint, indent=2),
                node_json=json.dumps(node, indent=2),
                level=user_level,
                context=context,
            )
        ),
    ]

    content: DocumentationSchema = await structured_llm.ainvoke(messages)
    return content.model_dump()
