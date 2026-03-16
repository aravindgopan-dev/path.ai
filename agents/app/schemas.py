from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class FeatureSchema(BaseModel):
    id: str = Field(..., description="Unique slug for the feature (e.g., 'user-auth')")
    name: str = Field(..., description="Human-readable name")
    description: str = Field(..., description="Detailed description of what the feature does")


class ArchitectSchema(BaseModel):
    project_summary: str = Field(..., description="A concise summary of the project goals")
    features: List[FeatureSchema] = Field(..., description="List of suggested core features")
    tech_stack: List[str] = Field(..., description="Recommended technology stack (e.g., ['Next.js', 'FastAPI'])")


class MilestoneSchema(BaseModel):
    title: str = Field(..., description="Title of the milestone")
    description: str = Field(..., description="What this milestone achieves")


class BlueprintSchema(BaseModel):
    name: str = Field(..., description="Formal project name")
    description: str = Field(..., description="Detailed project description")
    architecture_overview: str = Field(..., description="Summary of the technical architecture")
    milestones: List[MilestoneSchema] = Field(..., description="Key project milestones")
    entities: List[EntitySchema] = Field(..., description="Data entities/models")
    api_contract: List[APIEndpointSchema] = Field(..., description="API contract definitions")
    file_structure_plan: List[FileStructurePlanSchema] = Field(..., description="File and directory structure plan")
    non_functional_requirements: NonFunctionalRequirementsSchema = Field(default_factory=dict, description="Non-functional requirements")


class SkillSchema(BaseModel):
    id: str = Field(..., description="Unique slug for the skill")
    name: str = Field(..., description="Name of the skill")
    description: str = Field(..., description="Why this skill is relevant for the project")


class DocumentationSchema(BaseModel):
    explanation: str = Field(..., description="In-depth conceptual explanation")
    objective: str = Field(default="", description="The main goal of this task/node")
    algorithm_steps: List[str] = Field(default_factory=list, description="Computational or logic steps / Implementation guide")
    constraints: List[str] = Field(default_factory=list, description="Technical constraints or rules")
    learning_focus: List[str] = Field(default_factory=list, description="What the student should focus on learning")
    common_mistakes: List[str] = Field(default_factory=list, description="Things beginners get wrong here")
    implementation_strategy: List[str] = Field(default_factory=list, description="Best practices for implementation")
    files_involved: List[str] = Field(default_factory=list, description="Files the student will create or modify")
    resources: List[TutorResourceSchema] = Field(default_factory=list, description="Official docs and related learning resources")


class ValidationRuleSchema(BaseModel):
    contains: str = Field(..., description="String or pattern to look for")
    reason: str = Field(..., description="Why this check matters pedagogically")


class ExpectedSpecSchema(BaseModel):
    required_routes: List[str] = Field(default_factory=list, description="Endpoints that must exist")
    required_functions: List[str] = Field(default_factory=list, description="Functions or classes that must be defined")
    required_imports: List[str] = Field(default_factory=list, description="Modules that must be imported")
    expected_files: List[str] = Field(default_factory=list, description="Files that should be present")
    validation_rules: List[ValidationRuleSchema] = Field(default_factory=list, description="Specific pattern-match rules for validation with pedagogical reasons")


class FileTreeEntrySchema(BaseModel):
    path: str = Field(..., description="Relative path (e.g., 'src/main.py')")
    type: str = Field(..., description="'file' or 'folder'")
    children: Optional[List[FileTreeEntrySchema]] = Field(None, description="Nested entries (folders only)")
    linked_nodes: List[str] = Field(default_factory=list, description="IDs of roadmap nodes related to this path")


class RoadmapNodeSchema(BaseModel):
    id: str = Field(..., description="Unique ID for the node")
    title: str = Field(..., description="Human-readable title")
    description: str = Field(..., description="Detailed learning or task description")
    type: str = Field(..., description="Type of node: 'setup', 'learning', or 'coding'")
    level: int = Field(..., description="Topological level (0-indexed)")
    dependencies: List[str] = Field(default_factory=list, description="IDs of nodes this node depends on")
    
    # For 'coding' nodes
    algorithm_steps: Optional[List[str]] = Field(None, description="Step-by-step logic for coding tasks")
    validation_rules: Optional[List[ValidationRuleSchema]] = Field(None, description="Evaluation metrics/patterns")
    files: Optional[List[str]] = Field(None, description="Files involved in this coding task")
    blueprint_spec: Optional[ExpectedSpecSchema] = Field(None, description="Technical spec (optional if inferred from above)")

    # For 'setup' nodes
    setup_commands: Optional[List[str]] = Field(None, description="Linux/CLI commands for environment setup")

    # For 'learning' nodes
    learning_metadata: Optional[DocumentationSchema] = Field(None, description="Metadata for detailed documentation generation")


class RoadmapSchema(BaseModel):
    nodes: List[RoadmapNodeSchema] = Field(..., description="Complete list of roadmap nodes")
    file_tree: List[FileTreeEntrySchema] = Field(..., description="Full project file tree")


class SkeletonFileSchema(BaseModel):
    filename: str = Field(..., description="Path/name of the file")
    content: str = Field(..., description="Boilerplate or signature-only content")


class SkeletonSchema(BaseModel):
    files: List[SkeletonFileSchema] = Field(..., description="List of scaffold files")


