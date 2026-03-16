"""Projects router — GET all projects, DELETE project."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Project
from app.auth import get_current_user

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


def _map_level_type(level_type: str) -> str:
    mapping = {
        "setup": "setup",
        "learning": "learn",
        "coding": "code",
    }
    return mapping.get(level_type, "code")


def _derive_file_tree_from_blueprint(blueprint: dict) -> list[dict]:
    plan = blueprint.get("file_structure_plan", [])
    if not isinstance(plan, list):
        return []

    tree: list[dict] = []
    for entry in plan:
        if not isinstance(entry, dict):
            continue
        path = str(entry.get("path", "")).strip()
        if not path:
            continue
        inferred_type = "folder" if path.endswith("/") else "file"
        tree.append(
            {
                "path": path,
                "type": inferred_type,
                "children": [],
                "linked_nodes": [],
                "is_completed": False,
            }
        )
    return tree


@router.get("/projects")
async def get_all_projects(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    """Get all projects for the current user."""
    projects = db.query(Project).filter(Project.user_id == user_id).all()
    
    return {
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description or "",
                "tech_stack": p.get_tech_stack(),
                "created_at": p.created_at.isoformat(),
            }
            for p in projects
        ]
    }


@router.delete("/project/{project_id}")
async def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    """Delete a project and all its nodes."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user_id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")
    
    db.delete(project)
    db.commit()
    
    return {"status": "deleted", "project_id": project_id}


@router.get("/project/{project_id}/roadmap-levels")
async def get_project_roadmap_levels(
    project_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Return roadmap levels in legacy UI-compatible shape: levels[].nodes[]."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user_id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")

    roadmap = project.get_roadmap() or {}
    raw_levels = roadmap.get("levels", []) if isinstance(roadmap, dict) else []

    first_incomplete_index = next(
        (idx for idx, item in enumerate(raw_levels) if isinstance(item, dict) and not bool(item.get("completed", False))),
        None,
    )

    levels = []
    for order, level in enumerate(raw_levels):
        if not isinstance(level, dict):
            continue

        level_id = level.get("level_id", order)
        files = level.get("files") or []
        file_paths = [
            file_item.get("path")
            for file_item in files
            if isinstance(file_item, dict)
            and file_item.get("path")
            and _is_file_like_path(str(file_item.get("path", "")))
        ]

        node_id = f"{project_id}:level:{level_id}"
        node_type = _map_level_type(str(level.get("type", "coding")))
        completed = bool(level.get("completed", False))
        if first_incomplete_index is None:
            unlocked = True
        else:
            unlocked = completed or order == first_incomplete_index

        levels.append(
            {
                "level_id": str(level_id),
                "title": level.get("title", f"Level {order + 1}"),
                "description": level.get("description", ""),
                "order": order,
                "unlocked": unlocked,
                "nodes": [
                    {
                        "id": node_id,
                        "title": level.get("title", f"Level {order + 1}"),
                        "type": node_type,
                        "description": level.get("description", ""),
                        "level": order,
                        "dependencies": [],
                        "unlock_after": [],
                        "completed": completed,
                        "locked": not unlocked,
                        "files": file_paths,
                        "metadata": {
                            "tasks": level.get("tasks") or [],
                            "terminal_commands": level.get("terminal_commands") or [],
                            "validation_criteria": level.get("validation_criteria") or [],
                        },
                    }
                ],
            }
        )

    return {
        "project_id": project_id,
        "levels": levels,
    }


@router.get("/project/{project_id}/file-tree")
async def get_project_file_tree(
    project_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Return project file tree and progress for roadmap explorer views."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user_id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")

    file_tree = project.get_file_tree()
    if file_tree is None:
        blueprint = project.get_blueprint()
        file_tree = _derive_file_tree_from_blueprint(blueprint)

    return {
        "file_tree": file_tree,
        "progress": 0,
    }
