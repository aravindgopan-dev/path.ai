"""Shared LangGraph state definition."""

from __future__ import annotations

from typing import TypedDict


class ProjectState(TypedDict, total=False):
    """State that flows through every node in the graph."""

    # Input from the user
    project_idea: str
    selected_features: list          # list[FeatureDict]
    user_level: str                  # "beginner" | "intermediate" | "pro"

    # Architect output
    project_summary: str
    suggested_features: list         # list[{id, name, description}]
    recommended_tech_stack: list     # list[str]

    # Blueprint output
    blueprint: dict

    # Skill assessment output
    suggested_skills: list           # list[{id, name, description}]

    # Roadmap output — level-based progressive structure
    roadmap: list                    # list[Node dict]
    file_tree: list                  # list[FileTreeEntry dict]
