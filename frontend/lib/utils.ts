import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDuration(ms?: number) {
  if (!ms) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function gradeColor(grade: 'A' | 'B' | 'C' | 'D' | 'F') {
  const map: Record<string, string> = {
    A: 'text-grade-a',
    B: 'text-grade-b',
    C: 'text-grade-c',
    D: 'text-grade-d',
    F: 'text-grade-f',
  };
  return map[grade] || 'text-muted';
}

export function gradeBg(grade: 'A' | 'B' | 'C' | 'D' | 'F') {
  const map: Record<string, string> = {
    A: 'bg-grade-a/15 border-grade-a/30',
    B: 'bg-grade-b/15 border-grade-b/30',
    C: 'bg-grade-c/15 border-grade-c/30',
    D: 'bg-grade-d/15 border-grade-d/30',
    F: 'bg-grade-f/15 border-grade-f/30',
  };
  return map[grade] || '';
}
