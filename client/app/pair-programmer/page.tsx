"use client"

import { useState } from "react"
import { Editor } from "@monaco-editor/react"
import dynamic from "next/dynamic"

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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"

export default function PairProgrammer() {
  const [open, setOpen] = useState(false)

  return (
    <div className="h-screen w-full">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* LEFT PANEL */}
        <ResizablePanel defaultSize={25} minSize={20}>
          <div className="flex h-full items-center justify-center p-6 bg-muted border">
            <Drawer open={open} onOpenChange={setOpen}>
              <DrawerTrigger asChild>
                <Button variant="default">Terminal</Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerTitle className="sr-only">Terminal</DrawerTitle>
                <div className="h-[400px] p-4 bg-[#1e1e1e]">
                  <XTerminal />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* RIGHT PANEL - CODE EDITOR */}
        <ResizablePanel defaultSize={75} minSize={30}>
          <div className="h-full w-full border">
            <Editor
              height="100%"
              defaultLanguage="typescript"
              defaultValue="// Start coding here..."
              theme="vs-dark"
              loading={<div className="flex h-full items-center justify-center">Loading editor...</div>}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
