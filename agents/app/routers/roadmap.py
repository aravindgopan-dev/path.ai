"""Roadmap router — POST /roadmap to generate simple step-by-step roadmap"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.graph import roadmap_graph
from app.auth import get_current_user
from app.db.database import get_db
from app.db.models import Project

router = APIRouter()


def _is_file_like_path(path: str) -> bool:
    candidate = str(path or "").strip()
    if not candidate or candidate.endswith("/"):
        return False

    leaf = candidate.split("/")[-1]
    if "." in leaf:
        return True

    return leaf in {
        "Dockerfile",
        "Makefile",
        "Procfile",
        "README",
        "LICENSE",
    }


def _extract_blueprint_file_paths(blueprint: dict) -> list[str]:
    plan = blueprint.get("file_structure_plan", []) if isinstance(blueprint, dict) else []
    if not isinstance(plan, list):
        return []

    file_paths: list[str] = []
    for item in plan:
        if not isinstance(item, dict):
            continue
        path = str(item.get("path", "")).strip()
        if not path or path.endswith("/"):
            continue
        item_type = str(item.get("type", "")).strip().lower()
        if item_type and item_type not in ("file", "f"):
            continue
        file_paths.append(path)
    return file_paths


def _enforce_file_coverage(levels: list[dict], blueprint: dict) -> list[dict]:
    required_files = _extract_blueprint_file_paths(blueprint)
    if not required_files:
        return levels

    present_files = {
        str(file_info.get("path", "")).strip()
        for level in levels
        if isinstance(level, dict)
        for file_info in (level.get("files") or [])
        if isinstance(file_info, dict) and str(file_info.get("path", "")).strip()
    }

    missing_files = [path for path in required_files if path not in present_files]
    if not missing_files:
        return levels

    coding_levels = [level for level in levels if isinstance(level, dict) and level.get("type") == "coding"]
    if not coding_levels:
        new_level_id = len(levels)
        new_level = {
            "level_id": new_level_id,
            "type": "coding",
            "title": "Integrate Remaining Project Files",
            "description": "Cover remaining files from the project file structure plan and complete wiring.",
            "tasks": [
                "Implement the remaining modules listed in file_structure_plan.",
                "Wire imports/exports and ensure files are connected in runtime.",
                "Run and verify all touched flows end-to-end.",
            ],
            "files": [{"path": path, "role": "create"} for path in missing_files],
            "terminal_commands": [],
            "validation_criteria": [
                "All listed files in this level exist in the project.",
                "All listed files are integrated into the project flow with valid imports/exports.",
            ],
        }
        return [*levels, new_level]

    for idx, file_path in enumerate(missing_files):
        target_level = coding_levels[idx % len(coding_levels)]
        target_files = target_level.setdefault("files", [])
        if not isinstance(target_files, list):
            target_level["files"] = []
            target_files = target_level["files"]
        target_files.append({"path": file_path, "role": "create"})

    return levels


def _apply_learning_mode(levels: list[dict], blueprint: dict) -> list[dict]:
    difficulty = str((blueprint or {}).get("difficulty_target", "beginner")).lower()
    learning_objectives = (blueprint or {}).get("learning_objectives") or []

    if difficulty == "advanced":
        filtered = [level for level in levels if isinstance(level, dict) and level.get("type") != "learning"]
        reindexed = []
        for new_id, level in enumerate(filtered):
            reindexed.append({**level, "level_id": new_id})
        return reindexed

    has_learning_level = any(isinstance(level, dict) and level.get("type") == "learning" for level in levels)
    if learning_objectives and not has_learning_level:
        fallback_learning_level = {
            "level_id": 1 if levels else 0,
            "type": "learning",
            "title": "Foundational Learning Module",
            "description": "Learn the core concepts needed before implementing project features.",
            "tasks": [
                f"Study: {objective}" for objective in learning_objectives[:5]
            ] or ["Study the foundational concepts for this project stack."],
            "files": [],
            "terminal_commands": [],
            "validation_criteria": [],
        }
        insert_index = 1 if len(levels) > 1 else len(levels)
        levels = [*levels[:insert_index], fallback_learning_level, *levels[insert_index:]]

    reindexed = []
    for new_id, level in enumerate(levels):
        if isinstance(level, dict):
            reindexed.append({**level, "level_id": new_id})
    return reindexed


class RoadmapRequest(BaseModel):
    """Roadmap generation request — takes blueprint only."""
    blueprint: dict
    user_level: str  # For backward compatibility, but difficulty_target from blueprint is preferred
    suggested_skills: list  # For backward compatibility


class RoadmapLevelOutput(BaseModel):
    """Single roadmap level."""
    level_id: int
    type: str  # setup|learning|coding
    title: str
    description: str
    tasks: list[str] = Field(default_factory=list)
    files: list[dict] = Field(default_factory=list)
    terminal_commands: list[str] = Field(default_factory=list)
    validation_criteria: list[str] = Field(default_factory=list)


class RoadmapResponse(BaseModel):
    """Roadmap response structure."""
    roadmap: list[RoadmapLevelOutput]
    project_id: str
    total_levels: int = 0


@router.post("/roadmap", response_model=RoadmapResponse)
async def generate_roadmap(
    body: RoadmapRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a simple step-by-step roadmap from the blueprint.
    
    This endpoint:
    1. Takes blueprint (already saved in DB with learning_objectives populated)
    2. Calls roadmap agent to generate levels based on file_structure_plan
    3. Returns roadmap with project_id and level array
    """
    if not body.blueprint:
        raise HTTPException(status_code=400, detail="blueprint must not be empty")

    # Call roadmap graph with blueprint only
    result = await roadmap_graph.ainvoke(
        {
            "blueprint": body.blueprint,
        }
    )

    levels = result.get("roadmap", [])

    # Normalize optional arrays from LLM output so response_model validation never sees None
    normalized_levels = []
    for level in levels:
        if not isinstance(level, dict):
            continue
        raw_files = level.get("files") or []
        normalized_files = []
        for file_item in raw_files:
            if not isinstance(file_item, dict):
                continue
            path = str(file_item.get("path", "")).strip()
            if not _is_file_like_path(path):
                continue
            normalized_files.append(
                {
                    "path": path,
                    "role": file_item.get("role", "create") or "create",
                }
            )

        normalized_levels.append(
            {
                **level,
                "tasks": level.get("tasks") or [],
                "files": normalized_files,
                "terminal_commands": level.get("terminal_commands") or [],
                "validation_criteria": level.get("validation_criteria") or [],
            }
        )

    levels = _apply_learning_mode(normalized_levels, body.blueprint)
    levels = _enforce_file_coverage(levels, body.blueprint)
    project_id = result.get("project_id", body.blueprint.get("project_id", ""))
    total_levels = len(levels)

    # Save roadmap to database
    if project_id:
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == user_id
        ).first()
        
        if project:
            # Save the complete roadmap
            roadmap_data = {
                "project_id": project_id,
                "total_levels": total_levels,
                "levels": levels,
            }
            project.set_roadmap(roadmap_data)
            db.commit()

    return {
        "roadmap": levels,
        "project_id": project_id,
        "total_levels": total_levels,
    }
