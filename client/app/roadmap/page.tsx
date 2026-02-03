'use client';

import React, { useCallback, useMemo } from 'react';
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
  // Generate test data with 100 nodes
  const roadmapData = useMemo(() => {
    const levels = [];
    const titles = [
      "Project Initialization",
      "Create Express Server",
      "Database Setup",
      "Create Models",
      "Create Services",
      "Create Controllers",
      "Create Routes",
      "Link Routes to Server"
    ];
    
    for (let i = 0; i < 100; i++) {
      levels.push({
        title: titles[i % titles.length],
        description: `Complete level ${i + 1} to unlock the next level.`,
        files: [`file-${i + 1}.js`]
      });
    }
    
    return {
      total: 100,
      levels
    };
  }, []);

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
          completed: index === 0, // First level unlocked
          locked: index > 0, // Rest are locked for demo
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

  return (
    <div className="roadmap-container">
      <div className="roadmap-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff6b9d" />
              <stop offset="50%" stopColor="#c44569" />
              <stop offset="100%" stopColor="#ff6b9d" />
            </linearGradient>
          </defs>
          <Background color="#aaa" gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
