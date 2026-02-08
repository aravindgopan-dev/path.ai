import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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

    // Roadmap/Level Actions
    completeLevel: (levelNumber: number) => void;
    unlockLevel: (levelNumber: number) => void;

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
                }),

            completeLevel: (levelNumber) =>
                set((state) => {
                    if (!state.projectSpec) return state;
                    const newLevels = state.projectSpec.levels.map((l) =>
                        l.level === levelNumber ? { ...l, completed: true } : l
                    );
                    return {
                        projectSpec: {
                            ...state.projectSpec,
                            levels: newLevels,
                        },
                    };
                }),

            unlockLevel: (levelNumber) =>
                set((state) => {
                    if (!state.projectSpec) return state;
                    const newLevels = state.projectSpec.levels.map((l) =>
                        l.level === levelNumber ? { ...l, locked: false } : l
                    );
                    return {
                        projectSpec: {
                            ...state.projectSpec,
                            levels: newLevels,
                        },
                    };
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
            }),
            onRehydrateStorage: (state) => {
                return () => state.setHasHydrated(true);
            },
        }
    )
);
