import dagre from 'dagre';
import { Node, Edge, Position } from 'reactflow';
import type { Architecture, ArchitectureLayer } from '@/lib/types';

export const LAYER_NODE_WIDTH = 208;
export const LAYER_NODE_HEIGHT = 92;

export interface ArchitectureLayerNodeData {
  layer: ArchitectureLayer;
  isSelected: boolean;
}

/**
 * Lays out layer nodes top-to-bottom by tier (cross-cutting layers with a
 * null tier are pinned to their own row below everything else) and draws
 * one edge per source/target layer pair, so the diagram reads as "how does
 * a request/data flow through this codebase" rather than a file-level map.
 */
export function layoutArchitecture(architecture: Architecture, selectedLayerId: string | null) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 110 });

  architecture.layers.forEach((layer) => {
    g.setNode(layer.id, { width: LAYER_NODE_WIDTH, height: LAYER_NODE_HEIGHT });
  });

  architecture.edges.forEach((edge) => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  // Cross-cutting layers (tier === null) have no natural rank — nudge them
  // below the deepest real tier with a zero-weight edge so they settle into
  // their own row instead of landing wherever their first edge points.
  const maxTier = Math.max(0, ...architecture.layers.map((l) => l.tier ?? -1));
  const anchor = architecture.layers.find((l) => l.tier === maxTier);
  architecture.layers
    .filter((l) => l.tier === null)
    .forEach((l) => {
      if (anchor && anchor.id !== l.id) g.setEdge(anchor.id, l.id, { weight: 0, minlen: 1 });
    });

  dagre.layout(g);

  const nodes: Node<ArchitectureLayerNodeData>[] = architecture.layers.map((layer) => {
    const pos = g.node(layer.id);
    return {
      id: layer.id,
      type: 'layerNode',
      position: {
        x: pos ? pos.x - LAYER_NODE_WIDTH / 2 : 0,
        y: pos ? pos.y - LAYER_NODE_HEIGHT / 2 : 0,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: { layer, isSelected: layer.id === selectedLayerId },
    };
  });

  const edges: Edge[] = architecture.edges.map((edge, i) => ({
    id: `ae${i}`,
    source: edge.source,
    target: edge.target,
    type: 'straight',
    label: `${edge.weight}`,
    labelBgPadding: [4, 2],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: '#12151C', fillOpacity: 0.9 },
    labelStyle: { fill: '#8B92A3', fontFamily: 'var(--font-mono)', fontSize: 10 },
    animated: edge.direction === 'backward',
    className:
      edge.direction === 'backward' ? 'violation-edge' : edge.direction === 'lateral' ? 'lateral-edge' : undefined,
    style: { strokeWidth: Math.min(5, 1.5 + Math.log2(edge.weight + 1)) },
    data: edge,
  }));

  return { nodes, edges };
}
