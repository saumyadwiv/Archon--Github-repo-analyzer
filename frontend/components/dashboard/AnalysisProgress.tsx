'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { repositoryApi } from '@/lib/api';
import { subscribeToRepo, getSocket } from '@/lib/socket';
import type { AnalysisJob, JobStage } from '@/lib/types';

const STAGE_LABELS: Record<JobStage, string> = {
  queued: 'Queued',
  cloning: 'Cloning repository',
  discovering_files: 'Discovering source files',
  parsing_ast: 'Parsing AST',
  building_graph: 'Building dependency graph',
  detecting_cycles: 'Detecting circular dependencies',
  computing_complexity: 'Computing complexity',
  scoring_health: 'Calculating health score',
  completed: 'Complete',
  failed: 'Failed',
};

const STAGE_ORDER: JobStage[] = [
  'queued',
  'cloning',
  'discovering_files',
  'parsing_ast',
  'building_graph',
  'detecting_cycles',
  'computing_complexity',
  'scoring_health',
  'completed',
];

export function AnalysisProgress({ repositoryId, jobId }: { repositoryId: string; jobId?: string }) {
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await repositoryApi.jobStatus(jobId);
      setJob(res.data.data!.job);
    } catch {
      // ignore transient errors — socket events are primary channel
    }
  }, [jobId]);

  useEffect(() => {
    poll();
    const unsubscribe = subscribeToRepo(repositoryId);
    const socket = getSocket();

    const onProgress = (data: Partial<AnalysisJob> & { stage: JobStage; progressPercent: number }) => {
      setJob((prev) => (prev ? { ...prev, ...data } : (data as AnalysisJob)));
    };
    const onCompleted = () => {
      setJob((prev) => (prev ? { ...prev, status: 'completed', stage: 'completed', progressPercent: 100 } : prev));
      setTimeout(() => router.push(`/dashboard/${repositoryId}/graph`), 900);
    };
    const onFailed = (data: { message: string }) => {
      setJob((prev) => (prev ? { ...prev, status: 'failed', stage: 'failed', error: { message: data.message } } : prev));
    };

    socket.on('analysis:progress', onProgress);
    socket.on('analysis:completed', onCompleted);
    socket.on('analysis:failed', onFailed);

    // Fallback polling in case sockets can't connect (e.g. behind a proxy)
    pollRef.current = setInterval(poll, 4000);

    return () => {
      socket.off('analysis:progress', onProgress);
      socket.off('analysis:completed', onCompleted);
      socket.off('analysis:failed', onFailed);
      unsubscribe();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [repositoryId, poll, router]);

  const failed = job?.status === 'failed';
  const currentIdx = job ? STAGE_ORDER.indexOf(job.stage) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {failed ? (
            <XCircle className="h-4 w-4 text-cycle" />
          ) : job?.status === 'completed' ? (
            <CheckCircle2 className="h-4 w-4 text-grade-a" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-brand-light" />
          )}
          {failed ? 'Analysis failed' : job?.progressMessage || 'Starting analysis...'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Progress value={failed ? 100 : job?.progressPercent || 0} className={failed ? '[&>div]:bg-cycle' : ''} />

        {failed && job?.error?.message && (
          <p className="rounded-md border border-cycle/30 bg-cycle/10 p-3 font-mono text-xs text-cycle">
            {job.error.message}
          </p>
        )}

        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STAGE_ORDER.slice(0, -1).map((stage, idx) => (
            <li
              key={stage}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                idx < currentIdx || job?.status === 'completed'
                  ? 'border-grade-a/25 bg-grade-a/10 text-grade-a'
                  : idx === currentIdx && !failed
                  ? 'border-brand/30 bg-brand/10 text-brand-light'
                  : 'border-border text-muted'
              }`}
            >
              {STAGE_LABELS[stage]}
            </li>
          ))}
        </ol>

        {job && (
          <div className="flex gap-4 font-mono text-xs text-muted">
            <span>{job.filesDiscovered || 0} files found</span>
            <span>{job.filesParsed || 0} parsed</span>
            {job.filesFailed > 0 && <span className="text-grade-c">{job.filesFailed} skipped</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
