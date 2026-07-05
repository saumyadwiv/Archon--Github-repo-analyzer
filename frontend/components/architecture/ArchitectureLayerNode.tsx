'use client';

import { Handle, Position } from 'reactflow';
import { AlertTriangle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArchitectureLayerNodeData } from './architectureLayout';

function complexityColor(avg: number) {
  if (avg >= 15) return 'text-cycle';
  if (avg >= 8) return 'text-grade-c';
  return 'text-grade-a';
}

const TIER_LABEL: Record<number, string> = {
  0: 'Entry',
  1: 'Surface',
  2: 'Orchestration',
  3: 'Logic',
  4: 'Data access',
  5: 'Storage',
};

export function ArchitectureLayerNode({ data }: { data: ArchitectureLayerNodeData }) {
  const { layer, isSelected } = data;

  return (
    <div
      className={cn(
        'min-w-[200px] max-w-[220px] rounded-lg border bg-surface px-3.5 py-3 shadow-sm transition-colors',
        layer.cycleFileCount > 0 ? 'border-cycle/50' : 'border-border-light',
        isSelected && 'ring-2 ring-brand shadow-lg shadow-brand/20'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border-light !border-none !w-1.5 !h-1.5" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 shrink-0 text-brand" />
          <span className="truncate text-[13px] font-semibold text-foreground">{layer.label}</span>
        </div>
        {layer.cycleFileCount > 0 && (
          <span title={`${layer.cycleFileCount} file(s) in a circular dependency`}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-cycle" />
          </span>
        )}
      </div>

      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
        {layer.tier !== null ? TIER_LABEL[layer.tier] ?? `Tier ${layer.tier}` : 'Cross-cutting'}
      </p>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>
          <span className="font-mono text-foreground">{layer.fileCount}</span> file{layer.fileCount === 1 ? '' : 's'}
        </span>
        <span>
          <span className="font-mono text-foreground">{layer.totalLinesOfCode.toLocaleString()}</span> LOC
        </span>
      </div>
      <div className={cn('mt-1 font-mono text-[11px]', complexityColor(layer.averageComplexity))}>
        avg complexity {layer.averageComplexity.toFixed(1)}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-border-light !border-none !w-1.5 !h-1.5" />
    </div>
  );
}
