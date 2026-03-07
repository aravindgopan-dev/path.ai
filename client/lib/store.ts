import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
    Blueprint,
    Skill,
    RoadmapNode,
    RoadmapLevel,
    FileTreeEntry,
    Documentation,
    AgentFeature,
    Skeleton,
    ValidationResult,
    Feedback,
} from '@/lib/agents-api';

// Types
export interface Feature {
    id: string;
    name: string;
    description: string;
    category?: string;
}

export interface Level {
    level: number;
    title: string;
    description: string;
    files: string[];
    validationCriteria: string[]; // Key requirements to verify completion
    completed?: boolean;
    locked?: boolean;
}

export interface TreeNode {
    name: string;
    type: 'file' | 'directory';
    language?: string;
    description?: string;
    children?: TreeNode[];
}

export interface ProjectSpec {
    projectName: string;
    description: string;
    features: Feature[];
    levels: Level[];
    designerInput: {
        nodes: TreeNode[];
    };
    projectMarkdown: string;
}

export interface FileData {
    name: string;
    language: string;
    description: string;
    content: string;
    path?: string; // Optional file path in the tree
}

interface AppState {
    // Project specification from architect
    projectSpec: ProjectSpec | null;
    setProjectSpec: (spec: ProjectSpec | null) => void;

    // ── New agents-backed state ──────────────────────
    blueprint: Blueprint | null;
    setBlueprint: (bp: Blueprint | null) => void;

    userLevel: string; // "beginner" | "intermediate" | "pro"
    setUserLevel: (level: string) => void;

    suggestedSkills: Skill[];
    setSuggestedSkills: (skills: Skill[]) => void;

    roadmapNodes: RoadmapNode[];
    setRoadmapNodes: (nodes: RoadmapNode[]) => void;

    // ── Level-based roadmap state ────────────────────
    roadmapLevels: RoadmapLevel[];
    setRoadmapLevels: (levels: RoadmapLevel[]) => void;

    currentLevelId: string | null;
    setCurrentLevelId: (id: string | null) => void;

    completedNodes: string[];
    markNodeCompleted: (nodeId: string) => void;

    fileTree: FileTreeEntry[];
    setFileTree: (tree: FileTreeEntry[]) => void;

    documentation: Documentation | null;
    setDocumentation: (doc: Documentation | null) => void;

    // Architect flow summary
    projectSummary: string;
    setProjectSummary: (s: string) => void;

    techStack: string[];
    setTechStack: (ts: string[]) => void;

    // ── Coding / node state ──────────────────────────
    projectId: string | null;
    setProjectId: (id: string | null) => void;

    activeNodeId: string | null;
    setActiveNodeId: (id: string | null) => void;

    // Use Documentation for instructions as well
    instruction: Documentation | null;
    setInstruction: (i: Documentation | null) => void;

    skeletonFiles: Skeleton | null;
    setSkeletonFiles: (s: Skeleton | null) => void;

    validationResult: ValidationResult | null;
    setValidationResult: (v: ValidationResult | null) => void;

    feedback: Feedback | null;
    setFeedback: (f: Feedback | null) => void;

    chatHistory: Array<{ role: string; content: string }>;
    setChatHistory: (h: Array<{ role: string; content: string }>) => void;
    addChatMessage: (msg: { role: string; content: string }) => void;
    clearChatHistory: () => void;
    // ─────────────────────────────────────────────────

    // Current file being edited
    currentFile: FileData | null;
    setCurrentFile: (file: FileData | null) => void;

    // Files currently open in tabs
    openFiles: FileData[];
    setOpenFiles: (files: FileData[]) => void;
    addOpenFile: (file: FileData) => void;
    removeOpenFile: (fileName: string) => void;

    // File history for navigation
    fileHistory: FileData[];
    addToHistory: (file: FileData) => void;
    clearHistory: () => void;

    // Reset all state
    resetAll: () => void;

    // Hydration tracking
    _hasHydrated: boolean;
    setHasHydrated: (state: boolean) => void;
}

