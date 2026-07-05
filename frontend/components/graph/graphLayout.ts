import dagre from 'dagre';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceX,
  forceY,
  SimulationNodeDatum,
} from 'd3-force';
import { Node, Edge, Position } from 'reactflow';
import type { FileGraphNodeData } from './FileGraphNode';

export type LayoutMode = 'dagre' | 'force' | 'cluster';

export const LAYOUT_MODES: { id: LayoutMode; label: string; hint: string }[] = [
  { id: 'dagre', label: 'Tree', hint: 'Hierarchical top-down layout, ideal for smaller repos' },
  { id: 'force', label: 'Force', hint: 'Physics-based layout — tightly-coupled modules cluster together' },
  { id: 'cluster', label: 'Folders', hint: 'Grouped by top-level directory, mirrors your file tree' },
];

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;
// Large graphs render nodes as smaller text-only chips (see FileGraphNode's
// `compact` prop) so hundreds of files take less screen area, leaving more
// room for the layout algorithms to actually spread things out.
export const COMPACT_NODE_WIDTH = 130;
export const COMPACT_NODE_HEIGHT = 32;

/** Repos above this many visible nodes default to the force layout instead of dagre. */
export const LARGE_REPO_NODE_THRESHOLD = 60;

/** Repos above this many visible nodes render compact nodes and get scaled-up spacing. */
export const DENSE_REPO_NODE_THRESHOLD = 90;

export function defaultLayoutMode(nodeCount: number): LayoutMode {
  return nodeCount > LARGE_REPO_NODE_THRESHOLD ? 'force' : 'dagre';
}

/** First path segment of a file, used to group nodes into folder clusters. */
export function topLevelDir(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  return parts.length > 1 ? parts[0] : '(root)';
}

