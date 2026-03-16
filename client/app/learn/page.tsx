"use client"

import React, { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircle2,
  BookOpen,
  Loader2,
  ListChecks,
  Brain,
  AlertTriangle,
  Rocket,
  FileCode2,
  Link2,
  ArrowUpRight,
  Target,
} from "lucide-react"
import { getDocumentation, completeNode, type Documentation } from "@/lib/agents-api"

function LearnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nodeId = searchParams.get("id")
  const { getToken } = useAuth()

  const [doc, setDoc] = useState<Documentation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)

  const handleMarkComplete = async () => {
    if (!nodeId) return
    try {
      setIsCompleting(true)
      const token = await getToken()
      await completeNode(nodeId, token ?? undefined)
      router.push("/roadmap")
    } catch (err) {
      console.error("Failed to complete node:", err)
    } finally {
      setIsCompleting(false)
    }
  }

  useEffect(() => {
    if (!nodeId) return

    let cancelled = false
    const fetchDoc = async () => {
      setIsLoading(true)
      try {
        const token = await getToken()
        const res = await getDocumentation(nodeId, token ?? undefined)
        if (!cancelled && res.documentation) {
          setDoc(res.documentation)
        }
      } catch (err) {
        console.error("Failed to load learning documentation:", err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchDoc()
    return () => {
      cancelled = true
    }
  }, [nodeId, getToken])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground animate-pulse">Loading learning module...</p>
        </div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Failed to load learning documentation. Please try again.</p>
          <Button onClick={() => router.push("/roadmap")}>Return to Roadmap</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b shrink-0 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg">{doc.objective || doc.title || "Learning Module"}</h1>
            <p className="text-xs text-muted-foreground">Detailed Learning Task</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/roadmap")}>Back to Roadmap</Button>
          <Button className="gap-2" onClick={handleMarkComplete} disabled={isCompleting}>
            {isCompleting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {isCompleting ? "Completing..." : "Mark Complete"}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="mx-auto w-full max-w-5xl p-6 md:p-8 space-y-6 pb-16">
            <Card className="p-6 md:p-8 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-semibold">Learning Objective</h2>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {doc.objective || "Master the concepts in this module and apply them to your project."}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">Deep Dive</Badge>
              </div>

              <Separator className="my-5" />

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Explanation</h3>
                <p className="text-sm md:text-[15px] leading-7 text-muted-foreground whitespace-pre-line">
                  {doc.explanation}
                </p>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-6">
              {doc.learning_focus?.length ? (
                <Card className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-blue-400" />
                    <h3 className="text-base font-semibold">Learning Focus</h3>
                  </div>
                  <ul className="space-y-2">
                    {doc.learning_focus.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground leading-6 list-disc ml-5">{item}</li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {doc.algorithm_steps?.length ? (
                <Card className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-semibold">Step-by-Step Guide</h3>
                  </div>
                  <ol className="space-y-3">
                    {doc.algorithm_steps.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-sm text-muted-foreground leading-6">{item}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
              ) : null}

              {doc.constraints?.length ? (
                <Card className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <FileCode2 className="h-4 w-4 text-violet-400" />
                    <h3 className="text-base font-semibold">Technical Constraints</h3>
                  </div>
                  <ul className="space-y-2">
                    {doc.constraints.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground leading-6 list-disc ml-5">{item}</li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {doc.implementation_strategy?.length ? (
                <Card className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-base font-semibold">Implementation Strategy</h3>
                  </div>
                  <ul className="space-y-2">
                    {doc.implementation_strategy.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground leading-6 list-disc ml-5">{item}</li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {doc.common_mistakes?.length ? (
                <Card className="p-5 border-orange-500/20">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-400" />
                    <h3 className="text-base font-semibold">Common Mistakes</h3>
                  </div>
                  <ul className="space-y-2">
                    {doc.common_mistakes.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground leading-6 list-disc ml-5">{item}</li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {doc.files_involved?.length ? (
                <Card className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <FileCode2 className="h-4 w-4 text-cyan-400" />
                    <h3 className="text-base font-semibold">Files Involved</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {doc.files_involved.map((file, i) => (
                      <Badge key={i} variant="outline" className="font-mono text-[11px]">{file}</Badge>
                    ))}
                  </div>
                </Card>
              ) : null}

              {doc.resources?.length ? (
                <Card className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-sky-400" />
                    <h3 className="text-base font-semibold">Official Docs & Related Resources</h3>
                  </div>
                  <div className="space-y-3">
                    {doc.resources.map((resource, i) => (
                      <a
                        key={`${resource.url}-${i}`}
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md border p-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium leading-5">{resource.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground leading-5">{resource.description}</p>
                          </div>
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                      </a>
                    ))}
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><p className="text-muted-foreground">Loading learning module...</p></div>}>
      <LearnContent />
    </Suspense>
  )
}
