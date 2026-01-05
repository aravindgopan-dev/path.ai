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

interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  language?: string;
  description?: string;
  children?: TreeNode[];
}

interface ProjectSpec {
  projectName: string;
  description: string;
  features: Array<{
    id: string;
    name: string;
    description: string;
    category?: string;
  }>;
  designerInput: {
    nodes: TreeNode[];
  };
  projectMarkdown: string;
}

function DesignerContent() {
  const [projectSpec, setProjectSpec] = useState<ProjectSpec | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['node-0']));
  const [nodeDataMap, setNodeDataMap] = useState<Map<string, { node: TreeNode; depth: number; parentId: string | null }>>(new Map());

  useEffect(() => {
    if (typeof window !== "undefined") {
      const spec = sessionStorage.getItem("projectSpec");
      if (spec) {
        try {
          setProjectSpec(JSON.parse(spec));
          sessionStorage.removeItem("projectSpec");
        } catch (err) {
          console.error('Failed to parse spec:', err);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!projectSpec?.designerInput?.nodes) return;

    const map = new Map<string, { node: TreeNode; depth: number; parentId: string | null }>();
    let nodeId = 0;

    const traverse = (node: TreeNode, depth: number, parentId: string | null) => {
      const currentId = `node-${nodeId++}`;
      map.set(currentId, { node, depth, parentId });
      
      if (node.children) {
        node.children.forEach(child => traverse(child, depth + 1, currentId));
      }
    };

    traverse({ name: 'root', type: 'directory', children: projectSpec.designerInput.nodes }, 0, null);
    setNodeDataMap(map);
    setExpandedNodes(new Set(['node-0']));
  }, [projectSpec]);

  const generateNodesAndEdges = useCallback(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const HORIZONTAL_SPACING = 250;
    const VERTICAL_SPACING = 100;

    const nodePositions = new Map<string, { x: number; y: number }>();

    const visibleNodeIds: string[] = [];
    const queue = ['node-0'];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      
      visited.add(nodeId);
      visibleNodeIds.push(nodeId);
      
      if (expandedNodes.has(nodeId)) {
        const children: string[] = [];
        nodeDataMap.forEach((data, id) => {
          if (data.parentId === nodeId) {
            children.push(id);
          }
        });
        queue.push(...children);
      }
    }

    visibleNodeIds.forEach((nodeId, index) => {
      const data = nodeDataMap.get(nodeId);
      if (!data) return;

      const { depth, parentId } = data;
      const x = depth * HORIZONTAL_SPACING;
      let y = 0;

      if (parentId && nodePositions.has(parentId)) {
        const parentPos = nodePositions.get(parentId)!;
        
        const siblings: string[] = [];
        visibleNodeIds.forEach(id => {
          const siblingData = nodeDataMap.get(id);
          if (siblingData && siblingData.parentId === parentId) {
            siblings.push(id);
          }
        });
        
        const siblingIndex = siblings.indexOf(nodeId);
        const totalSiblings = siblings.length;
        
        const startY = parentPos.y - ((totalSiblings - 1) * VERTICAL_SPACING) / 2;
        y = startY + siblingIndex * VERTICAL_SPACING;
      } else {
        y = 0;
      }

      nodePositions.set(nodeId, { x, y });
    });

    visibleNodeIds.forEach(nodeId => {
      const data = nodeDataMap.get(nodeId);
      if (!data) return;

      const { node, parentId } = data;
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(nodeId);
      const position = nodePositions.get(nodeId)!;
      
      const labelText = hasChildren 
        ? `${isExpanded ? '[-]' : '[+]'} ${node.name}`
        : node.name;
      const label = (
        <span title={node.description || 'No description'}>{labelText}</span>
      );
      
      nodes.push({
        id: nodeId,
        data: { 
          label,
          type: node.type,
          language: node.language,
          description: node.description || "No description",
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
          textAlign: 'center' as const,
          cursor: hasChildren ? 'pointer' : 'default',
        },
      });
    });

    visibleNodeIds.forEach(nodeId => {
      const data = nodeDataMap.get(nodeId);
      if (!data || !data.parentId) return;

      const { parentId } = data;
      
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

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges();
    setNodes(newNodes);
    setEdges(newEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedNodes]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const hasChildren = node.data.hasChildren;
    
    if (hasChildren) {
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(node.id)) {
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
          newSet.add(node.id);
        }
        return newSet;
      });
    }
  }, [nodeDataMap]);

  if (!projectSpec) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">No Project Loaded</h2>
          <p className="text-muted-foreground">Please start a project from the Architect module</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur p-4 rounded-lg border max-w-sm">
        <h2 className="font-bold text-lg">{projectSpec.projectName}</h2>
        <p className="text-sm text-muted-foreground mt-1">{projectSpec.description}</p>
      </div>
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

export default function Designer() {
  return <DesignerContent />;
}






