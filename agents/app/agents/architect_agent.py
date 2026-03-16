"""Architect Agent — analyses a raw project idea and returns structured JSON.

This agent:
1. Analyzes the raw project idea
2. Detects if a tech stack is explicitly mentioned in the prompt
3. If mentioned: uses the specified technologies
4. If not mentioned: recommends suitable technologies based on project type
5. Returns structured output with project summary, features, and tech stack
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_small_llm
from app.utils.prompts import ARCHITECT_SYSTEM, ARCHITECT_USER
from app.schemas import ArchitectSchema


async def architect_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: process a raw project idea with intelligent tech stack handling.
    
    Tech Stack Handling:
    - If the project idea explicitly mentions technologies, those are used
    - If no technologies are mentioned, the agent recommends suitable ones
    - Returns consistent output format regardless of tech stack source
    """
    idea = state["project_idea"]
    llm = get_small_llm(temperature=0.2)
    
    # Standardize via structured output
    structured_llm = llm.with_structured_output(ArchitectSchema)

    messages = [
        SystemMessage(content=ARCHITECT_SYSTEM),
        HumanMessage(content=ARCHITECT_USER.format(idea=idea)),
    ]

    content: ArchitectSchema = await structured_llm.ainvoke(messages)
    
    # Ensure tech_stack is not empty - add fallback if needed
    tech_stack = content.tech_stack if content.tech_stack else ["React", "Node.js"]

    return {
        "project_summary": content.project_summary,
        "suggested_features": [f.model_dump() for f in content.features],
        "recommended_tech_stack": tech_stack,
    }
