'use client';

import { useCallback, useState, useEffect } from 'react';
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

  // Track which nodes are expanded
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['node-0']));
  
  // Build a map of node IDs to their data for quick lookup
  const [nodeDataMap] = useState<Map<string, { node: FileNode; depth: number; parentId: string | null }>>(() => {
    const map = new Map();
    let nodeId = 0;

    const traverse = (node: FileNode, depth: number, parentId: string | null) => {
      const currentId = `node-${nodeId++}`;
      map.set(currentId, { node, depth, parentId });
      
      if (node.children) {
        node.children.forEach(child => traverse(child, depth + 1, currentId));
      }
    };

    traverse(fileTree, 0, null);
    return map;
  });

  // Generate nodes and edges based on expanded state
  const generateNodesAndEdges = useCallback(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const HORIZONTAL_SPACING = 250;
    const VERTICAL_SPACING = 100;

    // Store node positions
    const nodePositions = new Map<string, { x: number; y: number }>();

    // Collect all visible node IDs in order using BFS
    const visibleNodeIds: string[] = [];
    const queue = ['node-0'];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      
      visited.add(nodeId);
      visibleNodeIds.push(nodeId);
      
      // Only add children if this node is expanded
      if (expandedNodes.has(nodeId)) {
        // Find all children of this node
        const children: string[] = [];
        nodeDataMap.forEach((data, id) => {
          if (data.parentId === nodeId) {
            children.push(id);
          }
        });
        // Add children to queue
        queue.push(...children);
      }
    }

    // Calculate positions for all visible nodes
    // First pass: calculate positions based on parent positions
    visibleNodeIds.forEach((nodeId, index) => {
      const data = nodeDataMap.get(nodeId);
      if (!data) return;

      const { depth, parentId } = data;
      const x = depth * HORIZONTAL_SPACING;
      let y = 0;

      if (parentId && nodePositions.has(parentId)) {
        // Position children relative to parent
        const parentPos = nodePositions.get(parentId)!;
        
        // Find all siblings (children of the same parent)
        const siblings: string[] = [];
        visibleNodeIds.forEach(id => {
          const siblingData = nodeDataMap.get(id);
          if (siblingData && siblingData.parentId === parentId) {
            siblings.push(id);
          }
        });
        
        // Find this node's index among siblings
        const siblingIndex = siblings.indexOf(nodeId);
        const totalSiblings = siblings.length;
        
        // Center children around parent's Y position
        const startY = parentPos.y - ((totalSiblings - 1) * VERTICAL_SPACING) / 2;
        y = startY + siblingIndex * VERTICAL_SPACING;
      } else {
        // Root node at y = 0
        y = 0;
      }

      nodePositions.set(nodeId, { x, y });
    });

    // Create nodes with calculated positions
    visibleNodeIds.forEach(nodeId => {
      const data = nodeDataMap.get(nodeId);
      if (!data) return;

      const { node, parentId } = data;
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(nodeId);
      const position = nodePositions.get(nodeId)!;
      
      // Create label with expand/collapse indicator
      const label = hasChildren 
        ? `${isExpanded ? '[-]' : '[+]'} ${node.name}`
        : node.name;
      
      nodes.push({
        id: nodeId,
        data: { 
          label,
          type: node.type,
          language: node.language,
          hasChildren,
          isExpanded,
          nodeData: node
        },
        position,
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
          cursor: hasChildren ? 'pointer' : 'default',
        },
      });
    });

    // Create edges after all nodes are created
    visibleNodeIds.forEach(nodeId => {
      const data = nodeDataMap.get(nodeId);
      if (!data || !data.parentId) return;

      const { parentId } = data;
      
      // Only create edge if parent is also visible
      if (visited.has(parentId)) {
        edges.push({
          id: `edge-${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          type: 'default',
          animated: true,
          style: { stroke: '#64748b', strokeWidth: 2 },
        });
      }
    });

    return { nodes, edges };
  }, [expandedNodes, nodeDataMap]);

  const { nodes: generatedNodes, edges: generatedEdges } = generateNodesAndEdges();
  const [nodes, setNodes, onNodesChange] = useNodesState(generatedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(generatedEdges);

  // Update nodes and edges when expanded state changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges();
    setNodes(newNodes);
    setEdges(newEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedNodes]);

  // Handle node click to expand/collapse
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const hasChildren = node.data.hasChildren;
    
    if (hasChildren) {
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(node.id)) {
          // Collapse: remove this node and all its descendants
          const toRemove = new Set<string>();
          const queue = [node.id];
          
          while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (currentId !== node.id) {
              toRemove.add(currentId);
            }
            
            nodeDataMap.forEach((data, id) => {
              if (data.parentId === currentId) {
                queue.push(id);
              }
            });
          }
          
          toRemove.forEach(id => newSet.delete(id));
          newSet.delete(node.id);
        } else {
          // Expand
          newSet.add(node.id);
        }
        return newSet;
      });
    }
  }, [nodeDataMap]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
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






