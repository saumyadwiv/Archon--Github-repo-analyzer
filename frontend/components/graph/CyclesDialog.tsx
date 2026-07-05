'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, RotateCcw, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { aiApi, apiErrorMessage } from '@/lib/api';
import type { CycleChain } from '@/lib/types';

type ExplainState = {
  status: 'idle' | 'loading' | 'done' | 'error';
  explanation?: string;
  error?: string;
};

function fileBaseName(filePath: string) {
  return filePath.split('/').pop() || filePath;
}

function complexityVariant(avg: number | null) {
  if (avg == null) return 'default' as const;
  if (avg >= 15) return 'danger' as const;
  if (avg >= 8) return 'warning' as const;
  return 'success' as const;
}

function CycleChainVisual({ chain }: { chain: CycleChain }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chain.files.map((filePath, i) => (
        <div key={`${filePath}-${i}`} className="flex items-center gap-2">
          <span
            title={filePath}
            className="rounded-md border border-cycle/30 bg-cycle/10 px-2.5 py-1 font-mono text-xs text-foreground"
          >
            {fileBaseName(filePath)}
          </span>
          {i < chain.files.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" />}
        </div>
      ))}
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <RotateCcw className="h-3.5 w-3.5 text-cycle" /> loops back to {fileBaseName(chain.files[0])}
      </span>
    </div>
  );
}

function CycleDetail({
  chain,
  repositoryId,
  state,
  onExplain,
}: {
  chain: CycleChain;
  repositoryId: string;
  state: ExplainState;
  onExplain: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Chain</p>
        <CycleChainVisual chain={chain} />
      </div>

      <Separator />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Edges crossed</p>
        <div className="space-y-1.5">
          {chain.edges.map((edge, i) => (
            <div
              key={`${edge.sourcePath}-${edge.targetPath}-${i}`}
              className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs"
            >
              <span className="text-foreground">{fileBaseName(edge.sourcePath)}</span>
              <ArrowRight className="h-3 w-3 text-muted" />
              <span className="text-foreground">{fileBaseName(edge.targetPath)}</span>
              <span className="text-muted">
                — imports {edge.importedNames.length ? edge.importedNames.join(', ') : 'the whole module'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Files in this cycle</p>
        <div className="flex flex-wrap gap-2">
          {chain.fileFacts.map((f) => (
            <Badge key={f.filePath} variant={complexityVariant(f.averageComplexity)} title={f.filePath}>
              {fileBaseName(f.filePath)} · {f.linesOfCode ?? '?'} LOC · avg{' '}
              {f.averageComplexity != null ? f.averageComplexity.toFixed(1) : '?'}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      <div className="min-h-[60px]">
        {state.status === 'idle' && (
          <Button onClick={onExplain} variant="outline" className="w-full">
            <Sparkles className="h-4 w-4" />
            Explain this cycle
          </Button>
        )}
        {state.status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Asking Gemini...
          </div>
        )}
        {state.status === 'error' && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm text-cycle">
              <AlertTriangle className="h-3.5 w-3.5" /> {state.error}
            </p>
            <Button onClick={onExplain} variant="outline" size="sm">
              Try again
            </Button>
          </div>
        )}
        {state.status === 'done' && state.explanation && (
          <div className="prose-chat rounded-md border border-border bg-surface-2 p-4">
            <ReactMarkdown>{state.explanation}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export function CyclesDialog({
  repositoryId,
  cycles,
  open,
  onOpenChange,
}: {
  repositoryId: string;
  cycles: CycleChain[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeCycleId, setActiveCycleId] = useState<string | undefined>(cycles[0]?.cycleId);
  // Keyed by cycleId so switching tabs never discards an explanation that's
  // already been fetched — only re-opening this dialog resets it.
  const [explanations, setExplanations] = useState<Record<string, ExplainState>>({});

  useEffect(() => {
    if (open) {
      setActiveCycleId(cycles[0]?.cycleId);
      setExplanations({});
    }
  }, [open, cycles]);

  async function handleExplain(cycleId: string) {
    setExplanations((prev) => ({ ...prev, [cycleId]: { status: 'loading' } }));
    try {
      const res = await aiApi.explainCycle(repositoryId, cycleId);
      setExplanations((prev) => ({
        ...prev,
        [cycleId]: { status: 'done', explanation: res.data.data!.explanation },
      }));
    } catch (err) {
      setExplanations((prev) => ({
        ...prev,
        [cycleId]: { status: 'error', error: apiErrorMessage(err, 'Failed to explain this cycle') },
      }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-cycle" />
            Circular dependencies
          </DialogTitle>
          <DialogDescription>
            {cycles.length} {cycles.length === 1 ? 'cycle' : 'cycles'} detected in the latest analysis. Pick one to
            see the import chain and get an AI-suggested fix.
          </DialogDescription>
        </DialogHeader>

        {cycles.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No circular dependencies detected. Nice and acyclic.</p>
        ) : (
          <Tabs value={activeCycleId} onValueChange={setActiveCycleId}>
            <TabsList className="flex-wrap">
              {cycles.map((chain, i) => (
                <TabsTrigger key={chain.cycleId} value={chain.cycleId}>
                  Cycle {i + 1}
                  <Badge variant="outline" className="ml-1.5 border-none bg-transparent px-1 py-0">
                    {chain.length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {cycles.map((chain) => (
              <TabsContent key={chain.cycleId} value={chain.cycleId}>
                <CycleDetail
                  chain={chain}
                  repositoryId={repositoryId}
                  state={explanations[chain.cycleId] || { status: 'idle' }}
                  onExplain={() => handleExplain(chain.cycleId)}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
