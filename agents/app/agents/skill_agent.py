"""Skill Agent — generates beginner learning modules based on project blueprint.

Behavior:
1. If difficulty_target is "advanced": no learning assistance modules are returned.
2. If difficulty_target is "beginner": returns foundational modules aligned to project stack/features.
3. Ensures beginner modules include web basics + stack-specific basics.
"""

from __future__ import annotations

import re
from typing import Any

from app.state import ProjectState
from app.schemas import SkillSchema


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _append_unique_skill(skills: list[dict[str, str]], name: str, description: str) -> None:
    skill_id = _slugify(name)
    if not skill_id:
        return
    if any(existing["id"] == skill_id for existing in skills):
        return
    skills.append({"id": skill_id, "name": name, "description": description})


def _build_beginner_modules(blueprint: dict) -> list[dict[str, str]]:
    tech_stack = [str(item).lower() for item in (blueprint.get("tech_stack") or [])]
    features = blueprint.get("features") or []
    feature_text = " ".join(
        f"{item.get('name', '')} {item.get('description', '')}".lower()
        for item in features
        if isinstance(item, dict)
    )

    skills: list[dict[str, str]] = []

    _append_unique_skill(
        skills,
        "HTML Fundamentals",
        "Structure semantic pages using accessible HTML elements and forms.",
    )
    _append_unique_skill(
        skills,
        "CSS Fundamentals",
        "Build responsive layouts with CSS box model, flexbox, and spacing basics.",
    )
    _append_unique_skill(
        skills,
        "JavaScript Fundamentals",
        "Use variables, functions, arrays, objects, and async basics for web features.",
    )

    if any(keyword in tech_stack for keyword in ("react", "next.js", "nextjs")):
        _append_unique_skill(
            skills,
            "React Component Basics",
            "Create reusable components with props, state, and event handlers.",
        )

    if any(keyword in tech_stack for keyword in ("node", "node.js", "express", "fastapi", "django", "flask")):
        _append_unique_skill(
            skills,
            "REST API Basics",
            "Build simple CRUD endpoints and connect frontend requests to backend responses.",
        )

    if any(keyword in tech_stack for keyword in ("mongodb", "mongoose", "postgres", "mysql", "sqlite", "prisma")):
        _append_unique_skill(
            skills,
            "Database CRUD Basics",
            "Model data and implement create, read, update, and delete operations.",
        )

    if "jwt" in feature_text or "auth" in feature_text or "login" in feature_text or "signup" in feature_text:
        _append_unique_skill(
            skills,
            "JWT Authentication Basics",
            "Implement token-based login flow with protected routes and auth middleware basics.",
        )

    if len(skills) < 5:
        _append_unique_skill(
            skills,
            "Debugging and Developer Tools",
            "Use browser devtools and logs to diagnose UI, API, and state issues.",
        )

    return skills[:8]

async def skill_node(state: ProjectState) -> dict[str, Any]:
    """LangGraph node: return beginner modules or no modules for advanced mode."""
    blueprint = state.get("blueprint", {})
    difficulty = str(blueprint.get("difficulty_target", "beginner")).lower()

    if difficulty == "advanced":
        return {"suggested_skills": []}

    modules = _build_beginner_modules(blueprint)
    validated = [SkillSchema(**module).model_dump() for module in modules]
    return {"suggested_skills": validated}
