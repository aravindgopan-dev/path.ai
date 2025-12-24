'use client';

import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  language?: string;
  content?: string;
  children?: FileNode[];
}

export default function Designer() {
  const fileTree: FileNode = {
    name: "root",
    type: "directory",
    children: [
      {
        name: "main.go",
        type: "file",
        language: "go",
        content: ""
      },
      {
        name: "go.mod",
        type: "file",
        content: ""
      },
      {
        name: "internal",
        type: "directory",
        children: [
          {
            name: "service",
            type: "directory",
            children: [
              {
                name: "user_service.go",
                type: "file",
                language: "go",
                content: ""
              }
            ]
          },
          {
            name: "repository",
            type: "directory",
            children: [
              {
                name: "user_repo.go",
                type: "file",
                language: "go",
                content: ""
              }
            ]
          }
        ]
      }
    ]
  };

  // Convert file tree to React Flow nodes and edges with horizontal layout
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let nodeId = 0;

    const HORIZONTAL_SPACING = 250;
    const VERTICAL_SPACING = 80;

    // Recursive function to build nodes with horizontal layout
    const buildTree = (
      node: FileNode,
      depth: number,
      parentId: string | null,
      verticalOffset: { value: number }
    ): number => {
      const currentId = `node-${nodeId++}`;
      const currentY = verticalOffset.value;
      
      // Create node
      nodes.push({
        id: currentId,
        data: { 
          label: node.name,
          type: node.type,
          language: node.language 
        },
        position: { 
          x: depth * HORIZONTAL_SPACING, 
          y: currentY 
        },
        type: 'default',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: node.type === 'directory' ? '#6366f1' : '#10b981',
          color: 'white',
          border: '2px solid #1e293b',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: '500',
          minWidth: '120px',
          textAlign: 'center',
        },
      });

      // Create edge from parent
      if (parentId) {
        edges.push({
          id: `edge-${parentId}-${currentId}`,
          source: parentId,
          target: currentId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#64748b', strokeWidth: 2 },
        });
      }

      // Process children
      if (node.children && node.children.length > 0) {
        verticalOffset.value += VERTICAL_SPACING;
        
        node.children.forEach((child, index) => {
          if (index > 0) {
            verticalOffset.value += VERTICAL_SPACING;
          }
          buildTree(child, depth + 1, currentId, verticalOffset);
        });
      }

      return currentY;
    };

    buildTree(fileTree, 0, null, { value: 0 });

    return { nodes, edges };
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#94a3b8" gap={16} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            return node.data.type === 'directory' ? '#6366f1' : '#10b981';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}






