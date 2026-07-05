import { GitBranch, Workflow, Gauge, MessagesSquare } from 'lucide-react';

const POINTS = [
  { icon: <Workflow className="h-4 w-4" />, text: 'Dependency graphs built from real AST parsing, not regex' },
  { icon: <Gauge className="h-4 w-4" />, text: 'A 0–100 health grade for every repo you analyze' },
  { icon: <MessagesSquare className="h-4 w-4" />, text: 'An AI that already knows your codebase graph' },
];

// Denser node field used behind the auth panels — deliberately quieter than
// the landing-page hero so it reads as texture, not the main event.
const NODES = [
  { x: 40, y: 40 }, { x: 140, y: 20 }, { x: 230, y: 60 }, { x: 60, y: 130 },
  { x: 170, y: 110 }, { x: 260, y: 150 }, { x: 30, y: 220 }, { x: 150, y: 230 },
  { x: 250, y: 250 }, { x: 100, y: 300 }, { x: 210, y: 320 },
];
const EDGES: [number, number, boolean][] = [
  [0, 1], [1, 2], [0, 3], [1, 4], [4, 5], [3, 4], [3, 6], [4, 7],
  [7, 8], [6, 7], [7, 9], [8, 10], [9, 10], [5, 8],
].map(([a, b], i) => [a, b, i === 6]) as [number, number, boolean][];

export function AuthSidePanel({ heading, sub }: { heading: string; sub: string }) {
  return (
    <div className="relative hidden h-full flex-col justify-between overflow-hidden border-r border-border bg-surface/40 p-10 lg:flex">
      <div className="pointer-events-none absolute inset-0">
        <svg viewBox="0 0 300 340" className="h-full w-full opacity-[0.5]" preserveAspectRatio="xMidYMid slice" aria-hidden>
          {EDGES.map(([a, b, isCycle], i) => (
            <line
              key={i}
              x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y}
              stroke={isCycle ? '#F0466E' : '#232733'}
              strokeWidth={isCycle ? 1.5 : 1}
              className="hero-graph-line"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
          {NODES.map((n, i) => (
            <circle
              key={i} cx={n.x} cy={n.y} r={i % 3 === 0 ? 4.5 : 3.5}
              fill={i % 3 === 0 ? '#6E5BFF' : '#3A4053'}
              className="animate-pulse-slow"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </svg>
      </div>
      <div className="pointer-events-none absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-brand/15 blur-3xl" />

      <div className="relative z-10 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15">
          <GitBranch className="h-4 w-4 text-brand-light" />
        </div>
        <span className="font-semibold tracking-tight">Archon</span>
      </div>

      <div className="relative z-10 max-w-xs">
        <h2 className="text-xl font-semibold leading-snug tracking-tight">{heading}</h2>
        <p className="mt-2 text-sm text-muted">{sub}</p>
        <ul className="mt-6 flex flex-col gap-3">
          {POINTS.map((p) => (
            <li key={p.text} className="flex items-start gap-2.5 text-xs text-muted">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand-light">
                {p.icon}
              </span>
              <span className="pt-0.5">{p.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 font-mono text-[11px] text-muted">
        AST-powered codebase intelligence.
      </p>
    </div>
  );
}
