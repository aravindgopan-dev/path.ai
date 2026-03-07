'use client';

import React, { useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './roadmap.css';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useAuth } from "@clerk/nextjs";
import { getFlatRoadmap, type RoadmapNode } from "@/lib/agents-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
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

// Level node component - styled like Candy Crush nodes
const LevelNode = ({ data }: { data: any }) => {
  const isCompleted = data.completed;
  const isLocked = data.locked;

  return (
    <>
      {data.targetPosition && (
        <Handle type="target" position={data.targetPosition} style={{ opacity: 0 }} />
      )}
      <div 
        className={`level-node ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}
        onClick={() => {
           if (!isLocked && data.onClick) data.onClick(data.nodeRaw);
        }}
      >
        <div className="level-number">{data.level}</div>
        <div className="level-stars">
          {[1, 2, 3].map((star) => (
            <span key={star} className={`star ${isCompleted ? 'filled' : ''}`}>
              ★
            </span>
          ))}
        </div>
        <div className="level-title flex items-center justify-center">
          {data.title}
        </div>
        {!isLocked && data.description && (
          <div className="level-description">{data.description}</div>
        )}
      </div>
      {data.sourcePosition && (
        <Handle type="source" position={data.sourcePosition} style={{ opacity: 0 }} />
      )}
    </>
  );
};

const nodeTypes = {
  levelNode: LevelNode,
};

export default function RoadmapPage() {
  const router = useRouter();
  const blueprint = useAppStore((s) => s.blueprint);
  const roadmapNodes = useAppStore((s) => s.roadmapNodes);
  const setRoadmapNodes = useAppStore((s) => s.setRoadmapNodes);
  const projectId = useAppStore((s) => s.projectId);
  const setActiveNodeId = useAppStore((s) => s.setActiveNodeId);
  const _hasHydrated = useAppStore((s) => s._hasHydrated);
  const { getToken } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [viewportWidth, setViewportWidth] = useState(1200);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setViewportWidth(window.innerWidth);
      const handleResize = () => setViewportWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    if (!_hasHydrated) return;
    let cancelled = false;
    const fetchRoadmap = async () => {
      if (!projectId) return;
      setIsLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const { roadmap } = await getFlatRoadmap(projectId, token ?? undefined);
        console.log("Entire roadmap:", roadmap);
        if (!cancelled) setRoadmapNodes(roadmap);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load roadmap");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchRoadmap();
    return () => { cancelled = true; };
  }, [_hasHydrated, projectId, setRoadmapNodes]);

  const handleNodeClick = (node: RoadmapNode) => {
    setSelectedNode(node);
    setIsModalOpen(true);
  };

  const handleStartNode = (node: RoadmapNode) => {
    setActiveNodeId(node.id);
    setIsModalOpen(false);
    if (node.type === "setup") {
      router.push(`/setup?id=${node.id}`);
    } else if (node.type === "learn") {
      router.push(`/learn?id=${node.id}`);
    } else {
      router.push(`/pair-programmer?id=${node.id}`);
    }
  };

  const initialNodes: Node[] = useMemo(() => {
    if (!roadmapNodes || roadmapNodes.length === 0) return [];
    
    const nodes: Node[] = [];
    const horizontalSpacing = Math.max(200, (viewportWidth - 400) / 2);
    const verticalSpacing = 250;
    
    roadmapNodes.forEach((level, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      
      const direction = row % 2 === 0 ? 1 : -1;
      const xPos = direction === 1 ? col * horizontalSpacing : (2 - col) * horizontalSpacing;
      
      const yPos = (Math.floor(roadmapNodes.length / 3) - row) * verticalSpacing;
      
      let sourcePosition = null;
      let targetPosition = null;
      
      const isLastInRow = col === 2;
      const isFirstInRow = col === 0;
      const isLastNode = index === roadmapNodes.length - 1;
      
      if (row % 2 === 0) {
        if (isFirstInRow) {
          targetPosition = index === 0 ? null : Position.Bottom;
          sourcePosition = isLastNode ? null : Position.Right;
        } else if (isLastInRow) {
          targetPosition = Position.Left;
          sourcePosition = isLastNode ? null : Position.Top;
        } else {
          targetPosition = Position.Left;
          sourcePosition = Position.Right;
        }
      } else {
        if (isFirstInRow) {
          targetPosition = Position.Bottom;
          sourcePosition = isLastNode ? null : Position.Left;
        } else if (isLastInRow) {
          targetPosition = Position.Right;
          sourcePosition = isLastNode ? null : Position.Top;
        } else {
          targetPosition = Position.Right;
          sourcePosition = Position.Left;
        }
      }
      
      nodes.push({
        id: `level-${index + 1}`,
        type: 'levelNode',
        position: { x: xPos + 100, y: yPos + 100 },
        data: {
          level: index + 1,
          title: level.title,
          description: level.description,
          completed: level.completed,
          locked: level.locked,
          sourcePosition,
          targetPosition,
          nodeRaw: level,
          onClick: handleNodeClick
        },
      });
    });
    
    return nodes;
  }, [roadmapNodes, viewportWidth]);

  const initialEdges: Edge[] = useMemo(() => {
    if (!roadmapNodes || roadmapNodes.length === 0) return [];
    const edges: Edge[] = [];
    
    for (let i = 0; i < roadmapNodes.length - 1; i++) {
      edges.push({
        id: `edge-${i}`,
        source: `level-${i + 1}`,
        target: `level-${i + 2}`,
        type: 'smoothstep',
      });
    }
    
    return edges;
  }, [roadmapNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (!_hasHydrated) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!projectId) return (
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

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Loading your roadmap...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-destructive">Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.push("/skill-level")}>Go Back</Button>
      </div>
    </div>
  );

  return (
    <div className="roadmap-container">
      <div className="absolute top-4 left-4 z-10">
        <Button
          variant="outline"
          onClick={() => router.push("/skill-level")}
          className="gap-2 bg-background/80 backdrop-blur"
        >
          ← Back
        </Button>
      </div>
      <div className="absolute top-4 right-4 z-10">
        <div className="max-w-md bg-background/80 backdrop-blur p-4 rounded-xl border border-white/10">
          <h1 className="text-xl font-bold tracking-tight">
            {blueprint?.name ?? "Your Learning Path"}
          </h1>
        </div>
      </div>

      <div className="roadmap-flow">
        {nodes.length > 0 && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.5}
            maxZoom={1.5}
            zoomOnScroll={false}
            zoomOnPinch={true}
            zoomOnDoubleClick={true}
            panOnDrag={true}
            panOnScroll={true}
            panOnScrollSpeed={0.5}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <svg>
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff6b9d" />
                  <stop offset="50%" stopColor="#c44569" />
                  <stop offset="100%" stopColor="#ff6b9d" />
                </linearGradient>
              </defs>
            </svg>
            <Background color="#1a1c38" gap={16} />
            <Controls />
          </ReactFlow>
        )}
      </div>

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

                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    Objective
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedNode.description}
                  </p>
                </div>

                {((selectedNode.expected_spec?.expected_files && selectedNode.expected_spec.expected_files.length > 0) || (selectedNode.metadata?.files && selectedNode.metadata.files.length > 0)) && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Files Involved</h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedNode.expected_spec?.expected_files ?? selectedNode.metadata?.files ?? []).map((f: string) => (
                        <Badge key={f} variant="secondary" className="font-mono text-[11px]">
                          <FileCode className="h-3 w-3 mr-1" />{f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {((selectedNode.expected_spec?.validation_rules && selectedNode.expected_spec.validation_rules.length > 0) || 
                  (selectedNode.documentation?.algorithm_steps && selectedNode.documentation.algorithm_steps.length > 0)) && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">
                      {selectedNode.type === 'code' ? "Validation Criteria" : "Steps to Follow"}
                    </h4>
                    <ul className="space-y-2">
                      {selectedNode.type === 'code' ? (
                        selectedNode.expected_spec?.validation_rules.map((v: any, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                            {typeof v === 'string' ? v : v.contains ? `Must contain: ${v.contains}` : JSON.stringify(v)}
                          </li>
                        ))
                      ) : (
                        selectedNode.documentation?.algorithm_steps.map((s: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                            {s}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}

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
