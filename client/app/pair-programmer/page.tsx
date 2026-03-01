"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { html } from "@codemirror/lang-html"
import { css } from "@codemirror/lang-css"
import { json } from "@codemirror/lang-json"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import {
  MessageCircle,
  BookOpen,
  Terminal as TerminalIcon,
  X,
  Code2,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Lightbulb,
  ListChecks,
  AlertTriangle,
  Rocket,
  Trophy,
} from "lucide-react"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"
import { getSocket } from "@/lib/socket"
import {
  getInstruction,
  getSkeleton,
  validateNode,
  chatNode,
  completeNode,
  getDocumentation,
  type Instruction,
  type Feedback,
  type ValidationResult,
  type Documentation,
} from "@/lib/agents-api"

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

export default function PairProgrammer() {
  const [activeTab, setActiveTab] = useState<SidebarTab>("docs")
  const [codeMode, setCodeMode] = useState<CodeMode>("free")
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isLoadingNode, setIsLoadingNode] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationExpanded, setValidationExpanded] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [completionSuccess, setCompletionSuccess] = useState(false)

  // Zustand store
  const currentFile = useAppStore((s) => s.currentFile)
  const setCurrentFile = useAppStore((s) => s.setCurrentFile)
  const openFiles = useAppStore((s) => s.openFiles)
  const setOpenFiles = useAppStore((s) => s.setOpenFiles)
  const addOpenFile = useAppStore((s) => s.addOpenFile)
  const removeOpenFile = useAppStore((s) => s.removeOpenFile)
  const projectSpec = useAppStore((s) => s.projectSpec)
  const _hasHydrated = useAppStore((s) => s._hasHydrated)
  const storeNodeId = useAppStore((s) => s.activeNodeId)
  const setActiveNodeId = useAppStore((s) => s.setActiveNodeId)
  const userLevel = useAppStore((s) => s.userLevel)

  // Prefer URL ?id= param, fall back to store
  const searchParams = useSearchParams()
  const urlNodeId = searchParams.get("id")
  const activeNodeId = urlNodeId ?? storeNodeId

  // Sync URL param → store (for direct-link / refresh scenarios)
  useEffect(() => {
    if (urlNodeId && urlNodeId !== storeNodeId) {
      setActiveNodeId(urlNodeId)
    }
  }, [urlNodeId, storeNodeId, setActiveNodeId])
  const instruction = useAppStore((s) => s.instruction)
  const setInstruction = useAppStore((s) => s.setInstruction)
  const skeletonFiles = useAppStore((s) => s.skeletonFiles)
  const setSkeletonFiles = useAppStore((s) => s.setSkeletonFiles)
  const validationResult = useAppStore((s) => s.validationResult)
  const setValidationResult = useAppStore((s) => s.setValidationResult)
  const feedback = useAppStore((s) => s.feedback)
  const setFeedback = useAppStore((s) => s.setFeedback)
  const roadmapNodes = useAppStore((s) => s.roadmapNodes)
  const codingMode = useAppStore((s) => s.codingMode)
  const setCodingMode = useAppStore((s) => s.setCodingMode)
  const documentation = useAppStore((s) => s.documentation)
  const setDocumentation = useAppStore((s) => s.setDocumentation)
  const markNodeCompleted = useAppStore((s) => s.markNodeCompleted)
  const completedNodes = useAppStore((s) => s.completedNodes)

  const activeNode = roadmapNodes.find((n) => n.id === activeNodeId)
  const nodeType = activeNode?.type ?? "code"
  const isLearnOrSetup = nodeType === "learn" || nodeType === "setup"
  const editorViewRef = useRef<any>(null)

  // Fetch instruction + skeleton when entering a CODE node
  useEffect(() => {
    if (!activeNodeId || instruction) return
    if (isLearnOrSetup) return // learn/setup nodes don't need instruction + skeleton

    let cancelled = false

    const fetchNodeData = async () => {
      setIsLoadingNode(true)
      try {
        const [instrRes, skelRes] = await Promise.all([
          getInstruction(activeNodeId, userLevel),
          getSkeleton(activeNodeId, userLevel, codingMode),
        ])

        if (cancelled) return

        setInstruction(instrRes.instruction)
        setSkeletonFiles(skelRes.skeleton)

        // Populate editor tabs with skeleton files
        if (skelRes.skeleton?.files?.length) {
          const files = skelRes.skeleton.files.map((f) => ({
            name: f.filename,
            language: guessLanguage(f.filename),
            description: "",
            content: f.content,
            path: f.filename,
          }))
          setOpenFiles(files)
          setCurrentFile(files[0])
        }
      } catch (err) {
        console.error("Failed to load node data:", err)
      } finally {
        if (!cancelled) setIsLoadingNode(false)
      }
    }

    fetchNodeData()
    return () => { cancelled = true }
  }, [activeNodeId, userLevel, isLearnOrSetup])

  // Fetch documentation when entering a LEARN / SETUP node
  useEffect(() => {
    if (!activeNodeId || !isLearnOrSetup || documentation) return

    let cancelled = false

    const fetchDocs = async () => {
      setIsLoadingNode(true)
      try {
        const res = await getDocumentation(activeNodeId)
        if (!cancelled) setDocumentation(res.documentation)
      } catch (err) {
        console.error("Failed to load documentation:", err)
      } finally {
        if (!cancelled) setIsLoadingNode(false)
      }
    }

    fetchDocs()
    return () => { cancelled = true }
  }, [activeNodeId, isLearnOrSetup])

  // Sync file changes to sandbox
  useEffect(() => {
    if (!currentFile || !currentFile.path || !projectSpec) return

    const socket = getSocket()
    let timeoutId: NodeJS.Timeout

    const syncFile = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        socket.emit("write-file", {
          projectName: projectSpec.projectName,
          filePath: currentFile.path,
          content: currentFile.content,
        })
      }, 1000)
    }

    const handleFileWritten = (response: any) => {
      if (!response.success) console.error("Failed to sync file:", response.error)
    }

    socket.on("file-written", handleFileWritten)
    syncFile()

    return () => {
      clearTimeout(timeoutId)
      socket.off("file-written", handleFileWritten)
    }
  }, [currentFile?.content, currentFile?.path, projectSpec])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // ── Mode toggle handler: re-fetch skeleton ─────
  const handleModeToggle = useCallback(async () => {
    if (!activeNodeId) return
    const nextMode = codingMode === "signature" ? "free" : "signature"
    setCodingMode(nextMode)

    setIsLoadingNode(true)
    try {
      const skelRes = await getSkeleton(activeNodeId, userLevel, nextMode)
      setSkeletonFiles(skelRes.skeleton)

      if (skelRes.skeleton?.files?.length) {
        const files = skelRes.skeleton.files.map((f) => ({
          name: f.filename,
          language: guessLanguage(f.filename),
          description: "",
          content: f.content,
          path: f.filename,
        }))
        setOpenFiles(files)
        setCurrentFile(files[0])
      }
    } catch (err) {
      console.error("Failed to reload skeleton:", err)
    } finally {
      setIsLoadingNode(false)
    }
  }, [activeNodeId, codingMode, userLevel])

  // ── Validate handler ────────────────────────────
  const handleValidate = async () => {
    if (!activeNodeId || !openFiles?.length) return

    setIsValidating(true)
    setValidationExpanded(true)
    try {
      const files = openFiles.map((f) => ({
        filename: f.name,
        content: f.content,
      }))
      const result = await validateNode(activeNodeId, files)
      setValidationResult(result.validation)
      setFeedback(result.feedback)

      // Auto-complete if validation passes
      if (result.validation.status === "pass") {
        try {
          await completeNode(activeNodeId)
          markNodeCompleted(activeNodeId)
          setCompletionSuccess(true)
          setTimeout(() => setCompletionSuccess(false), 3000)
        } catch (err) {
          console.error("Failed to auto-complete node:", err)
        }
      }
    } catch (err) {
      console.error("Validation failed:", err)
    } finally {
      setIsValidating(false)
    }
  }

  // ── Mark complete handler for learn / setup ─────
  const handleMarkComplete = async () => {
    if (!activeNodeId) return
    setIsCompleting(true)
    try {
      await completeNode(activeNodeId)
      markNodeCompleted(activeNodeId)
      setCompletionSuccess(true)
      setTimeout(() => setCompletionSuccess(false), 3000)
    } catch (err) {
      console.error("Failed to complete node:", err)
    } finally {
      setIsCompleting(false)
    }
  }

  // Language extension helper
  const getLanguageExtension = (language: string) => {
    switch (language?.toLowerCase()) {
      case "javascript": case "js": return [javascript({ jsx: false })]
      case "typescript": case "ts": return [javascript({ jsx: false, typescript: true })]
      case "tsx": case "jsx": return [javascript({ jsx: true, typescript: language === "tsx" })]
      case "html": return [html()]
      case "css": return [css()]
      case "json": return [json()]
      default: return []
    }
  }

  const isNodeCompleted = activeNodeId ? completedNodes.includes(activeNodeId) : false

  if (!isMounted || !_hasHydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Initializing session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Completion toast */}
      {completionSuccess && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-top-2">
          <Trophy size={16} />
          Node completed! Great work!
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Icon Sidebar */}
        <div className="flex w-12 flex-col items-center gap-2 border-r bg-muted/50 px-2 py-4">
          <button
            onClick={() => setActiveTab("agent")}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded transition-colors",
              activeTab === "agent"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Agent Mode"
          >
            <MessageCircle size={20} />
          </button>
          <button
            onClick={() => setActiveTab("docs")}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded transition-colors",
              activeTab === "docs"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={isLearnOrSetup ? "Documentation" : "Instructions"}
          >
            <BookOpen size={20} />
          </button>
        </div>

        {/* Resizable Panels */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
          {/* LEFT PANEL — AI / DOCS */}
          <ResizablePanel defaultSize={isLearnOrSetup ? 40 : 25} minSize={20} className="bg-background overflow-hidden">
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                {activeTab === "agent" ? (
                  <AgentPanel nodeId={activeNodeId} />
                ) : isLearnOrSetup ? (
                  <DocumentationPanel
                    documentation={documentation}
                    isLoading={isLoadingNode}
                    node={activeNode}
                  />
                ) : (
                  <InstructionPanel instruction={instruction} isLoading={isLoadingNode} node={activeNode} />
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* RIGHT PANEL — CODE EDITOR or LEARN CONTENT */}
          <ResizablePanel defaultSize={isLearnOrSetup ? 60 : 75} minSize={30} className="bg-background overflow-hidden">
            <div className="flex h-full flex-col overflow-hidden">
              {isLearnOrSetup ? (
                /* ── Learn / Setup view: documentation + mark complete ── */
                <LearnPanel
                  documentation={documentation}
                  isLoading={isLoadingNode}
                  node={activeNode}
                  isCompleted={isNodeCompleted}
                  isCompleting={isCompleting}
                  onMarkComplete={handleMarkComplete}
                />
              ) : (
                /* ── Code view: editor + validation ── */
                <>
                  {/* File Tabs + Mode Toggle + Validate Button */}
                  <div className="flex items-center border-b bg-muted/20 shrink-0">
                    <div className="flex flex-1 items-center overflow-x-auto no-scrollbar">
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
                          <Code2 size={12} className={cn(currentFile?.name === file.name ? "text-primary" : "text-muted-foreground")} />
                          <span className="truncate max-w-[120px]">{file.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeOpenFile(file.name) }}
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

                    {/* Mode Toggle */}
                    {activeNodeId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mx-1 shrink-0 gap-1.5 text-xs"
                        onClick={handleModeToggle}
                        disabled={isLoadingNode}
                        title={codingMode === "signature" ? "Switch to Free Mode" : "Switch to Signature Mode"}
                      >
                        {codingMode === "signature" ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                        {codingMode === "signature" ? "Signature" : "Free"}
                      </Button>
                    )}

                    {/* Validate Button */}
                    {activeNodeId && (
                      <Button
                        size="sm"
                        variant={validationResult?.status === "pass" ? "default" : "secondary"}
                        className="mx-2 shrink-0 gap-1.5"
                        onClick={handleValidate}
                        disabled={isValidating}
                      >
                        {isValidating ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : validationResult?.status === "pass" ? (
                          <CheckCircle2 size={14} className="text-green-400" />
                        ) : validationResult?.status === "fail" ? (
                          <XCircle size={14} className="text-red-400" />
                        ) : null}
                        Validate
                      </Button>
                    )}
                  </div>

                  {/* Score bar */}
                  {validationResult && typeof validationResult.score === "number" && (
                    <div className="flex items-center gap-2 px-4 py-1 border-b bg-muted/10 shrink-0">
                      <span className="text-[10px] font-medium text-muted-foreground">Score</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            validationResult.score >= 80 ? "bg-green-500" :
                            validationResult.score >= 50 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${validationResult.score}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">{validationResult.score}%</span>
                    </div>
                  )}

                  {/* Editor area */}
                  <div className="flex-1 overflow-hidden relative">
                    {isLoadingNode ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center space-y-3">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                          <p className="text-sm text-muted-foreground">Loading node scaffold...</p>
                        </div>
                      </div>
                    ) : currentFile ? (
                      <CodeMirror
                        key={currentFile.path || currentFile.name}
                        value={currentFile.content}
                        height="100%"
                        extensions={getLanguageExtension(currentFile.language)}
                        onChange={(value) => {
                          if (currentFile) setCurrentFile({ ...currentFile, content: value })
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
                        style={{ height: "100%", fontSize: "14px" }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Code2 size={48} className="mx-auto mb-4 opacity-50" />
                          <p>No file selected</p>
                          <p className="text-sm mt-2">Select a coding node from the roadmap to begin</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Validation Result Panel (collapsible) */}
                  {(validationResult || feedback) && (
                    <div className="border-t bg-muted/20 shrink-0">
                      <button
                        onClick={() => setValidationExpanded(!validationExpanded)}
                        className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {validationResult?.status === "pass" ? (
                            <CheckCircle2 size={14} className="text-green-400" />
                          ) : (
                            <XCircle size={14} className="text-red-400" />
                          )}
                          <span>
                            Validation: {validationResult?.status === "pass" ? "Passed" : "Needs Work"}
                          </span>
                          {validationResult?.missing_items?.length ? (
                            <Badge variant="outline" className="text-[10px]">
                              {validationResult.missing_items.length} missing
                            </Badge>
                          ) : null}
                        </div>
                        {validationExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                      </button>

                      {validationExpanded && (
                        <ScrollArea className="max-h-48 px-4 pb-3">
                          {/* Missing items */}
                          {validationResult?.missing_items?.length ? (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Missing:</p>
                              <ul className="space-y-0.5">
                                {validationResult.missing_items.map((item, i) => (
                                  <li key={i} className="text-xs text-red-400 flex items-center gap-1">
                                    <XCircle size={10} /> {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {/* Notes */}
                          {validationResult?.notes?.length ? (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Notes:</p>
                              {validationResult.notes.map((note, i) => (
                                <p key={i} className="text-xs text-yellow-400">{note}</p>
                              ))}
                            </div>
                          ) : null}

                          {/* Feedback */}
                          {feedback && (
                            <div className="space-y-2">
                              <p className="text-xs leading-relaxed">{feedback.feedback_message}</p>
                              {feedback.hints?.length ? (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Hints:</p>
                                  {feedback.hints.map((h, i) => (
                                    <p key={i} className="text-xs text-blue-400">💡 {h}</p>
                                  ))}
                                </div>
                              ) : null}
                              {feedback.improvement_points?.length ? (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Improvements:</p>
                                  {feedback.improvement_points.map((p, i) => (
                                    <p key={i} className="text-xs text-muted-foreground">• {p}</p>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </ScrollArea>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Terminal */}
      {terminalOpen && (
        <div className="border-t bg-background overflow-hidden shrink-0" style={{ height: "25vh" }}>
          <div className="flex h-7 items-center justify-between border-b bg-muted/50 px-4">
            <div className="flex items-center gap-2 text-xs font-medium">
              <TerminalIcon size={14} />
              Terminal
            </div>
            <button onClick={() => setTerminalOpen(false)} className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted transition-colors" title="Close terminal">
              <X size={14} />
            </button>
          </div>
          <div className="h-[calc(100%-28px)] w-full bg-[#1e1e1e] overflow-hidden">
            <XTerminal />
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="flex h-7 items-center border-t bg-muted/30 px-3 text-xs text-muted-foreground shrink-0">
        <button onClick={() => setTerminalOpen(!terminalOpen)} className="flex items-center gap-1 px-1.5 py-0.5 hover:text-foreground transition-colors" title="Toggle terminal">
          <TerminalIcon size={12} />
        </button>
        <Separator orientation="vertical" className="h-3 mx-1" />
        <div className="flex flex-1 items-center gap-2 px-1.5 text-xs">
          {isLearnOrSetup ? (
            <span>Documentation</span>
          ) : (
            <>
              <span>{currentFile?.name || "untitled.ts"}</span>
              <span>|</span>
              <span>{currentFile?.language || "typescript"}</span>
            </>
          )}
        </div>
        <Separator orientation="vertical" className="h-3 mx-1" />
        <div className="flex items-center gap-2 px-1.5">
          {activeNode && <span className="truncate max-w-[200px]">{activeNode.title}</span>}
          <Badge variant="secondary" className="text-[10px]">
            {nodeType === "code" ? (codingMode === "signature" ? "Signature Mode" : "Free Mode") :
             nodeType === "learn" ? "Learn" : "Setup"}
          </Badge>
          {isNodeCompleted && (
            <Badge variant="default" className="text-[10px] bg-green-600">
              Completed
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helper ────────────────────────────────────────
function guessLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    html: "html", css: "css", json: "json", py: "python", md: "markdown",
  }
  return map[ext] ?? "typescript"
}

// ── Learn / Setup Panel (right side) ──────────────
function LearnPanel({
  documentation,
  isLoading,
  node,
  isCompleted,
  isCompleting,
  onMarkComplete,
}: {
  documentation: Documentation | null
  isLoading: boolean
  node?: { id: string; title: string; description: string; type: string } | null
  isCompleted: boolean
  isCompleting: boolean
  onMarkComplete: () => void
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            node?.type === "learn" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
          )}>
            {node?.type === "learn" ? <BookOpen size={16} /> : <Rocket size={16} />}
          </div>
          <div>
            <h2 className="text-sm font-semibold">{node?.title ?? "Documentation"}</h2>
            <p className="text-xs text-muted-foreground">{node?.type === "learn" ? "Learning Material" : "Setup Guide"}</p>
          </div>
        </div>
        {isCompleted ? (
          <Badge variant="default" className="bg-green-600 gap-1">
            <CheckCircle2 size={12} /> Completed
          </Badge>
        ) : (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={onMarkComplete}
            disabled={isCompleting}
          >
            {isCompleting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Mark Complete
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Loading documentation...</p>
            </div>
          </div>
        ) : documentation ? (
          <div className="p-6 space-y-6 max-w-3xl mx-auto">
            {/* Node description */}
            {node?.description && (
              <Card className="p-4 border-l-4 border-l-primary">
                <p className="text-sm leading-relaxed text-muted-foreground">{node.description}</p>
              </Card>
            )}

            {/* Explanation */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-yellow-400" />
                <h3 className="font-semibold text-sm">Explanation</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground pl-6">{documentation.explanation}</p>
            </div>

            <Separator />

            {/* Algorithm / Steps */}
            {documentation.algorithm_steps?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ListChecks size={16} className="text-blue-400" />
                  <h3 className="font-semibold text-sm">Step-by-Step</h3>
                </div>
                <ol className="space-y-2 pl-6">
                  {documentation.algorithm_steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <Separator />

            {/* Common Mistakes */}
            {documentation.common_mistakes?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-orange-400" />
                  <h3 className="font-semibold text-sm">Common Mistakes</h3>
                </div>
                <ul className="space-y-1.5 pl-6">
                  {documentation.common_mistakes.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <XCircle size={12} className="text-orange-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* Implementation Strategy */}
            {documentation.implementation_strategy?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Rocket size={16} className="text-green-400" />
                  <h3 className="font-semibold text-sm">Implementation Strategy</h3>
                </div>
                <ul className="space-y-1.5 pl-6">
                  {documentation.implementation_strategy.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 size={12} className="text-green-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="text-center">
              <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
              <p>No documentation available</p>
              <p className="text-sm mt-2">Select a learn or setup node from the roadmap.</p>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ── Documentation Panel (left sidebar for learn/setup) ──
function DocumentationPanel({
  documentation,
  isLoading,
  node,
}: {
  documentation: Documentation | null
  isLoading: boolean
  node?: { id: string; title: string; description: string; type: string } | null
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b bg-muted/30 px-3 py-2 shrink-0">
        <h2 className="text-sm font-semibold">Documentation</h2>
        <p className="text-xs text-muted-foreground truncate">
          {node?.title ?? "Select a node"}
        </p>
      </div>

      <ScrollArea className="flex-1 p-3 text-xs">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documentation ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-xs">Overview</h3>
              <p className="leading-relaxed text-muted-foreground">{documentation.explanation}</p>
            </div>

            <Separator />

            {documentation.algorithm_steps?.length > 0 && (
              <div className="space-y-1">
                <h3 className="font-semibold text-xs">Steps</h3>
                <ol className="space-y-0.5 text-muted-foreground list-decimal list-inside">
                  {documentation.algorithm_steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            )}

            {documentation.common_mistakes?.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h3 className="font-semibold text-xs">Watch Out For</h3>
                  <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                    {documentation.common_mistakes.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {documentation.implementation_strategy?.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h3 className="font-semibold text-xs">Strategy</h3>
                  <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                    {documentation.implementation_strategy.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-50" />
            <p>No documentation loaded.</p>
            <p className="mt-1">Select a learn or setup node.</p>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ── Agent Panel (chat) ────────────────────────────
function AgentPanel({ nodeId }: { nodeId: string | null }) {
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const chatHistory = useAppStore((s) => s.chatHistory)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const openFiles = useAppStore((s) => s.openFiles)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [chatHistory.length])

  const handleSend = async () => {
    if (!input.trim() || !nodeId || sending) return

    const userMsg = { role: "user", content: input.trim() }
    addChatMessage(userMsg)
    setInput("")
    setSending(true)

    try {
      const userCode = openFiles?.map((f) => `--- ${f.name} ---\n${f.content}`).join("\n\n") ?? ""
      const res = await chatNode(nodeId, userMsg.content, chatHistory, userCode)
      addChatMessage({ role: "assistant", content: res.response })
    } catch (err) {
      addChatMessage({ role: "assistant", content: "Sorry, something went wrong. Please try again." })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b bg-muted/30 px-3 py-2 shrink-0">
        <h2 className="text-sm font-semibold">AI Pair Programmer</h2>
        <p className="text-xs text-muted-foreground">Hints, not answers</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 p-3 text-xs">
        {chatHistory.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Ask a question about this coding task...
          </p>
        )}
        {chatHistory.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex gap-2 justify-end">
              <div className="flex-1 max-w-xs min-w-0">
                <Card className="rounded-lg bg-primary p-2">
                  <p className="text-xs text-primary-foreground leading-tight whitespace-pre-wrap">{msg.content}</p>
                </Card>
              </div>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-secondary text-[10px] font-semibold text-secondary-foreground">U</div>
            </div>
          ) : (
            <div key={i} className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">AI</div>
              <div className="flex-1 min-w-0">
                <Card className="rounded-lg bg-muted p-2">
                  <p className="text-xs leading-tight whitespace-pre-wrap">{msg.content}</p>
                </Card>
              </div>
            </div>
          )
        )}
        {sending && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">AI</div>
            <Loader2 size={14} className="animate-spin text-muted-foreground mt-1" />
          </div>
        )}
      </div>

      <div className="border-t bg-muted/30 px-3 py-2 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }}}
            placeholder={nodeId ? "Ask for a hint..." : "Select a coding node first"}
            disabled={!nodeId || sending}
            className="flex-1 rounded border bg-muted px-2 py-1 text-xs placeholder-muted-foreground/50 disabled:opacity-50"
          />
          <Button size="sm" variant="ghost" onClick={handleSend} disabled={!nodeId || !input.trim() || sending} className="px-2">
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Instruction Panel ─────────────────────────────
function InstructionPanel({
  instruction,
  isLoading,
  node,
}: {
  instruction: Instruction | null
  isLoading: boolean
  node?: { id: string; title: string; description: string; type: string } | null
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b bg-muted/30 px-3 py-2 shrink-0">
        <h2 className="text-sm font-semibold">Instructions</h2>
        <p className="text-xs text-muted-foreground truncate">
          {node?.title ?? "Select a node"}
        </p>
      </div>

      <ScrollArea className="flex-1 p-3 text-xs">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : instruction ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-xs">Objective</h3>
              <p className="leading-relaxed text-muted-foreground">{instruction.objective}</p>
            </div>

            <Separator />

            {instruction.constraints?.length > 0 && (
              <div className="space-y-1">
                <h3 className="font-semibold text-xs">Constraints</h3>
                <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                  {instruction.constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {instruction.learning_focus?.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h3 className="font-semibold text-xs">Learning Focus</h3>
                  <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                    {instruction.learning_focus.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {instruction.files_involved?.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h3 className="font-semibold text-xs">Files Involved</h3>
                  <div className="flex flex-wrap gap-1">
                    {instruction.files_involved.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{f}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-50" />
            <p>No instructions loaded.</p>
            <p className="mt-1">Select a coding node from the roadmap.</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
