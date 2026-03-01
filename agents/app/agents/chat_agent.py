"""Chat Agent — node-scoped conversational assistant."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.utils.model_factory import get_small_llm
from app.utils.prompts import CHAT_SYSTEM, CHAT_USER


async def chat_with_node(
    blueprint_summary: str,
    node_objective: str,
    user_code: str,
    history: list[dict[str, str]],
    message: str,
) -> dict[str, Any]:
    """Return { response: str } scoped to the current node only.

    history: last 5 messages as [{ role, content }]
    """
    llm = get_small_llm(temperature=0.5)

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

    response = await llm.ainvoke(messages)
    content = response.content.strip() if hasattr(response, "content") else str(response).strip()

    return {"response": content}
