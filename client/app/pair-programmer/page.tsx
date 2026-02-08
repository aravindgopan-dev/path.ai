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

type SidebarTab = "agent" | "docs"

interface FileData {
  name: string;
  language: string;
  description: string;
  content: string;
}

export default function PairProgrammer() {
  const [activeTab, setActiveTab] = useState<SidebarTab>("agent")
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  
  // Use Zustand store for current file
  const currentFile = useAppStore((state) => state.currentFile);
  const setCurrentFile = useAppStore((state) => state.setCurrentFile);
  const openFiles = useAppStore((state) => state.openFiles);
  const removeOpenFile = useAppStore((state) => state.removeOpenFile);
  const projectSpec = useAppStore((state) => state.projectSpec);
  const _hasHydrated = useAppStore((state) => state._hasHydrated);
  
  // Editor view ref for CodeMirror (optional, for advanced use)
  const editorViewRef = useRef<any>(null);

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
            onClick={() => setActiveTab("agent")}
            className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
              activeTab === "agent"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Agent Mode"
          >
            <MessageCircle size={20} />
          </button>

          <button
            onClick={() => setActiveTab("docs")}
            className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
              activeTab === "docs"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Documentation"
          >
            <BookOpen size={20} />
          </button>
        </div>

        {/* Resizable Panels */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
          {/* LEFT PANEL - AI / DOCS */}
          <ResizablePanel defaultSize={25} minSize={20} className="bg-background overflow-hidden">
            <div className="flex h-full flex-col overflow-hidden">
              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {activeTab === "agent" ? (
                  <AgentPanel />
                ) : (
                  <DocsPanel />
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* RIGHT PANEL - CODE EDITOR */}
          <ResizablePanel defaultSize={75} minSize={30} className="bg-background overflow-hidden">
            <div className="flex h-full flex-col overflow-hidden">
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
                    value={currentFile.content}
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

/* Agent Mode Panel */
function AgentPanel() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-0.5 border-b bg-muted/30 px-3 py-2 shrink-0">
        <h2 className="text-sm font-semibold">AI Pair Programmer</h2>
        <p className="text-xs text-muted-foreground">Hints, not answers</p>
      </div>

      {/* Chat Area - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-2 p-3 text-xs">
        {/* Assistant Message */}
        <div className="flex gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
            AI
          </div>
          <div className="flex-1 min-w-0">
            <Card className="rounded-lg bg-muted p-2">
              <p className="text-xs leading-tight">
                What should happen when there are no matching tasks?
              </p>
            </Card>
          </div>
        </div>

        {/* User Message */}
        <div className="flex gap-2 justify-end">
          <div className="flex-1 max-w-xs min-w-0">
            <Card className="rounded-lg bg-primary p-2">
              <p className="text-xs text-primary-foreground leading-tight">
                Return an empty array?
              </p>
            </Card>
          </div>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-secondary text-[10px] font-semibold text-secondary-foreground">
            U
          </div>
        </div>

        {/* Assistant Message */}
        <div className="flex gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
            AI
          </div>
          <div className="flex-1 min-w-0">
            <Card className="rounded-lg bg-muted p-2">
              <p className="text-xs leading-tight">
                That's one approach. What are the pros and cons?
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-muted/30 px-3 py-2 shrink-0">
        <input
          type="text"
          placeholder="Ask for a hint..."
          disabled
          className="w-full rounded border bg-muted px-2 py-1 text-xs text-muted-foreground placeholder-muted-foreground/50 disabled:opacity-50"
        />
      </div>
    </div>
  )
}

/* Documentation Panel */
function DocsPanel() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-0.5 border-b bg-muted/30 px-3 py-2 shrink-0">
        <h2 className="text-sm font-semibold">Documentation</h2>
        <p className="text-xs text-muted-foreground">getTasks.controller.ts</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-3 p-3 text-xs">
        {/* Section */}
        <div className="space-y-1">
          <h3 className="font-semibold text-xs">Concept: Filter Operations</h3>
          <p className="leading-tight text-muted-foreground">
            Filter operations allow you to select elements from a collection that match specific criteria.
          </p>
        </div>

        <Separator className="my-1" />

        {/* Section */}
        <div className="space-y-1">
          <h3 className="font-semibold text-xs">What You're Building</h3>
          <p className="leading-tight text-muted-foreground">
            Implement a controller method that retrieves and filters tasks based on user permissions and status.
          </p>
        </div>

        <Separator className="my-1" />

        {/* Section */}
        <div className="space-y-1">
          <h3 className="font-semibold text-xs">Objectives</h3>
          <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
            <li>Use array methods</li>
            <li>Implement conditional logic</li>
            <li>Handle edge cases</li>
          </ul>
        </div>

        <Separator className="my-1" />

        {/* Section */}
        <div className="space-y-1">
          <h3 className="font-semibold text-xs">Hints</h3>
          <div className="space-y-0.5 text-muted-foreground">
            <p>💡 Think about data structure first</p>
            <p>💡 Consider filter order</p>
            <p>💡 Test edge cases</p>
          </div>
        </div>
      </div>
    </div>
  )
}
