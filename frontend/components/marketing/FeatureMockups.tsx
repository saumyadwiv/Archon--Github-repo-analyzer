import { AlertTriangle, FileCode2, FileText, Sparkles, Bot, User as UserIcon, Layers } from 'lucide-react';

// A family of small, static "product screenshot" style mockups used to break
// up the text-heavy feature sections on the landing page. Each one echoes a
// real in-app surface (graph canvas, health gauge, architecture view, chat,
// README generator) using the same dark/purple design tokens and component
// shapes as the actual app screens.

function PanelChrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2.5">
      <span className="h-2 w-2 rounded-full bg-cycle/70" />
      <span className="h-2 w-2 rounded-full bg-grade-c/70" />
      <span className="h-2 w-2 rounded-full bg-grade-a/70" />
      <span className="ml-2 truncate font-mono text-[10px] text-muted">{label}</span>
    </div>
  );
}

function MockupFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[1.75rem] bg-brand/10 blur-2xl" />
      <div className="overflow-hidden rounded-xl border border-border-light bg-surface/90 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur">
        <PanelChrome label={label} />
        {children}
      </div>
    </div>
  );
}

// 1. Mini dependency-graph card — small file "chips" like the real canvas,
// joined by edges, with one pair flagged as a circular dependency.
type MiniNode = { x: number; y: number; w: number; label: string; cycle?: boolean; accent: string };

const MINI_NODES: MiniNode[] = [
  { x: 8, y: 18, w: 62, label: 'router.ts', accent: '#6E5BFF' },
  { x: 82, y: 8, w: 60, label: 'auth.ts', accent: '#34D399' },
  { x: 82, y: 62, w: 66, label: 'parser.ts', accent: '#F0466E', cycle: true },
  { x: 8, y: 96, w: 66, label: 'graph.ts', accent: '#F0466E', cycle: true },
  { x: 156, y: 34, w: 58, label: 'utils.ts', accent: '#3B9DF0' },
  { x: 150, y: 96, w: 60, label: 'cache.ts', accent: '#F5A623' },
];
const MINI_EDGES: [number, number][] = [
  [0, 1], [0, 3], [1, 4], [2, 3], [3, 2], [2, 4], [4, 5], [0, 2],
];
const MINI_H = 22;

export function MiniDependencyGraphMockup() {
  return (
    <MockupFrame label="archon — dependency graph">
      <div className="relative h-[190px] w-full px-3 py-4">
        <svg viewBox="0 0 220 155" className="absolute inset-0 h-full w-full px-3 py-4" preserveAspectRatio="none">
          {MINI_EDGES.map(([a, b], i) => {
            const na = MINI_NODES[a];
            const nb = MINI_NODES[b];
            const isCycle = na.cycle && nb.cycle;
            return (
              <line
                key={i}
                x1={na.x + na.w / 2} y1={na.y + MINI_H / 2}
                x2={nb.x + nb.w / 2} y2={nb.y + MINI_H / 2}
                stroke={isCycle ? '#F0466E' : '#33394A'}
                strokeWidth={isCycle ? 1.5 : 1}
                strokeDasharray={isCycle ? '4 3' : undefined}
              />
            );
          })}
        </svg>
        {MINI_NODES.map((n) => (
          <div
            key={n.label}
            className="absolute flex items-center gap-1 rounded border bg-surface px-1.5 py-1 shadow-sm"
            style={{
              left: n.x, top: n.y, width: n.w, height: MINI_H,
              borderLeft: `2.5px solid ${n.accent}`,
              borderColor: n.cycle ? 'rgba(240,70,110,0.5)' : '#2C3140',
            }}
          >
            {n.cycle ? (
              <AlertTriangle className="h-2 w-2 shrink-0 text-cycle" />
            ) : (
              <FileCode2 className="h-2 w-2 shrink-0 text-muted" />
            )}
            <span className="truncate font-mono text-[8px] text-foreground">{n.label}</span>
          </div>
        ))}
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-cycle/30 bg-cycle/10 px-2 py-0.5 font-mono text-[9px] text-cycle">
          <AlertTriangle className="h-2.5 w-2.5" />
          1 cycle
        </div>
      </div>
    </MockupFrame>
  );
}

