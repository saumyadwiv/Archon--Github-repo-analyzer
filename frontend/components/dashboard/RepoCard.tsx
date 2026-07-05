'use client';

import Link from 'next/link';
import { FolderGit2, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, gradeColor } from '@/lib/utils';
import type { Repository, MetricsSnapshot } from '@/lib/types';

const STATUS_META: Record<Repository['status'], { label: string; variant: 'default' | 'brand' | 'success' | 'danger' }> = {
  pending: { label: 'Queued', variant: 'default' },
  cloning: { label: 'Cloning', variant: 'brand' },
  analyzing: { label: 'Analyzing', variant: 'brand' },
  completed: { label: 'Completed', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
};

export function RepoCard({ repo, onDelete }: { repo: Repository; onDelete: (id: string) => void }) {
  const inProgress = repo.status === 'pending' || repo.status === 'cloning' || repo.status === 'analyzing';
  const href = inProgress ? `/dashboard/${repo._id}` : `/dashboard/${repo._id}/graph`;
  const metrics = typeof repo.latestMetricsSnapshot === 'object' ? (repo.latestMetricsSnapshot as MetricsSnapshot) : null;
  const status = STATUS_META[repo.status];

  return (
    <Card className="group relative flex flex-col justify-between transition-colors hover:border-border-light">
      <Link href={href} className="flex flex-1 flex-col">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2">
              <FolderGit2 className="h-4 w-4 text-muted" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate font-mono text-sm">{repo.fullName}</CardTitle>
              <p className="mt-0.5 text-xs text-muted">{formatDate(repo.lastAnalyzedAt || repo.createdAt)}</p>
            </div>
          </div>
          {metrics && (
            <span className={`shrink-0 font-mono text-2xl font-bold ${gradeColor(metrics.healthGrade)}`}>
              {metrics.healthGrade}
            </span>
          )}
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-end gap-3">
          <div className="flex items-center gap-2">
            {inProgress && <Loader2 className="h-3 w-3 animate-spin text-brand-light" />}
            {repo.status === 'failed' && <AlertCircle className="h-3 w-3 text-cycle" />}
            <Badge variant={status.variant}>{status.label}</Badge>
            {metrics && metrics.circularDependencyCount > 0 && (
              <Badge variant="danger">{metrics.circularDependencyCount} cycles</Badge>
            )}
          </div>
          {metrics && (
            <div className="flex gap-4 font-mono text-xs text-muted">
              <span>{metrics.totalFiles} files</span>
              <span>{metrics.averageComplexity.toFixed(1)} avg cx</span>
            </div>
          )}
        </CardContent>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          onDelete(repo._id);
        }}
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-cycle group-hover:opacity-100"
        title="Delete repository"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </Card>
  );
}
