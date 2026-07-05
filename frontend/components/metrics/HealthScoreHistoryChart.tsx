'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Dot,
} from 'recharts';
import type { DotProps } from 'recharts';
import type { MetricsHistoryPoint } from '@/lib/types';

const GRADE_COLOR: Record<MetricsHistoryPoint['healthGrade'], string> = {
  A: '#34D399',
  B: '#7DD3A0',
  C: '#F5A623',
  D: '#F0813E',
  F: '#F0466E',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function GradeDot(props: DotProps & { payload?: MetricsHistoryPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  return <Dot cx={cx} cy={cy} r={4} fill={GRADE_COLOR[payload.healthGrade]} stroke="none" />;
}

export function HealthScoreHistoryChart({ history }: { history: MetricsHistoryPoint[] }) {
  if (history.length < 2) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted">
        Run at least one more analysis to see health score trend over time.
      </div>
    );
  }

  const data = history.map((h) => ({
    ...h,
    label: formatDate(h.createdAt),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: -10, right: 20, top: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232733" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#8B92A3', fontSize: 11 }}
          axisLine={{ stroke: '#232733' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#8B92A3', fontSize: 11 }}
          axisLine={{ stroke: '#232733' }}
          tickLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{ background: '#181C25', border: '1px solid #232733', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#E7E9EE' }}
          formatter={(value: number, _name, item) => {
            const grade = (item.payload as MetricsHistoryPoint).healthGrade;
            return [`${value} (${grade})`, 'Health score'];
          }}
        />
        <Line
          type="monotone"
          dataKey="healthScore"
          stroke="#6E5BFF"
          strokeWidth={2}
          dot={<GradeDot />}
          activeDot={{ r: 5, fill: '#8B7BFF' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