// 2. Circular health-score ring ("99 / A")
export function HealthRingMockup() {
  const circumference = 2 * Math.PI * 52;
  const score = 99;
  const offset = circumference - (score / 100) * circumference;
  return (
    <MockupFrame label="archon — repo health">
      <div className="flex items-center gap-6 px-6 py-8">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#181C25" strokeWidth="9" />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="#34D399"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold text-foreground">{score}</span>
            <span className="font-mono text-xs font-semibold text-grade-a">A</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2.5">
          {[
            { label: 'Complexity', pct: 92 },
            { label: 'Circular deps', pct: 100 },
            { label: 'Structure', pct: 88 },
          ].map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between font-mono text-[10px] text-muted">
                <span>{row.label}</span>
                <span className="text-foreground">{row.pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-brand" style={{ width: `${row.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

// 3. Architecture cluster diagram — labeled cluster cards (Components / Pages
// / Tests) connected by dotted edges, matching the real Architecture tab's
// layer cards.
type Cluster = { label: string; kind: string; files: number; x: number; y: number; w: number; h: number };

const CLUSTERS: Cluster[] = [
  { label: 'Components', kind: 'ORCHESTRATION', files: 12, x: 62, y: 6, w: 96, h: 46 },
  { label: 'Pages', kind: 'SURFACE', files: 11, x: 6, y: 96, w: 78, h: 46 },
  { label: 'Tests', kind: 'CROSS-CUTTING', files: 2, x: 122, y: 100, w: 78, h: 46 },
];
const CLUSTER_EDGES: [number, number][] = [
  [0, 1], [0, 2], [1, 2],
];

export function ArchitectureClusterMockup() {
  return (
    <MockupFrame label="archon — architecture view">
      <div className="relative h-[190px] w-full px-2 py-2">
        <svg viewBox="0 0 220 160" className="absolute inset-0 h-full w-full px-2 py-2">
          {CLUSTER_EDGES.map(([a, b], i) => {
            const ca = CLUSTERS[a];
            const cb = CLUSTERS[b];
            return (
              <line
                key={i}
                x1={ca.x + ca.w / 2} y1={ca.y + ca.h / 2}
                x2={cb.x + cb.w / 2} y2={cb.y + cb.h / 2}
                stroke="#3A4053"
                strokeWidth="1.25"
                strokeDasharray="1 4"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        {CLUSTERS.map((c) => (
          <div
            key={c.label}
            className="absolute rounded-md border border-border-light bg-canvas/90 px-2 py-1.5 shadow-sm"
            style={{ left: c.x, top: c.y, width: c.w, height: c.h }}
          >
            <div className="flex items-center gap-1">
              <Layers className="h-2.5 w-2.5 text-brand-light" />
              <span className="truncate text-[10px] font-semibold text-foreground">{c.label}</span>
            </div>
            <p className="mt-0.5 font-mono text-[7px] uppercase tracking-wide text-muted">{c.kind}</p>
            <p className="mt-1 font-mono text-[8px] text-muted">{c.files} files</p>
          </div>
        ))}
      </div>
    </MockupFrame>
  );
}

// 4. Chat-bubble mockup
export function ChatBubbleMockup() {
  return (
    <MockupFrame label="archon — ask the codebase">
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex flex-row-reverse gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
            <UserIcon className="h-3 w-3" />
          </div>
          <div className="max-w-[80%] rounded-lg border border-brand/25 bg-brand/10 px-3 py-2 text-[11px] leading-relaxed text-foreground">
            What breaks if I delete utils/parser.ts?
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand-light">
            <Bot className="h-3 w-3" />
          </div>
          <div className="max-w-[85%] rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-foreground">
            3 files import it directly — <span className="text-brand-light">graphBuilder.ts</span> and{' '}
            <span className="text-brand-light">cycleDetector.ts</span> would break immediately.
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}

// 5. "Generate README" panel mockup — mirrors the real empty-state panel:
// centered icon, short copy, purple call-to-action button.
export function ReadmePanelMockup() {
  return (
    <MockupFrame label="archon — README.md">
      <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand-light">
          <FileText className="h-4.5 w-4.5" />
        </div>
        <p className="text-xs font-semibold text-foreground">Generate a README</p>
        <p className="max-w-[220px] text-[10px] leading-relaxed text-muted">
          Drafted from the repo&apos;s detected stack, structure, and health analysis.
        </p>
        <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 font-mono text-[10px] font-medium text-white shadow-[0_2px_12px_-2px_rgba(110,91,255,0.55)]">
          <Sparkles className="h-2.5 w-2.5" />
          Generate README
        </div>
      </div>
    </MockupFrame>
  );
}
