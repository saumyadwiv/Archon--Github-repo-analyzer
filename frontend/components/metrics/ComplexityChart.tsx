'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import type { MetricsSnapshot } from '@/lib/types';

export function ComplexityChart({ metrics }: { metrics: MetricsSnapshot }) {
  const data = [...metrics.topComplexFiles]
    .slice(0, 8)
    .reverse()
    .map((f) => ({
      name: f.filePath.split('/').pop() || f.filePath,
      complexity: f.complexity,
    }));

  function barColor(value: number) {
    if (value >= 30) return '#F0466E';
    if (value >= 15) return '#F5A623';
    return '#6E5BFF';
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232733" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#8B92A3', fontSize: 11 }} axisLine={{ stroke: '#232733' }} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fill: '#E7E9EE', fontSize: 11, fontFamily: 'var(--font-mono)' }}
          axisLine={{ stroke: '#232733' }}
        />
        <Tooltip
          contentStyle={{ background: '#181C25', border: '1px solid #232733', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#E7E9EE' }}
          cursor={{ fill: '#181C25' }}
        />
        <Bar dataKey="complexity" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={barColor(d.complexity)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
