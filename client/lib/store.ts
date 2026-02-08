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
            fileHistory: [],

            // Actions
            setProjectSpec: (spec) => set({ projectSpec: spec }),

            setCurrentFile: (file) => set({ currentFile: file }),

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
                fileHistory: state.fileHistory,
            }),
            onRehydrateStorage: (state) => {
                return () => state.setHasHydrated(true);
            },
        }
    )
);
