"use client"

import { useState } from "react"
import { Editor } from "@monaco-editor/react"
import dynamic from "next/dynamic"
import { Terminal, X, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

const XTerminal = dynamic(
  () => import("@/components/terminal").then((mod) => ({ default: mod.XTerminal })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading terminal...
      </div>
    ),
  }
)
export default function PairProgrammer() {
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 })

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      {/* MAIN LAYOUT: Sidebar + Editor */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
        {/* LEFT SIDEBAR - AI PAIR PROGRAMMER CHAT */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35} className="border-r border-border">
          <div className="flex flex-col h-full bg-zinc-950/50 dark:bg-zinc-950/50">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">AI Pair Programmer</h2>
              </div>
              <p className="text-xs text-muted-foreground">Ask for hints, not answers</p>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Assistant Message */}
              <div className="flex gap-2">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold">AI</span>
                </div>
                <div className="flex-1 bg-zinc-800/50 rounded px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    I'm ready to help! Ask me anything about your code.
                  </p>
                </div>
              </div>

              {/* User Message */}
              <div className="flex gap-2 justify-end">
                <div className="flex-1 max-w-xs bg-primary/20 rounded px-3 py-2 text-right">
                  <p className="text-xs text-foreground">
                    How do I refactor this function?
                  </p>
                </div>
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-secondary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold">You</span>
                </div>
              </div>

              {/* Assistant Message */}
              <div className="flex gap-2">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold">AI</span>
                </div>
                <div className="flex-1 bg-zinc-800/50 rounded px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Consider breaking it into smaller functions with single responsibilities.
                  </p>
                </div>
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border">
              <input
                type="text"
                placeholder="Ask for hints..."
                disabled
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded px-3 py-2 text-xs text-muted-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* MAIN EDITOR AREA */}
        <ResizablePanel defaultSize={80} minSize={30}>
          <div className="flex flex-col h-full bg-background">
            {/* Editor Tab */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border h-10 bg-zinc-900/50">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">getTasks.controller.ts</span>
                <span className="text-muted-foreground text-xs">TypeScript</span>
              </div>
            </div>

            {/* Editor Container */}
            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage="typescript"
                defaultValue="// Start coding here...\n\nexport const getTasks = () => {\n  return Promise.resolve([])\n}"
                theme="vs-dark"
                loading={
                  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                    Loading editor...
                  </div>
                }
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
                onChange={() => {
                  // Update cursor position on change (mock)
                  setCursorPos({ line: Math.floor(Math.random() * 50) + 1, column: 1 })
                }}
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* TERMINAL PANEL - COLLAPSIBLE FROM BOTTOM */}
      {terminalOpen && (
        <div className="border-t border-border bg-zinc-950/80 flex flex-col" style={{ height: "35%" }}>
          {/* Terminal Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-zinc-900/50 h-10">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold">Terminal</span>
            </div>
            <button
              onClick={() => setTerminalOpen(false)}
              className="p-1 hover:bg-zinc-800 rounded transition-colors"
              aria-label="Close terminal"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Terminal Content */}
          <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
            <XTerminal />
          </div>
        </div>
      )}

      {/* BOTTOM STATUS BAR */}
      <div className="flex items-center justify-between px-4 h-8 bg-zinc-900/80 border-t border-border text-xs">
        {/* Left: Terminal Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTerminalOpen(!terminalOpen)}
            className="p-1 hover:bg-zinc-800 rounded transition-colors flex items-center gap-1"
            title={terminalOpen ? "Hide terminal" : "Show terminal"}
          >
            <Terminal className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </div>

        {/* Center: File Info */}
        <div className="flex items-center gap-4 flex-1 ml-4">
          <span className="text-muted-foreground">getTasks.controller.ts</span>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-muted-foreground">TypeScript</span>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-muted-foreground">
            Ln {cursorPos.line}, Col {cursorPos.column}
          </span>
        </div>

        {/* Right: Project & Environment */}
        <div className="flex items-center gap-4 ml-auto">
          <Separator orientation="vertical" className="h-4" />
          <span className="text-muted-foreground">PATH.ai</span>
          <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-xs text-primary">
            Learning Mode
          </div>
        </div>
      </div>
    </div>
  )
}
