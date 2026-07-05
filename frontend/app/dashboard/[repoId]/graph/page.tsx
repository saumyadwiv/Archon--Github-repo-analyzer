'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BarChart3, AlertTriangle, RefreshCw, Loader2, MessageSquare, FileText } from 'lucide-react';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Navbar } from '@/components/layout/Navbar';
import { DependencyGraph } from '@/components/graph/DependencyGraph';
import { FileExplainDialog } from '@/components/graph/FileExplainDialog';
import { CyclesDialog } from '@/components/graph/CyclesDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { repositoryApi, apiErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { FileNode, DependencyEdge, Repository, CycleChain } from '@/lib/types';

function GraphPageContent() {
  const { repoId } = useParams<{ repoId: string }>();
  const router = useRouter();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [edges, setEdges] = useState<DependencyEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cycles, setCycles] = useState<CycleChain[]>([]);
  const [cyclesDialogOpen, setCyclesDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const [repoRes, graphRes, cyclesRes] = await Promise.all([
          repositoryApi.get(repoId),
          repositoryApi.graph(repoId),
          repositoryApi.cycles(repoId),
        ]);
        setRepo(repoRes.data.data!.repository);
        setNodes(graphRes.data.data!.nodes);
        setEdges(graphRes.data.data!.edges);
        setCycles(cyclesRes.data.data!.cycles);
      } catch (err) {
        toast({ title: 'Could not load graph', description: apiErrorMessage(err), variant: 'error' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [repoId, toast]);

  const cycleCount = new Set(edges.filter((e) => e.isPartOfCycle).map((e) => e.cycleId)).size;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <Navbar />
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          {repo && <span className="font-mono text-sm font-medium">{repo.fullName}</span>}
          {cycleCount > 0 && (
            <button type="button" onClick={() => setCyclesDialogOpen(true)} className="cursor-pointer">
              <Badge variant="danger" className="hover:bg-cycle/25">
                <AlertTriangle className="mr-1 h-3 w-3" /> {cycleCount} circular{' '}
                {cycleCount === 1 ? 'dependency' : 'dependencies'}
              </Badge>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/${repoId}/chat`}>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-3.5 w-3.5" /> Chat
            </Button>
          </Link>
          <Link href={`/dashboard/${repoId}/metrics`}>
            <Button variant="outline" size="sm">
              <BarChart3 className="h-3.5 w-3.5" /> Metrics
            </Button>
          </Link>
          <Link href={`/dashboard/${repoId}/readme`}>
            <Button variant="outline" size="sm">
              <FileText className="h-3.5 w-3.5" /> README
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await repositoryApi.reanalyze(repoId);
                // The detail page shows live socket-driven progress and
                // redirects back here automatically once it completes —
                // reuse that instead of leaving the user on a stale graph.
                router.push(`/dashboard/${repoId}`);
              } catch (err) {
                toast({ title: 'Could not start re-analysis', description: apiErrorMessage(err), variant: 'error' });
              }
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Re-analyze
          </Button>
        </div>
      </div>

      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <DependencyGraph
            files={nodes}
            edges={edges}
            onSelectFile={(file) => {
              setSelectedFile(file);
              setDialogOpen(true);
            }}
          />
        )}

        <div className="absolute bottom-4 left-4 flex items-center gap-4 rounded-md border border-border bg-surface/90 px-3 py-2 text-xs text-muted backdrop-blur">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-cycle/60 bg-cycle/20" /> Circular dependency
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-brand/60 bg-brand/20" /> Entry point
          </span>
          <span>Click a file to focus its neighbors · click again (or empty canvas) to clear · hover for AI explain</span>
        </div>
      </div>

      <FileExplainDialog file={selectedFile} repositoryId={repoId} open={dialogOpen} onOpenChange={setDialogOpen} />
      <CyclesDialog
        repositoryId={repoId}
        cycles={cycles}
        open={cyclesDialogOpen}
        onOpenChange={setCyclesDialogOpen}
      />
    </div>
  );
}

export default function GraphPage() {
  return (
    <RequireAuth>
      <GraphPageContent />
    </RequireAuth>
  );
}
