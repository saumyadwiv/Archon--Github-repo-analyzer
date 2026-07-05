'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Navbar } from '@/components/layout/Navbar';
import { ImportRepoForm } from '@/components/dashboard/ImportRepoForm';
import { RepoCard } from '@/components/dashboard/RepoCard';
import { Skeleton } from '@/components/ui/skeleton';
import { repositoryApi, apiErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { Repository, MetricsSnapshot } from '@/lib/types';
import { FolderGit2, GitBranch, Gauge, AlertTriangle } from 'lucide-react';

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3.5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand/15 ${accent || 'text-brand-light'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-lg font-semibold leading-tight">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

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

  const stats = useMemo(() => {
    if (!repos || repos.length === 0) return null;
    const withMetrics = repos
      .map((r) => (typeof r.latestMetricsSnapshot === 'object' ? (r.latestMetricsSnapshot as MetricsSnapshot) : null))
      .filter((m): m is MetricsSnapshot => !!m);

    const totalFiles = withMetrics.reduce((sum, m) => sum + m.totalFiles, 0);
    const totalCycles = withMetrics.reduce((sum, m) => sum + m.circularDependencyCount, 0);
    const avgHealth = withMetrics.length
      ? Math.round(withMetrics.reduce((sum, m) => sum + m.healthScore, 0) / withMetrics.length)
      : null;

    return { repoCount: repos.length, totalFiles, totalCycles, avgHealth };
  }, [repos]);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="container flex flex-col gap-10 py-10">
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analyze a repository</h1>
            <p className="mt-1 text-sm text-muted">
              Paste a public GitHub URL to parse its AST and map its architecture.
            </p>
          </div>
          <ImportRepoForm />
        </div>

        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<FolderGit2 className="h-4 w-4" />} label="Repositories analyzed" value={String(stats.repoCount)} />
            <StatCard icon={<GitBranch className="h-4 w-4" />} label="Files parsed" value={stats.totalFiles.toLocaleString()} />
            <StatCard
              icon={<Gauge className="h-4 w-4" />}
              label="Average health score"
              value={stats.avgHealth !== null ? String(stats.avgHealth) : '—'}
            />
            <StatCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Circular dependencies found"
              value={String(stats.totalCycles)}
              accent="text-cycle"
            />
          </div>
        )}

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
