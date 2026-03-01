'use client';

import React, { useState, useEffect } from 'react';
import './roadmap.css';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  BookOpen,
  Code2,
  CheckCircle2,
  Loader2,
  Lock,
  FileCode,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  getFlatRoadmap,
  type RoadmapNode,
} from "@/lib/agents-api";

// ── TYPE META ────────────────────────────────────
const TYPE_META: Record<string, {
  label: string;
  icon: React.ElementType;
  gradient: string;
  color: string;
  lightColor: string;
}> = {
  setup: {
    label: "Setup",
    icon: Settings,
    gradient: "from-emerald-500 to-teal-600",
    color: "text-emerald-400",
    lightColor: "bg-emerald-500/10",
  },
  learn: {
    label: "Learning",
    icon: BookOpen,
    gradient: "from-blue-500 to-indigo-600",
    color: "text-blue-400",
    lightColor: "bg-blue-500/10",
  },
  code: {
    label: "Coding",
    icon: Code2,
    gradient: "from-amber-500 to-orange-600",
    color: "text-amber-400",
    lightColor: "bg-amber-500/10",
  },
};

// ── NODE CARD COMPONENT ──────────────────────────
function PathNode({
  node,
  index,
  isNext,
  onClick,
}: {
  node: RoadmapNode;
  index: number;
  isNext: boolean;
  onClick: (node: RoadmapNode) => void;
}) {
  const meta = TYPE_META[node.type] ?? TYPE_META.code;
  const Icon = meta.icon;

  return (
    <div className="roadmap-path-item">
      {/* Connector line before node */}
      {index > 0 && (
        <div className={cn(
          "roadmap-connector",
          node.completed && "roadmap-connector-completed",
          node.locked && "roadmap-connector-locked",
        )} />
      )}

      {/* Node container */}
      <div
        className={cn(
          "roadmap-node",
          node.locked && "roadmap-node-locked",
          node.completed && "roadmap-node-completed",
          isNext && !node.locked && !node.completed && "roadmap-node-next",
        )}
        onClick={() => !node.locked && onClick(node)}
      >
        {/* Left indicator bar */}
        <div className={cn(
          "roadmap-node-bar",
          !node.locked && `bg-gradient-to-b ${meta.gradient}`,
          node.locked && "bg-zinc-700",
          node.completed && "bg-emerald-500",
        )} />

        {/* Main content */}
        <div className="roadmap-node-content">
          {/* Level number and icon */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "roadmap-node-badge",
              !node.locked && meta.lightColor,
              node.locked && "bg-zinc-800",
              node.completed && "bg-emerald-500/10",
            )}>
              {node.completed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : node.locked ? (
                <Lock className="h-5 w-5 text-zinc-500" />
              ) : (
                <>
                  <Icon className={cn("h-5 w-5", meta.color)} />
                  <span className="text-sm font-bold text-foreground/80">{index + 1}</span>
                </>
              )}
            </div>

            {/* Title and type badge */}
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "roadmap-node-title",
                node.locked && "text-muted-foreground",
              )}>
                {node.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                  {meta.label}
                </Badge>
                {node.completed && (
                  <Badge className="text-[10px] px-1.5 py-0 h-5 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Done
                  </Badge>
                )}
              </div>
            </div>

            {/* CTA Icon */}
            {!node.locked && (
              <ChevronRight className={cn(
                "h-5 w-5 text-muted-foreground transition-colors",
                isNext && "text-primary",
              )} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ROADMAP COMPONENT ──────────────────────
export default function RoadmapPage() {
  const router = useRouter();
  const blueprint = useAppStore((s) => s.blueprint);
  const roadmapNodes = useAppStore((s) => s.roadmapNodes);
  const setRoadmapNodes = useAppStore((s) => s.setRoadmapNodes);
  const projectId = useAppStore((s) => s.projectId);
  const setActiveNodeId = useAppStore((s) => s.setActiveNodeId);
  const _hasHydrated = useAppStore((s) => s._hasHydrated);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch roadmap on mount
  useEffect(() => {
    if (!_hasHydrated) return;

    let cancelled = false;

    const fetchRoadmap = async () => {
      if (!projectId) return;
      setIsLoading(true);
      setError(null);
      try {
        const { roadmap } = await getFlatRoadmap(projectId);
        if (!cancelled) {
          setRoadmapNodes(roadmap);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load roadmap");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchRoadmap();
    return () => { cancelled = true; };
  }, [_hasHydrated, projectId, setRoadmapNodes]);

  // Calculate stats
  const totalProgress = roadmapNodes.length > 0
    ? Math.round((roadmapNodes.filter((n) => n.completed).length / roadmapNodes.length) * 100)
    : 0;

  // Find next unlockable node
  const nextUnlockableIdx = roadmapNodes.findIndex((n) => !n.completed && !n.locked);

  const handleNodeClick = (node: RoadmapNode) => {
    setSelectedNode(node);
    setIsModalOpen(true);
  };

  const handleStartNode = (node: RoadmapNode) => {
    setActiveNodeId(node.id);
    setIsModalOpen(false);
    router.push(`/pair-programmer?id=${node.id}`);
  };

  // ── Loading states ──────────────────────────────
  if (!_hasHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">No Project Found</h2>
          <p className="text-muted-foreground">
            Please start a new project in the Architect first.
          </p>
          <Button onClick={() => router.push("/architect")}>Go to Architect</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your roadmap...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-destructive">Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => router.push("/skill-level")}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="roadmap-page-new">
      {/* Header */}
      <div className="roadmap-header-new">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            {blueprint?.name ?? "Your Learning Path"}
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Complete each level to unlock the next one
          </p>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-muted-foreground">Progress</span>
              <span className={totalProgress === 100 ? "text-emerald-400" : "text-primary"}>
                {totalProgress}%
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500 rounded-full",
                  totalProgress === 100
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : "bg-gradient-to-r from-purple-500 to-pink-500"
                )}
                style={{ width: `${totalProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Roadmap path */}
      <div className="roadmap-path-container">
        <div className="max-w-2xl mx-auto px-6 py-12">
          {roadmapNodes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No levels found</p>
            </div>
          ) : (
            <div className="space-y-0">
              {roadmapNodes.map((node, idx) => (
                <PathNode
                  key={node.id}
                  node={node}
                  index={idx}
                  isNext={idx === nextUnlockableIdx}
                  onClick={handleNodeClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Back button */}
      <div className="roadmap-footer-new">
        <Button
          variant="outline"
          onClick={() => router.push("/skill-level")}
          className="gap-2"
        >
          ← Back to Skills
        </Button>
      </div>

      {/* Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          {selectedNode && (() => {
            const meta = TYPE_META[selectedNode.type] ?? TYPE_META.code;
            const Icon = meta.icon;
            return (
              <div className="space-y-6">
                <DialogHeader>
                  <div className="flex items-center gap-4 mb-2">
                    <div className={cn(
                      "p-3 rounded-lg bg-gradient-to-br shadow-lg",
                      meta.gradient,
                    )}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <DialogTitle className="text-2xl">{selectedNode.title}</DialogTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="capitalize text-xs">
                          {meta.label}
                        </Badge>
                        {selectedNode.completed && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
                          </Badge>
                        )}
                        {selectedNode.locked && (
                          <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-xs">
                            <Lock className="h-3 w-3 mr-1" /> Locked
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                {/* Description */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    Objective
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedNode.description}
                  </p>
                </div>

                {/* Files */}
                {selectedNode.files && selectedNode.files.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Files Involved</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedNode.files.map((f) => (
                        <Badge key={f} variant="secondary" className="font-mono text-[11px]">
                          <FileCode className="h-3 w-3 mr-1" />{f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validation Criteria */}
                {selectedNode.validationCriteria && selectedNode.validationCriteria.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">What You'll Learn</h4>
                    <ul className="space-y-2">
                      {selectedNode.validationCriteria.map((v, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                          {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Dependencies */}
                {selectedNode.dependencies && selectedNode.dependencies.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Prerequisites</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedNode.dependencies.map((d) => {
                        const depNode = roadmapNodes.find((n) => n.id === d);
                        return (
                          <Badge key={d} variant="secondary" className="text-xs">
                            {depNode?.title ?? d}
                            {depNode?.completed && (
                              <CheckCircle2 className="h-3 w-3 ml-1 text-emerald-400" />
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Action buttons */}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => handleStartNode(selectedNode)}
                    disabled={selectedNode.locked}
                    className={cn(
                      "gap-2",
                      !selectedNode.locked && "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0",
                    )}
                  >
                    {selectedNode.locked ? (
                      <><Lock className="h-4 w-4" /> Locked</>
                    ) : selectedNode.completed ? (
                      <><CheckCircle2 className="h-4 w-4" /> Revisit</>
                    ) : (
                      <>
                        <ChevronRight className="h-4 w-4" />
                        {selectedNode.type === "code" ? "Start Coding" :
                         selectedNode.type === "learn" ? "Start Learning" :
                         selectedNode.type === "setup" ? "Start Setup" : "Start"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
