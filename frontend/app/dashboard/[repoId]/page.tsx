'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Navbar } from '@/components/layout/Navbar';
import { AnalysisProgress } from '@/components/dashboard/AnalysisProgress';
import { Button } from '@/components/ui/button';
import { repositoryApi, apiErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { Repository } from '@/lib/types';

function RepoDetailContent() {
  const { repoId } = useParams<{ repoId: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    repositoryApi
      .get(repoId)
      .then((res) => {
        const r = res.data.data!.repository;
        setRepo(r);
        if (r.status === 'completed') router.replace(`/dashboard/${repoId}/graph`);
      })
      .catch((err) => toast({ title: 'Could not load repository', description: apiErrorMessage(err), variant: 'error' }));
  }, [repoId, router, toast]);

  async function handleReanalyze() {
    try {
      await repositoryApi.reanalyze(repoId);
      window.location.reload();
    } catch (err) {
      toast({ title: 'Could not start re-analysis', description: apiErrorMessage(err), variant: 'error' });
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="container max-w-2xl py-10">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>

        {!repo && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        )}

        {repo && (
          <>
            <h1 className="mb-1 font-mono text-xl font-semibold">{repo.fullName}</h1>
            <p className="mb-6 text-sm text-muted">{repo.githubUrl}</p>

            {repo.status === 'failed' ? (
              <div className="flex flex-col items-center gap-4 rounded-lg border border-cycle/30 bg-cycle/5 p-8 text-center">
                <p className="text-sm text-foreground">This analysis failed. You can try again.</p>
                <Button onClick={handleReanalyze} variant="outline">
                  <RefreshCw className="h-4 w-4" /> Retry analysis
                </Button>
              </div>
            ) : (
              <AnalysisProgress repositoryId={repoId} jobId={repo.latestAnalysisJob} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function RepoDetailPage() {
  return (
    <RequireAuth>
      <RepoDetailContent />
    </RequireAuth>
  );
}