const defaultFile: FileData = {
    name: 'untitled.ts',
    language: 'typescript',
    description: 'New file',
    content: '// Start coding here...',
};

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // Initial state
            projectSpec: null,
            currentFile: defaultFile,
            openFiles: [defaultFile],
            fileHistory: [],

            // ── New agents state defaults ──
            blueprint: null,
            userLevel: 'intermediate',
            suggestedSkills: [],
            roadmapNodes: [],
            roadmapLevels: [],
            currentLevelId: null,
            completedNodes: [],
            fileTree: [],
            documentation: null,
            projectSummary: '',
            techStack: [],

            // ── New agents setters ──
            setBlueprint: (bp) => set({ blueprint: bp }),
            setUserLevel: (level) => set({ userLevel: level }),
            setSuggestedSkills: (skills) => set({ suggestedSkills: skills }),
            setRoadmapNodes: (nodes) => set({ roadmapNodes: nodes }),
            setRoadmapLevels: (levels) => set({ roadmapLevels: levels }),
            setCurrentLevelId: (id) => set({ currentLevelId: id }),
            markNodeCompleted: (nodeId) =>
                set((state) => {
                    if (!state.completedNodes.includes(nodeId)) {
                        return { completedNodes: [...state.completedNodes, nodeId] };
                    }
                    return state;
                }),
            setFileTree: (tree) => set({ fileTree: tree }),
            setDocumentation: (doc) => set({ documentation: doc }),
            setProjectSummary: (s) => set({ projectSummary: s }),
            setTechStack: (ts) => set({ techStack: ts }),

            // ── Coding state defaults + setters ──
            projectId: null,
            setProjectId: (id) => set({ projectId: id }),

            activeNodeId: null,
            setActiveNodeId: (id) => set({
                activeNodeId: id,
                // Reset per-node transient state when switching nodes
                instruction: null,
                feedback: null,
                chatHistory: [],
                documentation: null,
            }),

            instruction: null,
            setInstruction: (i: Documentation | null) => set({ instruction: i }),

            skeletonFiles: null,
            setSkeletonFiles: (s) => set({ skeletonFiles: s }),

            validationResult: null,
            setValidationResult: (v) => set({ validationResult: v }),

            feedback: null,
            setFeedback: (f) => set({ feedback: f }),

            chatHistory: [],
            setChatHistory: (h) => set({ chatHistory: h }),
            addChatMessage: (msg) =>
                set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
            clearChatHistory: () => set({ chatHistory: [] }),

            // Actions
            setProjectSpec: (spec) => set({ projectSpec: spec }),

            setCurrentFile: (file) =>
                set((state) => ({
                    currentFile: file,
                    openFiles: file
                        ? state.openFiles.map(f => f.name === file.name ? file : f)
                        : state.openFiles
                })),

            setOpenFiles: (files) => set({ openFiles: files }),

            addOpenFile: (file) =>
                set((state) => ({
                    openFiles: state.openFiles.some((f) => f.name === file.name)
                        ? state.openFiles
                        : [...state.openFiles, file],
                })),

            removeOpenFile: (fileName) =>
                set((state) => {
                    const newOpenFiles = state.openFiles.filter((f) => f.name !== fileName);
                    const newCurrentFile =
                        state.currentFile?.name === fileName
                            ? newOpenFiles[newOpenFiles.length - 1] || null
                            : state.currentFile;
                    return {
                        openFiles: newOpenFiles,
                        currentFile: newCurrentFile,
                    };
                }),

            addToHistory: (file) =>
                set((state) => ({
                    fileHistory: [
                        ...state.fileHistory.filter((f) => f.name !== file.name),
                        file,
                    ].slice(-10), // Keep last 10 files
                })),

            clearHistory: () => set({ fileHistory: [] }),

            resetAll: () =>
                set({
                    projectSpec: null,
                    currentFile: defaultFile,
                    openFiles: [defaultFile],
                    fileHistory: [],
                    blueprint: null,
                    userLevel: 'intermediate',
                    suggestedSkills: [],
                    roadmapNodes: [],
                    roadmapLevels: [],
                    currentLevelId: null,
                    completedNodes: [],
                    fileTree: [],
                    documentation: null,
                    projectSummary: '',
                    techStack: [],
                    projectId: null,
                    activeNodeId: null,
                    instruction: null,
                    skeletonFiles: null,
                    validationResult: null,
                    feedback: null,
                    chatHistory: [],
                }),

            _hasHydrated: false,
            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'app-storage', // Storage key
            storage: createJSONStorage(() => localStorage), // Use localStorage
            partialize: (state) => ({
                // Only persist these fields
                projectSpec: state.projectSpec,
                currentFile: state.currentFile,
                openFiles: state.openFiles,
                fileHistory: state.fileHistory,
                blueprint: state.blueprint,
                userLevel: state.userLevel,
                suggestedSkills: state.suggestedSkills,
                roadmapNodes: state.roadmapNodes,
                roadmapLevels: state.roadmapLevels,
                currentLevelId: state.currentLevelId,
                completedNodes: state.completedNodes,
                fileTree: state.fileTree,
                projectSummary: state.projectSummary,
                techStack: state.techStack,
                projectId: state.projectId,
                activeNodeId: state.activeNodeId,
            }),
            onRehydrateStorage: (state) => {
                return () => state.setHasHydrated(true);
            },
        }
    )
);