class ValidationSchema(BaseModel):
    status: str = Field(..., description="'pass' or 'fail'")
    score: int = Field(..., description="0-100 score of completion/quality")
    missing_items: List[str] = Field(default_factory=list, description="Specific items that are incorrect or missing")
    notes: List[str] = Field(default_factory=list, description="General observations or edge cases")


class FeedbackSchema(BaseModel):
    feedback_message: str = Field(..., description="Encouraging but critical feedback for the user")
    hints: List[str] = Field(default_factory=list, description="Specific hints to help them fix the issues")
    improvement_points: List[str] = Field(default_factory=list, description="What could be better even if it passed")


class ChatResponseSchema(BaseModel):
    response: str = Field(..., description="The AI assistant's response message")


# ──────────────────────────────────────────────
# NEW ROADMAP FORMAT (Redesigned)
# ──────────────────────────────────────────────

class RoadmapFileSchema(BaseModel):
    path: str = Field(..., description="File path relative to project root")
    role: str = Field(..., description="Role of file: primary|reference|create")


class RoadmapLevelSchema(BaseModel):
    level_id: int = Field(..., description="Unique level ID (0-indexed)")
    type: str = Field(..., description="Type: setup|learning|coding")
    title: str = Field(..., description="Level title")
    description: str = Field(..., description="Detailed description")
    tasks: List[str] = Field(default_factory=list, description="Task descriptions")
    files: List[RoadmapFileSchema] = Field(default_factory=list, description="Files involved")
    terminal_commands: Optional[List[str]] = Field(None, description="CLI commands for setup types")
    validation_criteria: Optional[List[str]] = Field(None, description="Validation rules for coding types")


class NewRoadmapSchema(BaseModel):
    project_id: str = Field(..., description="Project ID")
    total_levels: int = Field(..., description="Total number of levels")
    levels: List[RoadmapLevelSchema] = Field(..., description="Array of roadmap levels")


# ──────────────────────────────────────────────
# TUTOR DOCUMENTATION FORMAT
# ──────────────────────────────────────────────

class TutorResourceSchema(BaseModel):
    title: str = Field(..., description="Resource title")
    url: str = Field(..., description="Resource URL")
    description: str = Field(..., description="Brief description")


class TutorDocumentationSchema(BaseModel):
    title: str = Field(..., description="Topic title")
    definition: str = Field(..., description="1-2 sentence definition")
    why_it_matters: str = Field(..., description="Why this matters for the project")
    key_concepts: List[str] = Field(..., description="3-5 key concepts")
    resources: List[TutorResourceSchema] = Field(..., description="External learning resources")
    example_code: Optional[str] = Field(None, description="Example code snippet")
    common_mistakes: List[str] = Field(default_factory=list, description="Common beginner mistakes")


# ───────────────────────────────────────────────
# EXPECTED SPEC FOR SETUP/CODING NODES
# ───────────────────────────────────────────────

class SetupSpecSchema(BaseModel):
    """Spec for setup-type roadmap nodes."""
    instructions: List[str] = Field(..., description="Step-by-step setup instructions")
    files_to_create: List[str] = Field(default_factory=list, description="Files to create/initialize")
    validation_steps: List[str] = Field(default_factory=list, description="How to verify setup worked")


class CodingSpecSchema(BaseModel):
    """Spec for coding-type roadmap nodes."""
    task_overview: str = Field(..., description="Clear summary of what to implement")
    technical_requirements: List[str] = Field(default_factory=list, description="Specific functions/components/endpoints needed")
    files_to_modify_or_create: List[str] = Field(default_factory=list, description="Which files to work on")
    step_by_step_guide: List[str] = Field(default_factory=list, description="Detailed implementation steps")
    validation_criteria: List[str] = Field(default_factory=list, description="What success looks like")


class NodeSpecSchema(BaseModel):
    """Combined spec for setup or coding nodes - returned by expected_spec_agent."""
    node_type: str = Field(..., description="'setup' or 'coding'")
    # For setup nodes:
    instructions: Optional[List[str]] = Field(None, description="Step-by-step setup instructions")
    files_to_create: Optional[List[str]] = Field(None, description="Files to create/initialize")
    validation_steps: Optional[List[str]] = Field(None, description="How to verify setup worked")
    # For coding nodes:
    task_overview: Optional[str] = Field(None, description="Clear summary of what to implement")
    technical_requirements: Optional[List[str]] = Field(None, description="Specific functions/components/endpoints needed")
    files_to_modify_or_create: Optional[List[str]] = Field(None, description="Which files to work on")
    step_by_step_guide: Optional[List[str]] = Field(None, description="Detailed implementation steps")
    validation_criteria: Optional[List[str]] = Field(None, description="What success looks like")

class EntitySchema(BaseModel):
    name: str = Field(..., description="Name of the data entity/model")
    attributes: dict[str, str] = Field(default_factory=dict, description="Attributes of the entity, with type hints")


class APIEndpointSchema(BaseModel):
    path: str = Field(..., description="API route path (e.g., /users/{id})")
    method: str = Field(..., description="HTTP method (e.g., GET, POST)")
    description: str = Field(..., description="What this endpoint does")


class FileStructurePlanSchema(BaseModel):
    path: str = Field(..., description="File or directory path")
    description: str = Field(..., description="Purpose of the file/directory")


class NonFunctionalRequirementsSchema(BaseModel):
    security: str = Field(default="", description="Security considerations")
    performance: str = Field(default="", description="Performance goals")
    scalability: str = Field(default="", description="Scalability requirements")
