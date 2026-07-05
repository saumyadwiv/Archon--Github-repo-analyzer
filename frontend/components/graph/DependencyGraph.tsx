'use client';

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeMouseHandler,
  BackgroundVariant,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { X } from 'lucide-react';
import { FileGraphNode, FileGraphNodeData } from './FileGraphNode';
import { FloatingEdge } from './FloatingEdge';
import { layoutGraph, defaultLayoutMode, isCompactLayout, LAYOUT_MODES, LayoutMode } from './graphLayout';
import { cn } from '@/lib/utils';
import type { FileNode as FileNodeType, DependencyEdge } from '@/lib/types';

const nodeTypes = { fileNode: FileGraphNode };
const edgeTypes = { floating: FloatingEdge };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
// React Flow's built-in scroll-to-zoom is tuned very fine (~10% per notch),
// which is why it used to take a dozen scrolls to read a node's label. We
// take over the wheel handler and zoom in bigger, cursor-centered steps
// instead — ctrl+wheel / trackpad pinch is left alone so that still uses
// React Flow's native (already well-tuned) pinch handling.
const ZOOM_STEP_FACTOR = 1.35;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function DependencyGraph({
  files,
  edges: rawEdges,
  onSelectFile,
}: {
  files: FileNodeType[];
  edges: DependencyEdge[];
  onSelectFile: (file: FileNodeType) => void;
}) {
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode | null>(null);

  // Only include files that participate in at least one edge, plus entry
  // points, so isolated/leaf utility files don't clutter the canvas.
  const { rfNodesBase, rfEdgesBase } = useMemo(() => {
    const connectedPaths = new Set<string>();
    rawEdges.forEach((e) => {
      connectedPaths.add(e.sourcePath);
      connectedPaths.add(e.targetPath);
    });

    const visibleFiles = files.filter((f) => connectedPaths.has(f.filePath) || f.isEntryPoint);
    const pathToId = new Map(visibleFiles.map((f) => [f.filePath, f._id]));

    const rfNodes: Node<FileGraphNodeData>[] = visibleFiles.map((f) => ({
      id: f._id,
      type: 'fileNode',
      position: { x: 0, y: 0 },
      data: {
        filePath: f.filePath,
        fileName: f.fileName,
        language: f.language,
        averageComplexity: f.averageComplexity,
        linesOfCode: f.linesOfCode,
        inCycle: f.inCycle,
        isEntryPoint: f.isEntryPoint,
      },
    }));

    const rfEdges: Edge[] = rawEdges
      .map((e, i) => {
        const sourceId = pathToId.get(e.sourcePath);
        const targetId = pathToId.get(e.targetPath);
        if (!sourceId || !targetId) return null;
        return {
          id: `e${i}`,
          source: sourceId,
          target: targetId,
          animated: e.isPartOfCycle,
          className: e.isPartOfCycle ? 'cycle-edge' : undefined,
        };
      })
      .filter(Boolean) as Edge[];

    return { rfNodesBase: rfNodes, rfEdgesBase: rfEdges };
  }, [files, rawEdges]);

  // Small repos default to the readable dagre tree; large ones default to
  // the force layout, which scales much better once cross-cutting imports
  // turn a tree into a hairball. The user can always override via the
  // segmented control below.
  const effectiveMode = layoutMode ?? defaultLayoutMode(rfNodesBase.length);
  const compact = isCompactLayout(rfNodesBase.length);

  const { nodes, edges } = useMemo(
    () => layoutGraph(rfNodesBase, rfEdgesBase, effectiveMode),
    [rfNodesBase, rfEdgesBase, effectiveMode]
  );

  const filesById = useMemo(() => new Map(files.map((f) => [f._id, f])), [files]);

  // --- Focus / isolation mode -----------------------------------------
  // Click a node to dim everything except it and its direct dependencies +
  // dependents (out to `hopDepth` hops). Click it again, click empty canvas,
  // or hit "Clear focus" to reset.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hopDepth, setHopDepth] = useState<1 | 2>(2);
  // Lightweight, non-sticky preview: hovering a node (when nothing is
  // click-focused) briefly brightens just its direct neighbors so you can
  // trace a file's connections without committing to full focus mode —
  // this is what actually makes a 300-node hairball readable at a glance.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rfEdgesBase.forEach((e) => {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    });
    return map;
  }, [rfEdgesBase]);

  const bfsDistances = useCallback(
    (startId: string, maxHops: number) => {
      const distances = new Map<string, number>([[startId, 0]]);
      let frontier = [startId];
      for (let hop = 1; hop <= maxHops; hop += 1) {
        const next: string[] = [];
        frontier.forEach((id) => {
          adjacency.get(id)?.forEach((neighbor) => {
            if (!distances.has(neighbor)) {
              distances.set(neighbor, hop);
              next.push(neighbor);
            }
          });
        });
        frontier = next;
      }
      return distances;
    },
    [adjacency]
  );

  const focusInfo = useMemo(() => {
    if (!focusedId || !adjacency.has(focusedId)) return null;

    const distances = bfsDistances(focusedId, hopDepth);
    const dependencies = rfEdgesBase.filter((e) => e.source === focusedId).length; // files it imports
    const dependents = rfEdgesBase.filter((e) => e.target === focusedId).length; // files that import it

    return { distances, dependencies, dependents };
  }, [focusedId, hopDepth, adjacency, rfEdgesBase, bfsDistances]);

  // Only active when nothing is click-focused, so hover never fights focus mode.
  const hoverInfo = useMemo(() => {
    if (focusedId || !hoveredId || !adjacency.has(hoveredId)) return null;
    return { distances: bfsDistances(hoveredId, 1) };
  }, [focusedId, hoveredId, adjacency, bfsDistances]);

  const focusedFile = focusedId ? filesById.get(focusedId) : null;

  const handleInfoClick = useCallback(
    (fileId: string) => {
      const file = filesById.get(fileId);
      if (file) onSelectFile(file);
    },
    [filesById, onSelectFile]
  );

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          compact,
          focusDistance: focusInfo ? focusInfo.distances.get(n.id) ?? -1 : undefined,
          isHoverNeighbor: hoverInfo ? hoverInfo.distances.has(n.id) : false,
          onInfoClick: () => handleInfoClick(n.id),
        },
      })),
    [nodes, compact, focusInfo, hoverInfo, handleInfoClick]
  );

  // Baseline opacity when nothing is focused or hovered — dense graphs need
  // to start much fainter than sparse ones, or every cross-cutting import
  // renders on top of every other one and the graph reads as a solid smear
  // of lines. Hovering or clicking a node brings its edges back to full
  // opacity so the underlying structure is still fully explorable.
  const baselineEdgeOpacity = clamp(0.42 - rfNodesBase.length / 500, 0.08, 0.42);

  // Dagre is a real left-to-right hierarchy, so the fixed Left/Right handles
  // line up with actual node positions and a plain straight line looks
  // clean. Force/Folders place nodes with no consistent direction, so a
  // fixed-handle line constantly detours through the "wrong" side of a node
  // — that's what produced the looping, asymmetric curves. FloatingEdge
  // computes each line's endpoints geometrically instead, so it always
  // takes the shortest path regardless of relative node position.
  const edgeType = effectiveMode === 'dagre' ? 'straight' : 'floating';

  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        const base = { ...e, type: edgeType };
        if (focusInfo) {
          const active = focusInfo.distances.has(e.source) && focusInfo.distances.has(e.target);
          return {
            ...base,
            animated: active && e.animated,
            style: { ...(e.style || {}), opacity: active ? 1 : 0.05 },
          };
        }
        if (hoverInfo) {
          const active = hoverInfo.distances.has(e.source) && hoverInfo.distances.has(e.target);
          return { ...base, style: { ...(e.style || {}), opacity: active ? 1 : 0.05 } };
        }
        return { ...base, style: { ...(base.style || {}), opacity: baselineEdgeOpacity } };
      }),
    [edges, focusInfo, hoverInfo, baselineEdgeOpacity, edgeType]
  );
  // ----------------------------------------------------------------------

  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setFocusedId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const handlePaneClick = useCallback(() => setFocusedId(null), []);

  const handleNodeMouseEnter: NodeMouseHandler = useCallback(
    (_, node) => setHoveredId(node.id),
    []
  );
  const handleNodeMouseLeave = useCallback(() => setHoveredId(null), []);

  const handleWheel = useCallback((event: WheelEvent) => {
    // Let ctrl+wheel (trackpad pinch-to-zoom on most browsers) fall through
    // to React Flow's own zoomOnPinch handling instead of our custom step.
    if (event.ctrlKey || !rfInstance.current || !wrapperRef.current) return;
    event.preventDefault();

    const { x, y, zoom } = rfInstance.current.getViewport();
    const zoomingIn = event.deltaY < 0;
    const nextZoom = clamp(zoomingIn ? zoom * ZOOM_STEP_FACTOR : zoom / ZOOM_STEP_FACTOR, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === zoom) return;

    // Keep the point under the cursor fixed while zooming, same as native scroll-zoom.
    const bounds = wrapperRef.current.getBoundingClientRect();
    const cursorX = event.clientX - bounds.left;
    const cursorY = event.clientY - bounds.top;
    const scale = nextZoom / zoom;

    rfInstance.current.setViewport(
      { x: cursorX - (cursorX - x) * scale, y: cursorY - (cursorY - y) * scale, zoom: nextZoom },
      { duration: 120 }
    );
  }, []);

  // React attaches its synthetic onWheel as a passive listener, so calling
  // preventDefault() from a JSX onWheel prop throws "Unable to preventDefault
  // inside passive event listener invocation" on every scroll tick and the
  // native scroll fires anyway alongside our custom zoom. Attaching the
  // listener natively lets us opt out of passive mode.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        No inter-file dependencies detected to visualize.
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <ReactFlow
        // key forces a clean remount when the layout algorithm changes so
        // React Flow doesn't try to animate/interpolate between two totally
        // different coordinate systems (dagre's grid vs. force's physics).
        key={effectiveMode}
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onPaneClick={handlePaneClick}
        onInit={(instance) => (rfInstance.current = instance)}
        fitView
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#232733" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => ((n.data as FileGraphNodeData)?.inCycle ? '#F0466E' : '#2C3140')}
          maskColor="rgba(10,12,16,0.75)"
        />
      </ReactFlow>

      <div className="absolute right-4 top-4 flex items-center gap-0.5 rounded-md border border-border bg-surface/90 p-0.5 backdrop-blur">
        {LAYOUT_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.hint}
            onClick={() => setLayoutMode(m.id)}
            className={cn(
              'rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors',
              effectiveMode === m.id ? 'bg-brand text-white' : 'text-muted hover:bg-surface-2 hover:text-foreground'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {compact && !focusedFile && (
        <div className="absolute left-4 top-4 rounded-md border border-border bg-surface/90 px-3 py-1.5 text-xs text-muted backdrop-blur">
          {nodes.length} files — hover a node to trace its connections, click to lock focus
        </div>
      )}

      {focusedFile && focusInfo && (
        <div className="absolute right-4 top-14 flex w-64 flex-col gap-2 rounded-md border border-border bg-surface/95 p-3 text-xs backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted">Focused on</p>
              <p className="truncate font-mono text-[11px] font-medium text-foreground">{focusedFile.fileName}</p>
            </div>
            <button
              type="button"
              onClick={() => setFocusedId(null)}
              className="shrink-0 rounded p-0.5 text-muted hover:bg-surface-2 hover:text-foreground"
              title="Clear focus"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-muted">
            <span>
              <span className="font-mono text-foreground">{focusInfo.dependencies}</span> dependencies
            </span>
            <span>
              <span className="font-mono text-foreground">{focusInfo.dependents}</span> dependents
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-muted">
            <span>Depth</span>
            {([1, 2] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setHopDepth(d)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                  hopDepth === d ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-foreground'
                )}
              >
                {d} hop{d > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
