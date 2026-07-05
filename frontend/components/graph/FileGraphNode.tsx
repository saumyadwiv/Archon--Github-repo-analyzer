'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { FileCode2, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { topLevelDir } from './graphLayout';

export interface FileGraphNodeData {
  filePath: string;
  fileName: string;
  language: string;
  averageComplexity: number;
  linesOfCode: number;
  inCycle: boolean;
  isEntryPoint: boolean;
  /** Hop distance from the currently focused node (0 = the focused node itself). -1 = outside the
   *  focus radius. undefined = no focus active, so every node renders normally. */
  focusDistance?: number;
  /** Opens the AI "explain this file" dialog for this node. */
  onInfoClick?: () => void;
  /** Renders a smaller, text-only chip instead of the full detail card — used
   *  automatically for large/dense repos so hundreds of files stay legible. */
  compact?: boolean;
  /** True while a node is being hover-previewed and this one is a direct neighbor. */
  isHoverNeighbor?: boolean;
}

const LANGUAGE_DOT: Record<string, string> = {
  javascript: 'bg-yellow-400',
  typescript: 'bg-blue-400',
  python: 'bg-emerald-400',
};

// A small fixed palette, hashed by top-level directory name, so every file in
// e.g. `services/` gets the same accent stripe wherever it appears — makes
// the folder "neighborhoods" readable in every layout mode, not just Folders.
const FOLDER_PALETTE = ['#6E5BFF', '#34D399', '#F5A623', '#3B9DF0', '#F0466E', '#A78BFA', '#2DD4BF', '#F97066'];

function folderColor(filePath: string) {
  const dir = topLevelDir(filePath);
  let hash = 0;
  for (let i = 0; i < dir.length; i += 1) hash = (hash * 31 + dir.charCodeAt(i)) >>> 0;
  return FOLDER_PALETTE[hash % FOLDER_PALETTE.length];
}

function complexityColor(avg: number) {
  if (avg >= 15) return 'text-cycle';
  if (avg >= 8) return 'text-grade-c';
  return 'text-grade-a';
}

function FileGraphNodeImpl({ data }: { data: FileGraphNodeData }) {
  const focusActive = data.focusDistance !== undefined;
  const isFocalNode = data.focusDistance === 0;
  const dimmed = focusActive && data.focusDistance === -1;

  if (data.compact) {
    return (
      <div
        title={`${data.filePath}\n${data.linesOfCode} LOC · avg complexity ${data.averageComplexity.toFixed(1)}`}
        style={{ borderLeft: `2px solid ${folderColor(data.filePath)}` }}
        className={cn(
          'graph-node group relative max-w-[150px] rounded border bg-surface px-2 py-1 shadow-sm transition-[opacity,box-shadow] duration-200 ease-out',
          data.inCycle ? 'border-cycle/60' : 'border-border-light',
          data.isEntryPoint && 'border-brand/60',
          isFocalNode && 'ring-2 ring-brand',
          data.isHoverNeighbor && !focusActive && 'ring-1 ring-brand-light',
          dimmed && 'opacity-[0.12]'
        )}
      >
        <Handle type="target" position={Position.Left} className="!bg-border-light !border-none !w-1 !h-1" />
        <div className="flex items-center gap-1">
          {data.inCycle && <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-cycle" />}
          <span className="truncate text-[10px] font-medium text-foreground">{data.fileName}</span>
        </div>
        <Handle type="source" position={Position.Right} className="!bg-border-light !border-none !w-1 !h-1" />
      </div>
    );
  }

  return (
    <div
      style={{ borderLeft: `3px solid ${folderColor(data.filePath)}` }}
      className={cn(
        'graph-node group relative min-w-[180px] max-w-[220px] rounded-md border bg-surface px-3 py-2 shadow-sm transition-[opacity,box-shadow] duration-200 ease-out',
        data.inCycle ? 'border-cycle/60 ring-1 ring-cycle/30' : 'border-border-light',
        data.isEntryPoint && 'border-brand/60 ring-1 ring-brand/30',
        isFocalNode && 'ring-2 ring-brand shadow-lg shadow-brand/20',
        data.isHoverNeighbor && !focusActive && 'ring-1 ring-brand-light',
        dimmed && 'opacity-[0.15]'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-border-light !border-none !w-1.5 !h-1.5" />

      <button
        type="button"
        title="Explain this file with AI"
        onClick={(e) => {
          e.stopPropagation();
          data.onInfoClick?.();
        }}
        className={cn(
          'nodrag absolute -right-1.5 -top-1.5 rounded-full border border-border-light bg-surface-2 p-0.5 text-muted opacity-0 transition-opacity hover:text-brand group-hover:opacity-100',
          dimmed && 'pointer-events-none'
        )}
      >
        <Info className="h-3 w-3" />
      </button>

      <div className="flex items-center gap-1.5">
        {data.inCycle ? (
          <AlertTriangle className="h-3 w-3 shrink-0 text-cycle" />
        ) : (
          <FileCode2 className="h-3 w-3 shrink-0 text-muted" />
        )}
        <span className="truncate text-[11px] font-medium text-foreground">{data.fileName}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className={cn('h-1.5 w-1.5 rounded-full', LANGUAGE_DOT[data.language] || 'bg-muted')} />
          {data.linesOfCode} LOC
        </span>
        <span className={complexityColor(data.averageComplexity)}>cx {data.averageComplexity.toFixed(1)}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-border-light !border-none !w-1.5 !h-1.5" />
    </div>
  );
}

// Memoized so hovering/focusing one node doesn't force every other node in a
// 300-file graph to re-render each time the mouse moves — React Flow passes
// each node a fresh `data` object by identity, so without this (plus the
// reference-stabilizing cache in DependencyGraph) every mouse movement over
// the canvas re-rendered the *entire* graph, which is what showed up as a
// full-canvas flicker/blink on hover.
export const FileGraphNode = memo(FileGraphNodeImpl, (prev, next) => {
  const a = prev.data;
  const b = next.data;
  return (
    a.filePath === b.filePath &&
    a.fileName === b.fileName &&
    a.language === b.language &&
    a.averageComplexity === b.averageComplexity &&
    a.linesOfCode === b.linesOfCode &&
    a.inCycle === b.inCycle &&
    a.isEntryPoint === b.isEntryPoint &&
    a.compact === b.compact &&
    a.focusDistance === b.focusDistance &&
    a.isHoverNeighbor === b.isHoverNeighbor &&
    a.onInfoClick === b.onInfoClick
  );
});
