'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Navbar } from '@/components/layout/Navbar';
import { RepoTabNav } from '@/components/layout/RepoTabNav';
import { ArchitectureGraph } from '@/components/architecture/ArchitectureGraph';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { repositoryApi, apiErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { Architecture, Repository } from '@/lib/types';

function ArchitecturePageContent() {
  const { repoId } = useParams<{ repoId: string }>();
  const router = useRouter();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [architecture, setArchitecture] = useState<Architecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const { toast } = useToast();

  async function handleReanalyze() {
    setReanalyzing(true);
    try {
      await repositoryApi.reanalyze(repoId);
      router.push(`/dashboard/${repoId}`);
    } catch (err) {
      toast({ title: 'Could not start re-analysis', description: apiErrorMessage(err), variant: 'error' });
      setReanalyzing(false);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [repoRes, archRes] = await Promise.all([
          repositoryApi.get(repoId),
          repositoryApi.architecture(repoId),
        ]);
        setRepo(repoRes.data.data!.repository);
        setArchitecture(archRes.data.data!.architecture);
      } catch (err) {
        toast({ title: 'Could not load architecture', description: apiErrorMessage(err), variant: 'error' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [repoId, toast]);

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <Navbar />
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          {repo && <span className="font-mono text-sm font-medium">{repo.fullName}</span>}
          {architecture && architecture.violationCount > 0 && (
            <Badge variant="danger">
              {architecture.violationCount} layering {architecture.violationCount === 1 ? 'violation' : 'violations'}
            </Badge>
          )}
        </div>
        <RepoTabNav repoId={repoId} active="architecture" reanalyzing={reanalyzing} onReanalyze={handleReanalyze} />
      </div>

      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : repo && repo.status !== 'completed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-foreground">This repository has not finished analysis yet.</p>
            <Link href={`/dashboard/${repoId}`}>
              <Button variant="outline" size="sm">
                View analysis progress
              </Button>
            </Link>
          </div>
        ) : architecture ? (
          <>
            <div className="absolute bottom-4 left-4 z-10 max-w-md rounded-md border border-border bg-surface/90 px-3 py-2 text-xs text-muted backdrop-blur">
              Files grouped by responsibility (Routes/Controllers/Services/Models,
              Pages/Components/Hooks/API — whichever apply), not by folder. Click a layer for its
              file list, click an edge for the imports behind it.
            </div>
            <ArchitectureGraph architecture={architecture} />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-foreground">Couldn&apos;t load an architecture view for this repository.</p>
            <Button variant="outline" size="sm" onClick={handleReanalyze} disabled={reanalyzing}>
              <RefreshCw className={cn('h-3.5 w-3.5', reanalyzing && 'animate-spin')} /> Re-analyze
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArchitecturePage() {
  return (
    <RequireAuth>
      <ArchitecturePageContent />
    </RequireAuth>
  );
}
