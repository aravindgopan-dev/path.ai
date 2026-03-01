/**
 * HTTP client for the Python agents backend.
 *
 * The base URL is read from the NEXT_PUBLIC_AGENTS_BASE_URL env var
 * (defaults to http://localhost:8000 in development).
 */

const AGENTS_BASE =
  process.env.NEXT_PUBLIC_AGENTS_BASE_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────

export interface AgentFeature {
  id: string;
  name: string;
  description: string;
}

export interface ArchitectResult {
  project_summary: string;
  features: AgentFeature[];
  tech_stack: string[];
}

export interface Blueprint {
  project_id: string;
  name: string;
  description: string;
  difficulty_target: string;
  tech_stack: string[];
  features: AgentFeature[];
  entities: Array<{ name: string; fields: string[] }>;
  api_contract: Array<{ method: string; path: string; description: string }>;
  file_structure_plan: Array<{
    path: string;
    type: "file" | "directory";
    description: string;
  }>;
  learning_objectives: string[];
  non_functional_requirements: Record<string, string>;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
}

export interface RoadmapNode {
  id: string;
  title: string;
  type: "setup" | "learn" | "code";
  description: string;
  dependencies?: string[];
  order_index: number;
  completed: boolean;
  locked: boolean;
  files: string[];
  validationCriteria: string[];
}

export interface RoadmapLevel {
  level_id: string;
  title: string;
  description: string;
  order: number;
  unlocked: boolean;
  nodes: RoadmapNode[];
}

export interface FileTreeEntry {
  path: string;
  type: "file" | "folder";
  children: FileTreeEntry[];
  linked_nodes: string[];
  is_completed?: boolean;
}

export interface Documentation {
  explanation: string;
  algorithm_steps: string[];
  common_mistakes: string[];
  implementation_strategy: string[];
}

export interface CompleteNodeResult {
  completed: boolean;
  node_id: string;
  level_completed: boolean;
  next_level_unlocked: boolean;
}

// ── Coding types ─────────────────────────────────

export interface Instruction {
  objective: string;
  constraints: string[];
  learning_focus: string[];
  files_involved: string[];
}

export interface SkeletonFile {
  filename: string;
  content: string;
}

export interface Skeleton {
  files: SkeletonFile[];
}

export interface ValidationResult {
  status: "pass" | "fail";
  missing_items: string[];
  notes: string[];
  score: number;
}

export interface Feedback {
  feedback_message: string;
  hints: string[];
  improvement_points: string[];
}

export interface ValidateResponse {
  validation: ValidationResult;
  feedback: Feedback;
}

export interface ChatResponse {
  response: string;
}

export interface ExpectedSpec {
  required_routes: string[];
  required_functions: string[];
  required_imports: string[];
  expected_files: string[];
  validation_rules: Array<string | { contains: string }>;
}

// ── API calls ────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${AGENTS_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Agents API error");
  }

  return res.json() as Promise<T>;
}

/** Step 1 — Analyse a raw project idea. */
export async function analyseIdea(idea: string): Promise<ArchitectResult> {
  return post<ArchitectResult>("/architect", { idea });
}

/** Step 2 — Generate full project blueprint. */
export async function generateBlueprint(params: {
  project_summary: string;
  selected_features: AgentFeature[];
  tech_stack: string[];
  user_level: string;
}): Promise<{ blueprint: Blueprint }> {
  return post<{ blueprint: Blueprint }>("/blueprint", params);
}

/** Step 3 — Assess conceptual skills. */
export async function assessSkills(params: {
  blueprint: Blueprint;
  user_level: string;
}): Promise<{ skills: Skill[] }> {
  return post<{ skills: Skill[] }>("/skills", params);
}

/** Step 4 — Generate learning roadmap (flat ordered). */
export async function generateRoadmap(params: {
  blueprint: Blueprint;
  user_level: string;
  suggested_skills: Skill[];
}): Promise<{ roadmap: RoadmapNode[]; project_id: string }> {
  return post<{ roadmap: RoadmapNode[]; project_id: string }>("/roadmap", params);
}

