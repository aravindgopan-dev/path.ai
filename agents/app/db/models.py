"""SQLAlchemy ORM models for lightweight node metadata persistence."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True, default="")
    tech_stack_json = Column(Text, nullable=False, default="[]")
    blueprint_json = Column(Text, nullable=False, default="{}")
    roadmap_json = Column(Text, nullable=True)  # Stores generated roadmap
    file_tree_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    nodes = relationship("RoadmapNodeModel", back_populates="project", cascade="all, delete-orphan")
    level_contents = relationship("LevelNodeContentModel", back_populates="project", cascade="all, delete-orphan")

    # ── helpers ───────────────────────────────────
    def set_blueprint(self, data: dict) -> None:
        self.blueprint_json = json.dumps(data)

    def get_blueprint(self) -> dict:
        return json.loads(self.blueprint_json or "{}")

    def set_tech_stack(self, stack: list) -> None:
        self.tech_stack_json = json.dumps(stack)

    def get_tech_stack(self) -> list:
        return json.loads(self.tech_stack_json or "[]")

    def set_file_tree(self, data: list) -> None:
        self.file_tree_json = json.dumps(data)

    def get_file_tree(self) -> list | None:
        if not self.file_tree_json:
            return None
        return json.loads(self.file_tree_json)

    def set_roadmap(self, data: dict) -> None:
        self.roadmap_json = json.dumps(data)

    def get_roadmap(self) -> dict | None:
        if not self.roadmap_json:
            return None
        return json.loads(self.roadmap_json)


class RoadmapNodeModel(Base):
    __tablename__ = "roadmap_nodes"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)           # setup | learn | code | milestone
    description = Column(Text, nullable=False, default="")
    level_id = Column(String, nullable=True)
    level_order = Column(Integer, nullable=True)
    completed = Column(Boolean, nullable=False, default=False)
    dependencies_json = Column(Text, nullable=False, default="[]")
    unlock_after_json = Column(Text, nullable=False, default="[]")
    metadata_json = Column(Text, nullable=False, default="{}")
    expected_spec_json = Column(Text, nullable=True)
    documentation_json = Column(Text, nullable=True)
    instruction_json = Column(Text, nullable=True)
    skeleton_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    project = relationship("Project", back_populates="nodes")

    # ── helpers ───────────────────────────────────
    def get_dependencies(self) -> list[str]:
        return json.loads(self.dependencies_json or "[]")

    def set_dependencies(self, deps: list[str]) -> None:
        self.dependencies_json = json.dumps(deps)

    def get_unlock_after(self) -> list[str]:
        return json.loads(self.unlock_after_json or "[]")

    def set_unlock_after(self, ids: list[str]) -> None:
        self.unlock_after_json = json.dumps(ids)

    def get_metadata(self) -> dict:
        return json.loads(self.metadata_json or "{}")

    def set_metadata(self, data: dict) -> None:
        self.metadata_json = json.dumps(data)

    def get_expected_spec(self) -> dict | None:
        if not self.expected_spec_json:
            return None
        return json.loads(self.expected_spec_json)

    def set_expected_spec(self, spec: dict) -> None:
        self.expected_spec_json = json.dumps(spec)

    def get_documentation(self) -> dict | None:
        if not self.documentation_json:
            return None
        return json.loads(self.documentation_json)

    def set_documentation(self, doc: dict) -> None:
        self.documentation_json = json.dumps(doc)

    def get_instruction(self) -> dict | None:
        if not self.instruction_json:
            return None
        return json.loads(self.instruction_json)

    def set_instruction(self, instruction: dict) -> None:
        self.instruction_json = json.dumps(instruction)

    def get_skeleton(self) -> dict | None:
        if not self.skeleton_json:
            return None
        return json.loads(self.skeleton_json)

    def set_skeleton(self, skeleton: dict) -> None:
        self.skeleton_json = json.dumps(skeleton)


class LevelNodeContentModel(Base):
    """Cached generated content for synthetic roadmap level nodes (<project_id>:level:<level_id>)."""

    __tablename__ = "level_node_contents"
    __table_args__ = (UniqueConstraint("project_id", "level_id", name="uq_level_node_content_project_level"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    level_id = Column(Integer, nullable=False, index=True)
    node_type = Column(String, nullable=False, default="coding")

    instruction_json = Column(Text, nullable=True)
    documentation_json = Column(Text, nullable=True)
    expected_spec_json = Column(Text, nullable=True)
    skeleton_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    project = relationship("Project", back_populates="level_contents")

    def get_instruction(self) -> dict | None:
        if not self.instruction_json:
            return None
        return json.loads(self.instruction_json)

    def set_instruction(self, instruction: dict) -> None:
        self.instruction_json = json.dumps(instruction)

    def get_documentation(self) -> dict | None:
        if not self.documentation_json:
            return None
        return json.loads(self.documentation_json)

    def set_documentation(self, documentation: dict) -> None:
        self.documentation_json = json.dumps(documentation)

    def get_expected_spec(self) -> dict | None:
        if not self.expected_spec_json:
            return None
        return json.loads(self.expected_spec_json)

    def set_expected_spec(self, expected_spec: dict) -> None:
        self.expected_spec_json = json.dumps(expected_spec)

    def get_skeleton(self) -> dict | None:
        if not self.skeleton_json:
            return None
        return json.loads(self.skeleton_json)

    def set_skeleton(self, skeleton: dict) -> None:
        self.skeleton_json = json.dumps(skeleton)
