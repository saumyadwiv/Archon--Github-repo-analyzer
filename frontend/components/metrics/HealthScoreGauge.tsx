'use client';

import { gradeColor } from '@/lib/utils';
import type { MetricsSnapshot } from '@/lib/types';

export function HealthScoreGauge({ metrics }: { metrics: MetricsSnapshot }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (metrics.healthScore / 100) * circumference;
  const strokeColor =
    metrics.healthGrade === 'A' || metrics.healthGrade === 'B'
      ? '#34D399'
      : metrics.healthGrade === 'C'
      ? '#F5A623'
      : '#F0466E';

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#181C25" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={strokeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-bold text-foreground">{metrics.healthScore}</span>
          <span className={`font-mono text-sm font-semibold ${gradeColor(metrics.healthGrade)}`}>
            {metrics.healthGrade}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <BreakdownBar label="Complexity" value={metrics.scoreBreakdown.complexityScore} max={40} />
        <BreakdownBar label="Circular deps" value={metrics.scoreBreakdown.cycleScore} max={30} />
        <BreakdownBar label="File size" value={metrics.scoreBreakdown.sizeScore} max={15} />
        <BreakdownBar label="Structure" value={metrics.scoreBreakdown.structureScore} max={15} />
      </div>
    </div>
  );
}

function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-foreground">
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
