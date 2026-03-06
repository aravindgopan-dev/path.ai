"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Loader2, Minimize2 } from "lucide-react"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"
import { chatNode } from "@/lib/agents-api"

/**
 * Floating chatbot widget — fixed bottom-right.
 * Only active when a coding node is selected (activeNodeId is set).
 * Communicates via POST /node/{id}/chat.
 */
export function FloatingChatbot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { getToken } = useAuth()

  const activeNodeId = useAppStore((s) => s.activeNodeId)
  const chatHistory = useAppStore((s) => s.chatHistory)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const openFiles = useAppStore((s) => s.openFiles)
  const roadmapNodes = useAppStore((s) => s.roadmapNodes)

  const activeNode = roadmapNodes.find((n) => n.id === activeNodeId)

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [chatHistory.length])

  // Don't render if no active coding node
  if (!activeNodeId) return null

  const handleSend = async () => {
    if (!input.trim() || !activeNodeId || sending) return

    const userMsg = { role: "user", content: input.trim() }
    addChatMessage(userMsg)
    setInput("")
    setSending(true)

    try {
      const userCode =
        openFiles?.map((f) => `--- ${f.name} ---\n${f.content}`).join("\n\n") ?? ""
      const token = await getToken()
      const res = await chatNode(activeNodeId, userMsg.content, chatHistory, userCode, token ?? undefined)
      addChatMessage({ role: "assistant", content: res.response })
    } catch {
      addChatMessage({
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
          title="Open chat"
        >
          <MessageCircle size={22} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex w-80 flex-col rounded-xl border bg-background shadow-2xl overflow-hidden"
          style={{ height: "420px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 shrink-0">
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">AI Helper</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {activeNode?.title ?? activeNodeId}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-muted transition-colors"
                title="Minimize"
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-muted transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 p-3 text-xs">
            {chatHistory.length === 0 && (
              <p className="text-xs text-center text-muted-foreground py-8">
                Ask a question about this task...
              </p>
            )}
            {chatHistory.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <Card className="max-w-[80%] rounded-lg bg-primary p-2">
                    <p className="text-xs text-primary-foreground whitespace-pre-wrap leading-tight">
                      {msg.content}
                    </p>
                  </Card>
                </div>
              ) : (
                <div key={i} className="flex gap-2">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground mt-0.5">
                    AI
                  </div>
                  <Card className="max-w-[80%] rounded-lg bg-muted p-2">
                    <p className="text-xs whitespace-pre-wrap leading-tight">
                      {msg.content}
                    </p>
                  </Card>
                </div>
              )
            )}
            {sending && (
              <div className="flex gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  AI
                </div>
                <Loader2 size={14} className="animate-spin text-muted-foreground mt-0.5" />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t bg-muted/30 px-3 py-2 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask for a hint..."
                disabled={sending}
                className="flex-1 rounded border bg-muted px-2 py-1 text-xs placeholder-muted-foreground/50 disabled:opacity-50"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="px-2"
              >
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
