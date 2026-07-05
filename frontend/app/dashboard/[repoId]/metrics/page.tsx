'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Navbar } from '@/components/layout/Navbar';
import { RepoTabNav } from '@/components/layout/RepoTabNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HealthScoreGauge } from '@/components/metrics/HealthScoreGauge';
import { ComplexityChart } from '@/components/metrics/ComplexityChart';
import { HealthScoreHistoryChart } from '@/components/metrics/HealthScoreHistoryChart';
import { FileBreakdownTable } from '@/components/metrics/FileBreakdownTable';
import { repositoryApi, apiErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { MetricsSnapshot, FileNode, Repository, MetricsHistoryPoint } from '@/lib/types';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MetricsContent() {
  const { repoId } = useParams<{ repoId: string }>();
  const router = useRouter();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [history, setHistory] = useState<MetricsHistoryPoint[]>([]);
  const [files, setFiles] = useState<FileNode[]>([]);
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
        const [repoRes, metricsRes, graphRes, historyRes] = await Promise.all([
          repositoryApi.get(repoId),
          repositoryApi.metrics(repoId),
          repositoryApi.graph(repoId),
          repositoryApi.metricsHistory(repoId),
        ]);
        setRepo(repoRes.data.data!.repository);
        setMetrics(metricsRes.data.data!.metrics);
        setFiles(graphRes.data.data!.nodes);
        setHistory(historyRes.data.data!.history);
      } catch (err) {
        toast({ title: 'Could not load metrics', description: apiErrorMessage(err), variant: 'error' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [repoId, toast]);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="container flex flex-col gap-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <h1 className="font-mono text-xl font-semibold">{repo?.fullName}</h1>
          </div>
          <RepoTabNav repoId={repoId} active="metrics" reanalyzing={reanalyzing} onReanalyze={handleReanalyze} />
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        )}

        {!loading && metrics && (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Health score</CardTitle>
                </CardHeader>
                <CardContent>
                  <HealthScoreGauge metrics={metrics} />
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4 lg:col-span-2">
                <StatCard label="Total files" value={metrics.totalFiles} />
                <StatCard label="Lines of code" value={metrics.totalLinesOfCode.toLocaleString()} />
                <StatCard label="Functions" value={metrics.totalFunctions} />
                <StatCard label="Avg complexity" value={metrics.averageComplexity.toFixed(1)} />
                <StatCard
                  label="Circular deps"
                  value={metrics.circularDependencyCount}
                  sub={metrics.circularDependencyCount > 0 ? `${metrics.filesInCycles} files affected` : 'None found'}
                />
                <StatCard label="Dependency edges" value={metrics.totalDependencyEdges} />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Health score history</CardTitle>
              </CardHeader>
              <CardContent>
                <HealthScoreHistoryChart history={history} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most complex files</CardTitle>
              </CardHeader>
              <CardContent>
                <ComplexityChart metrics={metrics} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>File breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <FileBreakdownTable files={files} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default function MetricsPage() {
  return (
    <RequireAuth>
      <MetricsContent />
    </RequireAuth>
  );
}