/** Fetch flat roadmap with completion status. */
export async function getFlatRoadmap(
  projectId: string,
): Promise<{ roadmap: RoadmapNode[]; project_id: string }> {
  const { levels, project_id } = await get<{
    levels: RoadmapLevel[];
    project_id: string;
  }>(`/project/${projectId}/roadmap-levels`);

  // Flatten levels → flat RoadmapNode[]
  let orderIndex = 0;
  const roadmap: RoadmapNode[] = [];

  const sorted = [...levels].sort((a, b) => a.order - b.order);
  for (const level of sorted) {
    const levelLocked = !level.unlocked;
    for (const node of level.nodes) {
      const meta = (node as any).metadata ?? {};
      roadmap.push({
        id: node.id,
        title: node.title,
        type: node.type,
        description: node.description,
        dependencies: node.dependencies ?? (node as any).dependencies ?? [],
        order_index: orderIndex++,
        completed: node.completed,
        locked: levelLocked && !node.completed,
        files: meta.files ?? (node as any).files ?? [],
        validationCriteria:
          meta.validationCriteria ??
          meta.validation_criteria ??
          (node as any).validationCriteria ??
          [],
      });
    }
  }

  return { roadmap, project_id };
}

// ── Coding endpoints ─────────────────────────────

/** Get structured instruction for a coding node. */
export async function getInstruction(
  nodeId: string,
  userLevel = "intermediate",
): Promise<{ instruction: Instruction }> {
  return post<{ instruction: Instruction }>(`/node/${nodeId}/instruction`, {
    user_level: userLevel,
  });
}

/** Get skeleton scaffold files for a coding node. */
export async function getSkeleton(
  nodeId: string,
  userLevel = "intermediate",
  mode: "signature" | "free" = "signature",
): Promise<{ skeleton: Skeleton }> {
  return post<{ skeleton: Skeleton }>(`/node/${nodeId}/skeleton`, {
    user_level: userLevel,
    mode,
  });
}

/** Validate user code and get feedback. */
export async function validateNode(
  nodeId: string,
  files: Array<{ filename: string; content: string }>,
): Promise<ValidateResponse> {
  return post<ValidateResponse>(`/node/${nodeId}/validate`, { files });
}

/** Chat about a specific node. */
export async function chatNode(
  nodeId: string,
  message: string,
  history: Array<{ role: string; content: string }> = [],
  userCode = "",
): Promise<ChatResponse> {
  return post<ChatResponse>(`/node/${nodeId}/chat`, {
    message,
    history,
    user_code: userCode,
  });
}

/** (Re)generate expected spec for a coding node. */
export async function regenerateSpec(
  nodeId: string,
  userLevel = "intermediate",
): Promise<{ expected_spec: ExpectedSpec }> {
  return post<{ expected_spec: ExpectedSpec }>(`/node/${nodeId}/regenerate-spec`, {
    user_level: userLevel,
  });
}

// ── Level / File-tree / Completion endpoints ─────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${AGENTS_BASE}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Agents API error");
  }

  return res.json() as Promise<T>;
}

/** Fetch level-based roadmap with completion status. */
export async function getRoadmapLevels(
  projectId: string,
): Promise<{ levels: RoadmapLevel[]; project_id: string }> {
  return get<{ levels: RoadmapLevel[]; project_id: string }>(
    `/project/${projectId}/roadmap-levels`,
  );
}

/** Fetch file tree with completion status. */
export async function getFileTree(
  projectId: string,
): Promise<{ file_tree: FileTreeEntry[]; progress: number }> {
  return get<{ file_tree: FileTreeEntry[]; progress: number }>(
    `/project/${projectId}/file-tree`,
  );
}

/** Mark a node as completed. */
export async function completeNode(
  nodeId: string,
): Promise<CompleteNodeResult> {
  return post<CompleteNodeResult>(`/node/${nodeId}/complete`, {});
}

/** Get documentation for a learn/setup node. */
export async function getDocumentation(
  nodeId: string,
): Promise<{ documentation: Documentation | null }> {
  return get<{ documentation: Documentation | null }>(
    `/node/${nodeId}/documentation`,
  );
}
