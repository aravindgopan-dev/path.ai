"""Roadmap Agent — builds a level-based progressive learning/build roadmap."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.state import ProjectState
from app.utils.model_factory import get_medium_llm, get_small_llm
from app.utils.prompts import PLANNER_SYSTEM, PLANNER_USER, EXPECTED_SPEC_SYSTEM, EXPECTED_SPEC_USER, DOCUMENTATION_SYSTEM, DOCUMENTATION_USER
from app.schemas import RoadmapSchema, ExpectedSpecSchema, DocumentationSchema


async def roadmap_planner_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: generate high-level project roadmap and file tree."""
    llm = get_medium_llm(temperature=0.3)
    # Note: We use the full RoadmapSchema here because it defines the plan structure (nodes + file_tree)
    structured_llm = llm.with_structured_output(RoadmapSchema)

    blueprint = state.get("blueprint", {})
    level = state.get("user_level", "intermediate")
    skills = state.get("suggested_skills", [])

    messages = [
        SystemMessage(content=PLANNER_SYSTEM),
        HumanMessage(
            content=PLANNER_USER.format(
                level=level,
                blueprint_json=json.dumps(blueprint, indent=2),
                # We also pass skills for context
                skills_json=json.dumps(skills, indent=2),
            )
        ),
    ]

    content: RoadmapSchema = await structured_llm.ainvoke(messages)

    return {
        "roadmap": [node.model_dump() for node in content.nodes],
        "file_tree": [entry.model_dump() for entry in content.file_tree],
    }


async def spec_enricher_node(state: ProjectState) -> dict[str, Any]:
    """Batch enrich roadmap nodes with specs and documentation."""
    llm = get_small_llm(temperature=0.1)
    
    # Typed structured outputs
    spec_llm = llm.with_structured_output(ExpectedSpecSchema)
    docs_llm = llm.with_structured_output(DocumentationSchema)

    blueprint = state.get("blueprint", {})
    level = state.get("user_level", "intermediate")
    roadmap = state.get("roadmap", [])
    file_tree = state.get("file_tree", [])
    
    enriched_roadmap = []
    # Track nodes processed so far for sequential context
    processed_context = []
    
    for node in roadmap:
        node_copy = node.copy()
        node_type = node.get("type")
        node_id = node.get("id")
        
        # Prepare context for the LLM
        context_str = json.dumps(processed_context, indent=2)
        file_tree_str = json.dumps(file_tree, indent=2)

        if node_type == "code":
            # Generate spec
            spec_resp: ExpectedSpecSchema = await spec_llm.ainvoke([
                SystemMessage(content=EXPECTED_SPEC_SYSTEM),
                HumanMessage(content=EXPECTED_SPEC_USER.format(
                    blueprint_json=json.dumps(blueprint, indent=2),
                    node_json=json.dumps(node, indent=2),
                    level=level,
                    # Supplemental context
                    context=f"Previously planned nodes:\n{context_str}\n\nProject Structure:\n{file_tree_str}"
                ))
            ])
            node_copy["expected_spec"] = spec_resp.model_dump()
        
        elif node_type in ("learn", "setup"):
            # Generate docs
            docs_resp: DocumentationSchema = await docs_llm.ainvoke([
                SystemMessage(content=DOCUMENTATION_SYSTEM),
                HumanMessage(content=DOCUMENTATION_USER.format(
                    blueprint_json=json.dumps(blueprint, indent=2),
                    node_json=json.dumps(node, indent=2),
                    level=level,
                    # Supplemental context
                    context=f"Previously planned nodes:\n{context_str}\n\nProject Structure:\n{file_tree_str}"
                ))
            ])
            node_copy["documentation"] = docs_resp.model_dump()
            
        enriched_roadmap.append(node_copy)
        # Add basic info to context for next nodes
        processed_context.append({
            "id": node_id,
            "title": node.get("title"),
            "type": node_type
        })

    return {"roadmap": enriched_roadmap}
