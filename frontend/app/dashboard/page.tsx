'use client';

import { useEffect, useState, useCallback } from 'react';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Navbar } from '@/components/layout/Navbar';
import { ImportRepoForm } from '@/components/dashboard/ImportRepoForm';
import { RepoCard } from '@/components/dashboard/RepoCard';
import { Skeleton } from '@/components/ui/skeleton';
import { repositoryApi, apiErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { Repository } from '@/lib/types';
import { FolderGit2 } from 'lucide-react';

function DashboardContent() {
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await repositoryApi.list();
      setRepos(res.data.data!.repositories);
    } catch (err) {
      toast({ title: 'Could not load repositories', description: apiErrorMessage(err), variant: 'error' });
      setRepos([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this repository and all its analysis data?')) return;
    try {
      await repositoryApi.delete(id);
      setRepos((prev) => prev?.filter((r) => r._id !== id) || null);
      toast({ title: 'Repository deleted', variant: 'success' });
    } catch (err) {
      toast({ title: 'Could not delete repository', description: apiErrorMessage(err), variant: 'error' });
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="container flex flex-col gap-8 py-10">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analyze a repository</h1>
            <p className="mt-1 text-sm text-muted">Paste a public GitHub URL to map its architecture.</p>
          </div>
          <ImportRepoForm />
        </div>

        <div>
          <h2 className="mb-4 text-sm font-medium text-muted">Your repositories</h2>

          {repos === null && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-36 w-full" />
              ))}
            </div>
          )}

          {repos !== null && repos.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
              <FolderGit2 className="h-8 w-8 text-muted" />
              <p className="text-sm text-muted">No repositories analyzed yet. Paste a URL above to get started.</p>
            </div>
          )}

          {repos && repos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {repos.map((repo) => (
                <RepoCard key={repo._id} repo={repo} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
