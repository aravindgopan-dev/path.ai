"""Chat Agent — node-scoped conversational assistant."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_small_llm
from app.utils.prompts import CHAT_SYSTEM, CHAT_USER
from app.schemas import ChatResponseSchema


async def chat_with_node(
    blueprint_summary: str,
    node_objective: str,
    user_code: str,
    history: list[dict[str, str]],
    message: str,
) -> dict[str, Any]:
    """Return { response: str } scoped to the current node only."""
    llm = get_small_llm(temperature=0.5)
    structured_llm = llm.with_structured_output(ChatResponseSchema)

    history_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in (history or [])[-5:]
    )

    messages = [
        SystemMessage(content=CHAT_SYSTEM),
        HumanMessage(
            content=CHAT_USER.format(
                blueprint_summary=blueprint_summary[:2000],
                objective=node_objective,
                user_code=user_code[:3000],
                history=history_text,
                message=message,
            )
        ),
    ]

    content: ChatResponseSchema = await structured_llm.ainvoke(messages)
    return content.model_dump()
