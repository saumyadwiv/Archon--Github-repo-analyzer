'use client';

import { useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, BackgroundVariant, Node, Edge, NodeMouseHandler, EdgeMouseHandler } from 'reactflow';
import 'reactflow/dist/style.css';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { ArchitectureLayerNode } from './ArchitectureLayerNode';
import { layoutArchitecture, ArchitectureLayerNodeData } from './architectureLayout';
import { cn } from '@/lib/utils';
import type { Architecture, ArchitectureEdge } from '@/lib/types';

const nodeTypes = { layerNode: ArchitectureLayerNode };

function fileBaseName(filePath: string) {
  return filePath.split('/').pop() || filePath;
}

export function ArchitectureGraph({ architecture }: { architecture: Architecture }) {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ArchitectureEdge | null>(null);

  const { nodes, edges } = useMemo(
    () => layoutArchitecture(architecture, selectedLayerId),
    [architecture, selectedLayerId]
  );

  const layersById = useMemo(() => new Map(architecture.layers.map((l) => [l.id, l])), [architecture.layers]);
  const selectedLayer = selectedLayerId ? layersById.get(selectedLayerId) : null;

  const handleNodeClick: NodeMouseHandler = (_, node: Node<ArchitectureLayerNodeData>) => {
    setSelectedEdge(null);
    setSelectedLayerId((prev) => (prev === node.id ? null : node.id));
  };

  const handleEdgeClick: EdgeMouseHandler = (_, edge: Edge) => {
    setSelectedLayerId(null);
    setSelectedEdge((edge.data as ArchitectureEdge) ?? null);
  };

  const handlePaneClick = () => {
    setSelectedLayerId(null);
    setSelectedEdge(null);
  };

  if (architecture.layers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        No files to classify into layers yet.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#232733" />
        <Controls showInteractive={false} />
      </ReactFlow>

      <div className="absolute left-4 top-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-border bg-surface/90 px-3 py-2 text-[11px] text-muted backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[#AAB2C5]" /> Expected flow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-cycle" /> Violates layering
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full border-t border-dashed border-muted" /> Cross-cutting
        </span>
      </div>

      {architecture.violationCount > 0 && (
        <div className="absolute right-4 top-4 flex max-w-xs items-start gap-2 rounded-md border border-cycle/30 bg-cycle/10 px-3 py-2 text-xs text-cycle backdrop-blur">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {architecture.violationCount} layer dependenc{architecture.violationCount === 1 ? 'y runs' : 'ies run'}{' '}
            against the expected top-down flow — click a red edge to see which files.
          </span>
        </div>
      )}

      {selectedLayer && (
        <div className="absolute bottom-4 right-4 flex max-h-[60%] w-72 flex-col rounded-lg border border-border bg-surface/95 backdrop-blur">
          <div className="flex items-start justify-between gap-2 border-b border-border p-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted">Layer</p>
              <p className="truncate text-sm font-semibold text-foreground">{selectedLayer.label}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLayerId(null)}
              className="shrink-0 rounded p-0.5 text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-muted">
              Files ({selectedLayer.files.length})
            </p>
            <ul className="space-y-1">
              {selectedLayer.files.map((f) => (
                <li key={f} title={f} className="truncate rounded bg-surface-2 px-2 py-1 font-mono text-[11px] text-foreground">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {selectedEdge && (
        <div className="absolute bottom-4 right-4 flex max-h-[60%] w-80 flex-col rounded-lg border border-border bg-surface/95 backdrop-blur">
          <div className="flex items-start justify-between gap-2 border-b border-border p-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted">
                {selectedEdge.direction === 'backward' ? 'Layering violation' : 'Layer dependency'}
              </p>
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                {layersById.get(selectedEdge.source)?.label} <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" />{' '}
                {layersById.get(selectedEdge.target)?.label}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEdge(null)}
              className="shrink-0 rounded p-0.5 text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedEdge.direction === 'backward' && (
              <p className={cn('mb-2 rounded-md border border-cycle/30 bg-cycle/10 px-2.5 py-1.5 text-[11px] text-cycle')}>
                {layersById.get(selectedEdge.source)?.label} sits below{' '}
                {layersById.get(selectedEdge.target)?.label} in the expected flow — this import runs backward.
              </p>
            )}
            <p className="mb-2 text-[10px] uppercase tracking-wide text-muted">
              {selectedEdge.weight} import{selectedEdge.weight === 1 ? '' : 's'} · sample
            </p>
            <div className="space-y-1.5">
              {selectedEdge.sampleImports.map((s, i) => (
                <div
                  key={`${s.from}-${s.to}-${i}`}
                  className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-[11px]"
                >
                  <span className="text-foreground" title={s.from}>
                    {fileBaseName(s.from)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted" />
                  <span className="text-foreground" title={s.to}>
                    {fileBaseName(s.to)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
