'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './roadmap.css';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Star, Terminal, FileCode, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// Level node component - styled like Candy Crush nodes
const LevelNode = ({ data }: { data: any }) => {
  const isCompleted = data.completed;
  const isLocked = data.locked;

  return (
    <>
      {data.targetPosition && (
        <Handle type="target" position={data.targetPosition} style={{ opacity: 0 }} />
      )}
      <div className={`level-node ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}>
        <div className="level-number">{data.level}</div>
        <div className="level-stars">
          {[1, 2, 3].map((star) => (
            <span key={star} className={`star ${isCompleted ? 'filled' : ''}`}>
              ★
            </span>
          ))}
        </div>
        <div className="level-title">{data.title}</div>
        {!isLocked && (
          <div className="level-description">{data.description}</div>
        )}
        {data.files && data.files.length > 0 && (
          <div className="level-files">
            {data.files.map((file: string, idx: number) => (
              <div key={idx} className="file-tag">{file}</div>
            ))}
          </div>
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
  const projectSpec = useAppStore((state) => state.projectSpec);
  const completeLevel = useAppStore((state) => state.completeLevel);
  const unlockLevel = useAppStore((state) => state.unlockLevel);
  const setCurrentFile = useAppStore((state) => state.setCurrentFile);
  const addToHistory = useAppStore((state) => state.addToHistory);
  const _hasHydrated = useAppStore((state) => state._hasHydrated);

  const [selectedLevel, setSelectedLevel] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sync with sandbox (persistence as in designer agent)
  useEffect(() => {
    if (!projectSpec) return;
    const socket = getSocket();
    
    console.log('[Roadmap] Syncing with sandbox...');
    socket.emit('create-project', projectSpec);

    socket.on('project-created', (response: any) => {
      if (response.success) {
        console.log('[Roadmap] Project ready in sandbox:', response.path);
      }
    });

    return () => {
      socket.off('project-created');
    };
  }, [projectSpec]);
  
  // Use data from store or empty object while loading
  const roadmapData = useMemo(() => {
    if (!projectSpec || !projectSpec.levels) {
      return { total: 0, levels: [] };
    }
    
    return {
      total: projectSpec.levels.length,
      levels: projectSpec.levels
    };
  }, [projectSpec]);

  // Create a winding path layout like Candy Crush
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [];
    // Calculate spacing to use full width - 3 nodes per row with padding
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const horizontalSpacing = (viewportWidth - 400) / 2; // Divide available space by 2 (for 3 nodes)
    const verticalSpacing = 250;   // Vertical space
    
    roadmapData.levels.forEach((level, index) => {
      // Create a serpentine (S-shaped) path
      const row = Math.floor(index / 3);
      const col = index % 3;
      
      // Alternate direction every row
      const direction = row % 2 === 0 ? 1 : -1;
      const xPos = direction === 1 ? col * horizontalSpacing : (2 - col) * horizontalSpacing;
      
      // Reverse Y position: higher levels go up
      const yPos = (Math.floor(roadmapData.levels.length / 3) - row) * verticalSpacing;
      
      // Determine handle positions based on position in path
      let sourcePosition = null;
      let targetPosition = null;
      
      const isLastInRow = col === 2;
      const isFirstInRow = col === 0;
      const isLastNode = index === roadmapData.levels.length - 1;
      
      if (row % 2 === 0) {
        // Even rows: moving right (1 → 2 → 3, 7 → 8)
        // First node in row
        if (isFirstInRow) {
          // Very first node (index 0) has no target
          // Other first nodes receive from below
          targetPosition = index === 0 ? null : Position.Bottom;
          sourcePosition = isLastNode ? null : Position.Right;
        } else if (isLastInRow) {
          // Last node in row: receives from left, connects upward
          targetPosition = Position.Left;
          sourcePosition = isLastNode ? null : Position.Top;
        } else {
          // Middle nodes: receive from left, connect right
          targetPosition = Position.Left;
          sourcePosition = Position.Right;
        }
      } else {
        // Odd rows: moving left (6 ← 5 ← 4)
        // Visual layout is reversed, so col=0 is rightmost
        if (isFirstInRow) {
          // col=0 means rightmost visually, receives from below
          targetPosition = Position.Bottom;
          sourcePosition = isLastNode ? null : Position.Left;
        } else if (isLastInRow) {
          // col=2 means leftmost visually, connects upward
          targetPosition = Position.Right;
          sourcePosition = isLastNode ? null : Position.Top;
        } else {
          // Middle nodes
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
          files: level.files,
          validationCriteria: level.validationCriteria,
          completed: level.completed ?? (index === 0), // Default first level unlocked
          locked: level.locked ?? (index > 0), 
          sourcePosition,
          targetPosition,
        },
      });
    });
    
    return nodes;
  }, [roadmapData]);

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    
    for (let i = 0; i < roadmapData.levels.length - 1; i++) {
      edges.push({
        id: `edge-${i}`,
        source: `level-${i + 1}`,
        target: `level-${i + 2}`,
        type: 'smoothstep',
      });
    }
    
    return edges;
  }, [roadmapData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when initial data changes (e.g., after hydration)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedLevel(node.data);
    setIsModalOpen(true);
  }, []);

  if (!_hasHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1c38] text-white">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
          <p className="text-gray-400">Loading roadmap...</p>
        </div>
      </div>
    );
  }

  if (!projectSpec) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1c38] text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Roadmap Found</h2>
          <p className="text-gray-400">Please start a new project in the Architect first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="roadmap-container">
      <div className="roadmap-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={1}
          maxZoom={1}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          panOnDrag={false}
          panOnScroll={true}
          panOnScrollSpeed={0.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
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
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-[#1a1c38] border-border/20 text-white overflow-hidden p-0">
          {selectedLevel && (
            <div className="flex flex-col h-full">
              {/* Header with Background Pattern */}
              <div className="relative p-6 bg-gradient-to-br from-[#2a2d5a] to-[#1a1c38] border-b border-border/10">
                <div className="absolute top-4 right-4 flex gap-1">
                  {[1, 2, 3].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        "h-5 w-5",
                        selectedLevel.completed ? "text-yellow-400 fill-yellow-400" : "text-white/20"
                      )}
                    />
                  ))}
                </div>
                
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 text-2xl font-black text-primary">
                    {selectedLevel.level}
                  </div>
                  <Badge variant={selectedLevel.completed ? "default" : "secondary"} className="text-xs uppercase tracking-wider font-bold">
                    {selectedLevel.completed ? "Unlocked" : "Locked"}
                  </Badge>
                </div>
                
                <DialogTitle className="text-2xl font-black tracking-tight mb-1">
                  {selectedLevel.title}
                </DialogTitle>
                <div className="text-white/60 text-sm leading-relaxed">
                  Level {selectedLevel.level} of {roadmapData.total}
                </div>
              </div>

              {/* Content Area */}
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {/* Task Description */}
                <div>
                  <h4 className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider mb-3">
                    <Terminal className="h-4 w-4" />
                    Objective
                  </h4>
                  <p className="text-white/80 leading-relaxed text-sm bg-black/20 p-4 rounded-xl border border-white/5">
                    {selectedLevel.description}
                  </p>
                </div>

                {/* Files Involved */}
                {selectedLevel.files && selectedLevel.files.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider mb-3">
                      <FileCode className="h-4 w-4" />
                      Files Involved
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedLevel.files.map((file: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/90">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validation Criteria */}
                {selectedLevel.validationCriteria && selectedLevel.validationCriteria.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider mb-3">
                      <CheckSquare className="h-4 w-4" />
                      Validation Criteria
                    </h4>
                    <ul className="space-y-2.5">
                      {selectedLevel.validationCriteria.map((criteria: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-black/20 border border-white/5 group transition-colors hover:border-primary/20">
                          <div className="mt-1 h-2 w-2 rounded-full border border-primary/50 group-hover:bg-primary/50 transition-colors shrink-0" />
                          <span className="text-sm text-white/70">{criteria}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 bg-black/20 border-t border-border/10 flex gap-3">
                {selectedLevel.locked ? (
                  <Button 
                    className="flex-1 font-bold h-12 rounded-xl"
                    variant="secondary"
                    onClick={() => {
                        unlockLevel(selectedLevel.level);
                        setIsModalOpen(false);
                    }}
                  >
                    Unlock Level
                  </Button>
                ) : (
                  <Button 
                    className="flex-1 font-bold h-12 rounded-xl" 
                    onClick={() => {
                        // Mark as completed and open editor
                        completeLevel(selectedLevel.level);
                        if (selectedLevel.level < roadmapData.total) {
                            unlockLevel(selectedLevel.level + 1);
                        }
                        
                        // Set up editor
                        if (selectedLevel.files && selectedLevel.files.length > 0) {
                            const firstFile = selectedLevel.files[0];
                            const fileData = {
                                name: firstFile,
                                language: 'typescript',
                                description: `Working on: ${selectedLevel.title}`,
                                content: `// Task: ${selectedLevel.description}\n// File: ${firstFile}\n\n// Start coding here...`,
                                path: firstFile,
                            };
                            setCurrentFile(fileData);
                            addToHistory(fileData);
                            router.push('/pair-programmer');
                        }
                        setIsModalOpen(false);
                    }}
                  >
                    {selectedLevel.completed ? "Continue Coding" : "Start Level"}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="flex-1 font-bold h-12 rounded-xl border-white/10 hover:bg-white/5"
                  onClick={() => setIsModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
