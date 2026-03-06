"""LangGraph state-graph definitions.

Each flow (architect, blueprint, skill, roadmap) is exposed as its own
compiled graph so that FastAPI routes can invoke them independently.
"""

from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.state import ProjectState
from app.agents.architect_agent import architect_node
from app.agents.blueprint_builder import blueprint_node
from app.agents.skill_agent import skill_node
from app.agents.roadmap_agent import roadmap_planner_node, spec_enricher_node


# ──────────────────────────────────────────────
# Architect flow
# ──────────────────────────────────────────────

def build_architect_graph():
    g = StateGraph(ProjectState)
    g.add_node("architect", architect_node)
    g.set_entry_point("architect")
    g.add_edge("architect", END)
    return g.compile()


# ──────────────────────────────────────────────
# Blueprint flow
# ──────────────────────────────────────────────

def build_blueprint_graph():
    g = StateGraph(ProjectState)
    g.add_node("blueprint_builder", blueprint_node)
    g.set_entry_point("blueprint_builder")
    g.add_edge("blueprint_builder", END)
    return g.compile()


# ──────────────────────────────────────────────
# Skill assessment flow
# ──────────────────────────────────────────────

def build_skill_graph():
    g = StateGraph(ProjectState)
    g.add_node("skill", skill_node)
    g.set_entry_point("skill")
    g.add_edge("skill", END)
    return g.compile()


# ──────────────────────────────────────────────
# Roadmap flow
# ──────────────────────────────────────────────

def build_roadmap_graph():
    g = StateGraph(ProjectState)
    g.add_node("planner", roadmap_planner_node)
    g.add_node("enricher", spec_enricher_node)
    
    g.set_entry_point("planner")
    g.add_edge("planner", "enricher")
    g.add_edge("enricher", END)
    return g.compile()


# Pre-compile so they can be imported directly
architect_graph = build_architect_graph()
blueprint_graph = build_blueprint_graph()
skill_graph = build_skill_graph()
roadmap_graph = build_roadmap_graph()