function layoutDagre(nodes: Node[], edges: Edge[], compact: boolean) {
  const width = compact ? COMPACT_NODE_WIDTH : NODE_WIDTH;
  const height = compact ? COMPACT_NODE_HEIGHT : NODE_HEIGHT;
  // Dense graphs need proportionally more room between ranks/siblings or
  // every cross-cutting import edge overlaps the next rank's nodes and the
  // whole thing reads as a solid wall of lines.
  const density = Math.max(1, Math.sqrt(nodes.length / 40));

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40 * density, ranksep: 90 * density });

  nodes.forEach((node) => {
    g.setNode(node.id, { width, height });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: { x: pos.x - width / 2, y: pos.y - height / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  groupCenter?: { x: number; y: number };
}

/**
 * Runs a d3-force simulation synchronously (no animation ticking in the UI —
 * we just step the simulation a fixed number of times and take the final
 * positions) and maps the result back onto React Flow nodes.
 */
function runForceSimulation(
  nodes: Node[],
  edges: Edge[],
  {
    groupCenters,
    linkDistance = 140,
    chargeStrength = -400,
    groupStrength = 0,
    iterations = 300,
    nodeWidth = NODE_WIDTH,
    nodeHeight = NODE_HEIGHT,
  }: {
    groupCenters?: Map<string, { x: number; y: number }>;
    linkDistance?: number;
    chargeStrength?: number;
    groupStrength?: number;
    iterations?: number;
    nodeWidth?: number;
    nodeHeight?: number;
  } = {}
) {
  // Dense graphs (hundreds of files) need proportionally more repulsion and
  // link length or they collapse into an unreadable clump — fixed constants
  // that look fine at 30 nodes turn into a solid hairball at 300. Scale
  // everything by how far above a "comfortable" node count (80) we are.
  const density = Math.max(1, Math.sqrt(nodes.length / 80));
  const scaledLinkDistance = linkDistance * density;
  const scaledCharge = chargeStrength * density;
  const scaledIterations = Math.min(700, Math.round(iterations * Math.max(1, density * 0.85)));

  const width = Math.max(900, Math.sqrt(nodes.length) * 240 * density);
  const height = Math.max(700, Math.sqrt(nodes.length) * 190 * density);

  const simNodes: SimNode[] = nodes.map((n, i) => {
    // Seed positions on a circle so the simulation doesn't start from a
    // singular point (which can produce NaN positions with pure overlap).
    const angle = (i / nodes.length) * Math.PI * 2;
    const seedRadius = Math.min(width, height) / 3;
    return {
      id: n.id,
      x: width / 2 + seedRadius * Math.cos(angle),
      y: height / 2 + seedRadius * Math.sin(angle),
      groupCenter: groupCenters?.get(n.id),
    };
  });

  const collideRadius = Math.max(nodeWidth, nodeHeight * 3) / 1.7;

  const simulation = forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      forceLink<SimNode, { source: string; target: string }>(
        edges.map((e) => ({ source: e.source, target: e.target }))
      )
        .id((d) => d.id)
        .distance(scaledLinkDistance)
        .strength(0.4)
    )
    .force('charge', forceManyBody().strength(scaledCharge))
    .force('collide', forceCollide(collideRadius))
    .force('center', forceCenter(width / 2, height / 2))
    // Charge repulsion alone has nothing pulling disconnected components (or
    // edge-less singleton files) back in, so they drift arbitrarily far from
    // the rest of the graph — forceCenter only recenters the average
    // position, it doesn't attract individual nodes. A mild constant pull
    // toward either the group center (Folders mode) or the overall center
    // (plain Force mode) keeps everything within one readable viewport.
    .force(
      'x',
      forceX<SimNode>((d) => d.groupCenter?.x ?? width / 2).strength(groupCenters && groupStrength > 0 ? groupStrength : 0.06)
    )
    .force(
      'y',
      forceY<SimNode>((d) => d.groupCenter?.y ?? height / 2).strength(groupCenters && groupStrength > 0 ? groupStrength : 0.06)
    )
    .stop();

  for (let i = 0; i < scaledIterations; i += 1) simulation.tick();
  simulation.stop();

  const posById = new Map(simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));

  const layoutedNodes = nodes.map((node) => {
    const pos = posById.get(node.id) || { x: 0, y: 0 };
    return {
      ...node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/** Pure force-directed layout — no folder grouping, just physics. */
function layoutForce(nodes: Node[], edges: Edge[], compact: boolean) {
  return runForceSimulation(nodes, edges, {
    linkDistance: 140,
    chargeStrength: -450,
    iterations: 320,
    nodeWidth: compact ? COMPACT_NODE_WIDTH : NODE_WIDTH,
    nodeHeight: compact ? COMPACT_NODE_HEIGHT : NODE_HEIGHT,
  });
}

/**
 * Radial/cluster layout: each top-level directory gets a slice of a big
 * circle, and nodes are then force-simulated with a pull toward their
 * directory's slot on that circle. The result mirrors the repo's folder
 * structure ("neighborhoods") instead of import order, while still letting
 * closely-linked files within (and across) folders settle naturally.
 */
function layoutCluster(nodes: Node<FileGraphNodeData>[], edges: Edge[], compact: boolean) {
  const groups = new Map<string, string[]>(); // dir -> node ids
  nodes.forEach((n) => {
    const dir = topLevelDir(n.data.filePath);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(n.id);
  });

  const groupNames = [...groups.keys()];
  const groupCount = groupNames.length;
  const ringRadius = Math.max(360, groupCount * 110);
  const center = { x: ringRadius + 200, y: ringRadius + 200 };

  const groupCenters = new Map<string, { x: number; y: number }>();
  groupNames.forEach((dir, i) => {
    const angle = (i / groupCount) * Math.PI * 2 - Math.PI / 2;
    const gx = center.x + ringRadius * Math.cos(angle);
    const gy = center.y + ringRadius * Math.sin(angle);
    groups.get(dir)!.forEach((id) => groupCenters.set(id, { x: gx, y: gy }));
  });

  return runForceSimulation(nodes, edges, {
    groupCenters,
    groupStrength: 0.75,
    linkDistance: 90,
    chargeStrength: -220,
    iterations: 350,
    nodeWidth: compact ? COMPACT_NODE_WIDTH : NODE_WIDTH,
    nodeHeight: compact ? COMPACT_NODE_HEIGHT : NODE_HEIGHT,
  });
}

export function isCompactLayout(nodeCount: number): boolean {
  return nodeCount > DENSE_REPO_NODE_THRESHOLD;
}

export function layoutGraph(nodes: Node<FileGraphNodeData>[], edges: Edge[], mode: LayoutMode = 'dagre') {
  if (nodes.length === 0) return { nodes, edges };
  const compact = isCompactLayout(nodes.length);
  if (mode === 'force') return layoutForce(nodes, edges, compact);
  if (mode === 'cluster') return layoutCluster(nodes, edges, compact);
  return layoutDagre(nodes, edges, compact);
}
