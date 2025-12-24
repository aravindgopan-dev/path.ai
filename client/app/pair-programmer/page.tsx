"use client"

import { Editor } from "@monaco-editor/react"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export default function PairProgrammer() {
  return (
    <div className="h-screen w-full">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full w-full border"
      >
        {/* LEFT PANEL */}
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="flex h-full items-center justify-center p-6 bg-muted">
            <span className="font-semibold">One</span>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* RIGHT PANEL */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* TOP RIGHT - CODE EDITOR */}
            <ResizablePanel defaultSize={30} minSize={15}>
              <Editor
                height="100%"
                defaultLanguage="typescript"
                defaultValue="// Start coding here..."
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </ResizablePanel>

            <ResizableHandle />

            {/* BOTTOM RIGHT */}
            <ResizablePanel defaultSize={70} minSize={20}>
              <div className="flex h-full items-center justify-center p-6 bg-muted/30">
                <span className="font-semibold">Three</span>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
