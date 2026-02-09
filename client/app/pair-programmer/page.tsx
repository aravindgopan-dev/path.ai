"use client"

import { useState, useEffect, useRef } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { html } from "@codemirror/lang-html"
import { css } from "@codemirror/lang-css"
import { json } from "@codemirror/lang-json"
import dynamic from "next/dynamic"
import {
  MessageCircle,
  BookOpen,
  Terminal as TerminalIcon,
  X,
  Code2,
  Zap,
  FileCode,
  Lightbulb,
} from "lucide-react"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {  Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"
import { getSocket } from "@/lib/socket"
import { type CodeGenerationResponse, type FileCode } from "@/lib/agents/pair-programmer"

const XTerminal = dynamic(
  () => import("@/components/terminal").then((mod) => ({ default: mod.XTerminal })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading terminal...
      </div>
    ),
  }
)

type SidebarTab = "docs"
type CodeMode = "free" | "pseudo" | "scaffold"

interface FileData {
  name: string;
  language: string;
  description: string;
  content: string;
}

export default function PairProgrammer() {
  const [activeTab, setActiveTab] = useState<SidebarTab>("docs")
  const [codeMode, setCodeMode] = useState<CodeMode>("free")
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<CodeGenerationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  
  // Use Zustand store for current file
  const currentFile = useAppStore((state) => state.currentFile);
  const setCurrentFile = useAppStore((state) => state.setCurrentFile);
  const openFiles = useAppStore((state) => state.openFiles);
  const removeOpenFile = useAppStore((state) => state.removeOpenFile);
  const projectSpec = useAppStore((state) => state.projectSpec);
  const _hasHydrated = useAppStore((state) => state._hasHydrated);
  
  // Editor view ref for CodeMirror (optional, for advanced use)
  const editorViewRef = useRef<any>(null);
  const generationAttemptedRef = useRef(false);

  // Fetch generated code when component mounts
  useEffect(() => {
    if (!projectSpec || !openFiles || openFiles.length === 0 || generationAttemptedRef.current) {
      return;
    }

    generationAttemptedRef.current = true;
    generateCode();
  }, [projectSpec, openFiles, _hasHydrated]);

  const generateCode = async () => {
    if (!projectSpec || !openFiles || openFiles.length === 0) return;

    setIsLoading(true);
    setLoadingError(null);

    try {
      // Find the current level based on open files
      const levelFileNames = openFiles.map(f => f.name);
      const currentLevel = projectSpec.levels.find(level => {
        // Check if the level's files match our open files
        return level.files.some(f => levelFileNames.includes(f));
      });

      if (!currentLevel) {
        setLoadingError("Could not determine current level");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/pair-programmer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          levelTitle: currentLevel.title,
          levelDescription: currentLevel.description,
          files: currentLevel.files,
          validationCriteria: currentLevel.validationCriteria,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error Response:", errorData);
        throw new Error(
          errorData.error || `API Error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      if (result.success && result.data) {
        setGeneratedCode(result.data);
        
        // Populate the generated code into files
        if (result.data.files && result.data.files.length > 0) {
          const updatedFiles = openFiles.map(openFile => {
            const generatedFileData = result.data.files.find(
              (f: FileCode) => f.name === openFile.name
            );
            
            if (generatedFileData) {
              return {
                ...openFile,
                description: generatedFileData.description,
                content: openFile.content, // Keep original content, will be updated by mode selection
              };
            }
            return openFile;
          });

          useAppStore.getState().setOpenFiles(updatedFiles);
          if (updatedFiles.length > 0) {
            useAppStore.getState().setCurrentFile(updatedFiles[0]);
          }
        }
      }
    } catch (error) {
      console.error("Error generating code:", error);
      setLoadingError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Get the code content for the current file based on the selected mode
  const getVisibleCode = (): string => {
    if (!currentFile || !generatedCode) {
      return currentFile?.content || "";
    }

    const fileCode = generatedCode.files.find(f => f.name === currentFile.name);
    if (!fileCode) {
      return currentFile.content;
    }

    switch (codeMode) {
      case "free":
        // Empty for free mode - user starts from scratch
        return "";
      case "pseudo":
        // Show pseudo code
        return fileCode.pseudoCode;
      case "scaffold":
        // Show partial code with blanks to fill in
        return fileCode.codeSignature;
      default:
        return currentFile.content;
    }
  };

  // Sync file changes to sandbox with debouncing
  useEffect(() => {
    if (!currentFile || !currentFile.path || !projectSpec) return;

    const socket = getSocket();
    let timeoutId: NodeJS.Timeout;

    // Debounce file writes (1 second)
    const syncFile = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        socket.emit('write-file', {
          projectName: projectSpec.projectName,
          filePath: currentFile.path,
          content: currentFile.content,
        });
      }, 1000);
    };

    // Listen for write confirmation
    const handleFileWritten = (response: any) => {
      if (response.success) {
        console.log('File synced to sandbox:', response.path);
      } else {
        console.error('Failed to sync file:', response.error);
      }
    };

    socket.on('file-written', handleFileWritten);

    // Trigger initial sync
    syncFile();

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      socket.off('file-written', handleFileWritten);
    };
  }, [currentFile?.content, currentFile?.path, projectSpec]);

  // Track client-side mounting to prevent SSR/hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);


  // Helper function to get language extension based on file language
  const getLanguageExtension = (language: string) => {
    switch (language?.toLowerCase()) {
      case 'javascript':
      case 'js':
        return [javascript({ jsx: false })];
      case 'typescript':
      case 'ts':
        return [javascript({ jsx: false, typescript: true })];
      case 'tsx':
      case 'jsx':
        return [javascript({ jsx: true, typescript: language === 'tsx' })];
      case 'html':
        return [html()];
      case 'css':
        return [css()];
      case 'json':
        return [json()];
      default:
        return [];
    }
  };

  if (!isMounted || !_hasHydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
          <p>Initializing session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Main Content Area - Takes all available space */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Icon Sidebar */}
        <div className="flex w-12 flex-col items-center gap-2 border-r bg-muted/50 px-2 py-4">
          <button
            onClick={() => setActiveTab("docs")}
            className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
              activeTab === "docs"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Documentation & Task"
          >
            <BookOpen size={20} />
          </button>
        </div>

        {/* Resizable Panels */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
          {/* LEFT PANEL - DOCUMENTATION & TASK INFO */}
          <ResizablePanel defaultSize={25} minSize={20} className="bg-background overflow-hidden">
            <DocsPanel generatedCode={generatedCode} isLoading={isLoading} loadingError={loadingError} />
          </ResizablePanel>

          <ResizableHandle />

          {/* RIGHT PANEL - CODE EDITOR */}
          <ResizablePanel defaultSize={75} minSize={30} className="bg-background overflow-hidden">
            <div className="flex h-full flex-col overflow-hidden">
              {/* Mode Selection Buttons */}
              <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-2 shrink-0">
                <span className="text-xs font-semibold text-muted-foreground mr-2">Mode:</span>
                <button
                  onClick={() => setCodeMode("free")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                    codeMode === "free"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                  title="Free coding - write from scratch"
                >
                  <Zap size={14} />
                  Free Code
                </button>
                <button
                  onClick={() => setCodeMode("pseudo")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                    codeMode === "pseudo"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                  title="Pseudo mode - write real code above pseudo code"
                >
                  <Lightbulb size={14} />
                  Pseudo Mode
                </button>
                <button
                  onClick={() => setCodeMode("scaffold")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                    codeMode === "scaffold"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                  title="Scaffold mode - fill in the blanks with your implementation"
                >
                  <FileCode size={14} />
                  Scaffold Mode
                </button>
              </div>

              {/* File Tabs */}
              <div className="flex items-center border-b bg-muted/20 overflow-x-auto no-scrollbar shrink-0">
                {openFiles?.map((file) => (
                  <div
                    key={file.name}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-xs border-r cursor-pointer transition-colors group",
                      currentFile?.name === file.name 
                        ? "bg-background border-b-2 border-b-primary font-medium" 
                        : "bg-muted/30 hover:bg-muted/50 text-muted-foreground"
                    )}
                    onClick={() => setCurrentFile(file)}
                  >
                    <Code2 size={12} className={cn(
                      currentFile?.name === file.name ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOpenFile(file.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded ml-1 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {(!openFiles || openFiles.length === 0) && (
                   <div className="px-4 py-2 text-xs text-muted-foreground">No files open</div>
                )}
              </div>

              {/* Editor */}
              <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
                {!isMounted ? (
                  <div className="flex h-full items-center justify-center">
                    Initializing editor...
                  </div>
                ) : currentFile ? (
                  <CodeMirror
                    key={currentFile.path || 'untitled'}
                    value={getVisibleCode()}
                    height="100%"
                    extensions={getLanguageExtension(currentFile.language)}
                    onChange={(value) => {
                      if (currentFile) {
                        setCurrentFile({ ...currentFile, content: value });
                      }
                    }}
                    theme="dark"
                    basicSetup={{
                      lineNumbers: true,
                      highlightActiveLineGutter: true,
                      highlightActiveLine: true,
                      foldGutter: true,
                      drawSelection: true,
                      dropCursor: true,
                      allowMultipleSelections: true,
                      indentOnInput: true,
                      bracketMatching: true,
                      closeBrackets: false,
                      autocompletion: true,
                      rectangularSelection: true,
                      crosshairCursor: true,
                      highlightSelectionMatches: true,
                      closeBracketsKeymap: false,
                      searchKeymap: true,
                      foldKeymap: true,
                      completionKeymap: true,
                      lintKeymap: true,
                    }}
                    style={{
                      height: '100%',
                      fontSize: '14px',
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Code2 size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No file selected</p>
                      <p className="text-sm mt-2">Open a file from the designer to start coding</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Terminal Modal - Slides up from bottom */}
      {terminalOpen && (
        <div className="border-t bg-background overflow-hidden shrink-0" style={{ height: "25vh" }}>
          <div className="flex h-7 items-center justify-between border-b bg-muted/50 px-4">
            <div className="flex items-center gap-2 text-xs font-medium">
              <TerminalIcon size={14} />
              Terminal
            </div>
            <button
              onClick={() => setTerminalOpen(false)}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted transition-colors"
              title="Close terminal"
            >
              <X size={14} />
            </button>
          </div>
          <div className="h-[calc(100%-28px)] w-full bg-[#1e1e1e] overflow-hidden">
            <XTerminal />
          </div>
        </div>
      )}

      {/* Bottom Status Bar - Always visible, no scroll */}
      <div className="flex h-7 items-center border-t bg-muted/30 px-3 text-xs text-muted-foreground shrink-0">
        {/* Left Side - Terminal Toggle */}
        <button
          onClick={() => setTerminalOpen(!terminalOpen)}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:text-foreground transition-colors"
          title="Toggle terminal"
        >
          <TerminalIcon size={12} />
        </button>

        <Separator orientation="vertical" className="h-3 mx-1" />

        {/* Center - File Info */}
        <div className="flex flex-1 items-center gap-2 px-1.5 text-xs">
          <span>{currentFile?.name || 'untitled.ts'}</span>
          <span>|</span>
          <span>{currentFile?.language || 'typescript'}</span>
          <span>|</span>
          <span>Ln 1, Col 1</span>
        </div>

        <Separator orientation="vertical" className="h-3 mx-1" />

        {/* Right Side - Project Info */}
        <div className="flex items-center gap-2 px-1.5">
          <span>PATH.ai</span>
          <span className="inline-flex rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
            Learning Mode
          </span>
        </div>
      </div>
    </div>
  )
}

/* Documentation and Task Panel */
interface DocsPanelProps {
  generatedCode: CodeGenerationResponse | null;
  isLoading: boolean;
  loadingError: string | null;
}

function DocsPanel({ generatedCode, isLoading, loadingError }: DocsPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-0.5 border-b bg-muted/30 px-3 py-2 shrink-0">
        <h2 className="text-sm font-semibold">Level Objective</h2>
        <p className="text-xs text-muted-foreground">
          {generatedCode?.levelTitle || "Loading..."}
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 text-xs">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
            <p className="text-muted-foreground">Generating your learning content...</p>
          </div>
        )}

        {loadingError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50">
            <p className="text-red-400">Error: {loadingError}</p>
            <p className="text-xs text-red-300 mt-1">Please refresh and try again</p>
          </div>
        )}

        {!isLoading && generatedCode && (
          <>
            {/* Description Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-xs text-primary uppercase tracking-wider">
                What You'll Build
              </h3>
              <p className="leading-relaxed text-muted-foreground bg-black/20 p-3 rounded-lg border border-white/5">
                {generatedCode.description}
              </p>
            </div>

            <Separator className="my-2" />

            {/* Approach Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-xs text-primary uppercase tracking-wider">
                Approach
              </h3>
              <p className="leading-relaxed text-muted-foreground bg-black/20 p-3 rounded-lg border border-white/5">
                {generatedCode.pseudoCodeExplanation}
              </p>
            </div>

            <Separator className="my-2" />

            {/* Files Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-xs text-primary uppercase tracking-wider">
                Files You'll Work On
              </h3>
              <div className="space-y-2">
                {generatedCode.files.map((file) => (
                  <div key={file.name} className="p-2 rounded-lg bg-black/20 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{file.name}</span>
                      {file.isConfigFile && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          Config
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{file.description}</p>
                    
                    {/* Command Instructions for config files */}
                    {file.isConfigFile && file.commandInstructions && (
                      <div className="mt-2 p-2 bg-black/40 rounded border border-blue-500/20">
                        <p className="text-[10px] text-blue-400 font-mono">
                          Run: <span className="text-white">{file.commandInstructions}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator className="my-2" />

            {/* Hints Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-xs text-primary uppercase tracking-wider">
                💡 Learning Tips
              </h3>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex gap-2">
                  <span>•</span>
                  <span><span className="text-blue-400 font-semibold">Scaffold Mode:</span> Partial code with blanks you fill in (70-80% your work)</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span><span className="text-purple-400 font-semibold">Pseudo Mode:</span> Logic flow without implementation details</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span><span className="text-yellow-400 font-semibold">Free Mode:</span> Write from scratch with zero assistance</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Look for TODO comments and blank sections as your starting points</span>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
