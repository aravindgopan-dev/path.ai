/**
 * HTTP client for the Python agents backend.
 *
 * The base URL is read from the NEXT_PUBLIC_AGENTS_BASE_URL env var
 * (defaults to http://localhost:8000 in development).
 */

const AGENTS_BASE =
  process.env.NEXT_PUBLIC_AGENTS_BASE_URL ?? "http://localhost:8000";

function getAgentsBaseCandidates(): string[] {
  const primary = AGENTS_BASE.replace(/\/+$/, "");
  const candidates = [primary];

  let primaryUrl: URL | null = null;
  try {
    primaryUrl = new URL(primary);
  } catch {
    primaryUrl = null;
  }

  if (primary.includes("localhost")) {
    candidates.push(primary.replace("localhost", "127.0.0.1"));
  } else if (primary.includes("127.0.0.1")) {
    candidates.push(primary.replace("127.0.0.1", "localhost"));
  }

  if (typeof window !== "undefined" && primaryUrl) {
    const runtimeHost = window.location.hostname;
    const runtimeProtocol = primaryUrl.protocol;
    const runtimePort = primaryUrl.port || "8000";
    const runtimeBase = `${runtimeProtocol}//${runtimeHost}:${runtimePort}`;
    candidates.push(runtimeBase);

    if (runtimeHost === "localhost") {
      candidates.push(`${runtimeProtocol}//127.0.0.1:${runtimePort}`);
    } else if (runtimeHost === "127.0.0.1") {
      candidates.push(`${runtimeProtocol}//localhost:${runtimePort}`);
    }
  }

  return Array.from(new Set(candidates));
}

async function fetchWithBaseFallback(path: string, init: RequestInit): Promise<Response> {
  const bases = getAgentsBaseCandidates();
  let lastError: unknown = null;

  for (const base of bases) {
    try {
      return await fetch(`${base}${path}`, init);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new TypeError("Failed to fetch");
}

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
  learning_objectives: string[] | null;
  non_functional_requirements: Record<string, string>;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  tech_stack: string[];
  created_at: string;
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
  resources?: Array<{ title: string; url: string; description: string }>;
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

// ── NEW ROADMAP FORMAT ────────────────────────

export interface RoadmapFileInfo {
  path: string;
  role: "primary" | "reference" | "create";
}

export interface GeneratedRoadmapLevel {
  level_id: number;
  type: "setup" | "learning" | "coding";
  title: string;
  description: string;
  tasks: string[];
  files: RoadmapFileInfo[];
  terminal_commands?: string[];
  validation_criteria?: string[];
}

export interface RoadmapOutput {
  roadmap: GeneratedRoadmapLevel[];
  project_id: string;
  total_levels: number;
}

// ── TUTOR DOCUMENTATION ──────────────────────

export interface TutorResource {
  title: string;
  url: string;
  description: string;
}

export interface TutorDocumentation {
  title: string;
  definition: string;
  why_it_matters: string;
  key_concepts: string[];
  resources: TutorResource[];
  example_code?: string;
  common_mistakes: string[];
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

  const res = await fetchWithBaseFallback(path, {
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
    suggested_features: AgentFeature[];
    recommended_tech_stack: string[];
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
  const result = await post<{ skills?: Skill[] } | null>("/skills", params, token);
  return { skills: Array.isArray(result?.skills) ? result.skills : [] };
}

export async function saveSelectedSkills(
  params: {
    project_id: string;
    selected_skills: Skill[];
  },
  token?: string,
): Promise<{ status: string; message: string; learning_objectives: string[] | null }> {
  return post<{ status: string; message: string; learning_objectives: string[] | null }>(
    "/skills/save",
    params,
    token
  );
}

export async function generateRoadmap(
  params: {
    blueprint: Blueprint;
    user_level: string;
    suggested_skills: Skill[];
  },
  token?: string,
): Promise<RoadmapOutput> {
  return post<RoadmapOutput>(
    "/roadmap",
    params,
    token
  );
}

export async function getTutorDocumentation(
  params: {
    level_title: string;
    level_description: string;
    level_tasks: string[];
    tech_stack: string[];
    difficulty_target: string;
  },
  token?: string,
): Promise<TutorDocumentation> {
  return post<TutorDocumentation>(
    "/tutor",
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
  userLevel = "beginner",
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
  userLevel = "beginner",
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
  userLevel = "beginner",
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
  userLevel = "beginner",
  token?: string,
): Promise<{ expected_spec: ExpectedSpec }> {
  return post<{ expected_spec: ExpectedSpec }>(
    `/node/${nodeId}/regenerate-spec`,
    { user_level: userLevel },
    token,
  );
}

// ── New Spec & Skeleton endpoints for Roadmap nodes ──────

export interface NodeSpecSetup {
  node_type: "setup";
  instructions: string[];
  files_to_create: string[];
  validation_steps: string[];
}

export interface NodeSpecCoding {
  node_type: "coding";
  task_overview: string;
  technical_requirements: string[];
  files_to_modify_or_create: string[];
  step_by_step_guide: string[];
  validation_criteria: string[];
}

export type NodeSpec = NodeSpecSetup | NodeSpecCoding;

export async function getSpecForLevel(
  projectId: string,
  levelId: number,
  token?: string,
): Promise<{ level_id: number; level_type: string; spec: NodeSpec }> {
  return post<{ level_id: number; level_type: string; spec: NodeSpec }>(
    "/node/spec",
    { project_id: projectId, level_id: levelId },
    token,
  );
}

export async function getSkeletonForLevel(
  projectId: string,
  levelId: number,
  token?: string,
): Promise<{ level_id: number; skeleton: Skeleton }> {
  return post<{ level_id: number; skeleton: Skeleton }>(
    "/node/skeleton",
    { project_id: projectId, level_id: levelId },
    token,
  );
}

// ── Level / File-tree / Completion endpoints ─────

async function get<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetchWithBaseFallback(path, {
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

// ── Projects endpoints ───────────────────────────

export async function getAllProjects(
  token?: string,
): Promise<{ projects: ProjectInfo[] }> {
  return get<{ projects: ProjectInfo[] }>("/projects", token);
}

export async function deleteProject(
  projectId: string,
  token?: string,
): Promise<{ status: string; project_id: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetchWithBaseFallback(`/project/${projectId}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to delete project");
  }

  return res.json() as Promise<{ status: string; project_id: string }>;
}
