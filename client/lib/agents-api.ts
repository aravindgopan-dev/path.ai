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
  level: number;
  dependencies?: string[];
  unlock_after?: string[];
  completed: boolean;
  locked: boolean;
  // Integrated data
  expected_spec?: ExpectedSpec;
  documentation?: Documentation;
  metadata?: Record<string, any>;
  files?: string[];
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
  title?: string;
  explanation: string;
  objective: string;
  algorithm_steps: string[];
  setup_commands?: string[];
  constraints: string[];
  learning_focus: string[];
  common_mistakes: string[];
  implementation_strategy: string[];
  files_involved: string[];
}

export interface CompleteNodeResult {
  completed: boolean;
  node_id: string;
  level_completed: boolean;
  next_level_unlocked: boolean;
}

// ── Coding types ─────────────────────────────────

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

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${AGENTS_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Agents API error");
  }

  return res.json() as Promise<T>;
}

export async function analyseIdea(idea: string, token?: string): Promise<ArchitectResult> {
  return post<ArchitectResult>("/architect", { idea }, token);
}

export async function generateBlueprint(
  params: {
    project_summary: string;
    selected_features: AgentFeature[];
    tech_stack: string[];
    user_level: string;
  },
  token?: string,
): Promise<{ blueprint: Blueprint }> {
  return post<{ blueprint: Blueprint }>("/blueprint", params, token);
}


export async function assessSkills(
  params: {
    blueprint: Blueprint;
    user_level: string;
  },
  token?: string,
): Promise<{ skills: Skill[] }> {
  return post<{ skills: Skill[] }>("/skills", params, token);
}

export async function generateRoadmap(
  params: {
    blueprint: Blueprint;
    user_level: string;
    suggested_skills: Skill[];
  },
  token?: string,
): Promise<{ roadmap: RoadmapNode[]; project_id: string; file_tree: FileTreeEntry[] }> {
  return post<{ roadmap: RoadmapNode[]; project_id: string; file_tree: FileTreeEntry[] }>(
    "/roadmap",
    params,
    token
  );
}

export async function getFlatRoadmap(
  projectId: string,
  token?: string,
): Promise<{ roadmap: RoadmapNode[]; project_id: string }> {
  const { levels, project_id } = await get<{
    levels: RoadmapLevel[];
    project_id: string;
  }>(`/project/${projectId}/roadmap-levels`, token);

  // Flatten levels → flat RoadmapNode[]
  const roadmap: RoadmapNode[] = [];

  const sortedLevels = [...levels].sort((a, b) => (a as any).order - (b as any).order);
  for (const level of sortedLevels) {
    const levelLocked = !level.unlocked;
    for (const node of level.nodes) {
      roadmap.push({
        ...node,
        locked: levelLocked && !node.completed,
      });
    }
  }

  return { roadmap, project_id };
}

// ── Coding endpoints ─────────────────────────────

export async function getInstruction(
  nodeId: string,
  userLevel = "intermediate",
  token?: string,
): Promise<{ instruction: Documentation }> {
  return post<{ instruction: Documentation }>(
    `/node/${nodeId}/instruction`,
    { user_level: userLevel },
    token,
  );
}

export async function getSkeleton(
  nodeId: string,
  userLevel = "intermediate",
  mode: "free" | "help" = "free",
  token?: string,
): Promise<{ skeleton: Skeleton }> {
  return post<{ skeleton: Skeleton }>(
    `/node/${nodeId}/skeleton`,
    { user_level: userLevel, mode },
    token,
  );
}

export async function getHelp(
  nodeId: string,
  files: Array<{ filename: string; content: string }>,
  userLevel = "intermediate",
  token?: string,
): Promise<{ skeleton: Skeleton }> {
  return post<{ skeleton: Skeleton }>(
    `/node/${nodeId}/help`,
    { user_level: userLevel, files },
    token,
  );
}

export async function validateNode(
  nodeId: string,
  files: Array<{ filename: string; content: string }>,
  token?: string,
): Promise<ValidateResponse> {
  return post<ValidateResponse>(`/node/${nodeId}/validate`, { files }, token);
}

export async function chatNode(
  nodeId: string,
  message: string,
  history: Array<{ role: string; content: string }> = [],
  userCode = "",
  token?: string,
): Promise<ChatResponse> {
  return post<ChatResponse>(
    `/node/${nodeId}/chat`,
    {
      message,
      history,
      user_code: userCode,
    },
    token,
  );
}

export async function regenerateSpec(
  nodeId: string,
  userLevel = "intermediate",
  token?: string,
): Promise<{ expected_spec: ExpectedSpec }> {
  return post<{ expected_spec: ExpectedSpec }>(
    `/node/${nodeId}/regenerate-spec`,
    { user_level: userLevel },
    token,
  );
}

// ── Level / File-tree / Completion endpoints ─────

async function get<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${AGENTS_BASE}${path}`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Agents API error");
  }

  return res.json() as Promise<T>;
}

export async function getRoadmapLevels(
  projectId: string,
  token?: string,
): Promise<{ levels: RoadmapLevel[]; project_id: string }> {
  return get<{ levels: RoadmapLevel[]; project_id: string }>(
    `/project/${projectId}/roadmap-levels`,
    token,
  );
}

export async function getFileTree(
  projectId: string,
  token?: string,
): Promise<{ file_tree: FileTreeEntry[]; progress: number }> {
  return get<{ file_tree: FileTreeEntry[]; progress: number }>(
    `/project/${projectId}/file-tree`,
    token,
  );
}

export async function completeNode(
  nodeId: string,
  token?: string,
): Promise<CompleteNodeResult> {
  return post<CompleteNodeResult>(`/node/${nodeId}/complete`, {}, token);
}

export async function getDocumentation(
  nodeId: string,
  token?: string,
): Promise<{ documentation: Documentation | null }> {
  return get<{ documentation: Documentation | null }>(
    `/node/${nodeId}/documentation`,
    token,
  );
}
