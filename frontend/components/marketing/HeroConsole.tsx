'use client';

import { AlertTriangle, GitBranch } from 'lucide-react';

// A denser, more organic graph than the old backdrop — this is the actual
// "thesis" visual: a repo mid-analysis, nodes lighting up, one cycle flagged.
const NODES = [
  { x: 40, y: 54 }, { x: 130, y: 22 }, { x: 214, y: 60 }, { x: 292, y: 26 },
  { x: 66, y: 132 }, { x: 168, y: 118 }, { x: 254, y: 140 }, { x: 330, y: 104 },
  { x: 24, y: 206 }, { x: 128, y: 214 }, { x: 232, y: 208 }, { x: 320, y: 196 },
  { x: 96, y: 274 }, { x: 200, y: 280 }, { x: 288, y: 262 },
];

const EDGES: [number, number, boolean][] = [
  [0, 1, false], [1, 2, false], [2, 3, false], [1, 5, false],
  [4, 5, false], [5, 6, false], [6, 7, false], [2, 6, false],
  [4, 8, false], [5, 9, false], [8, 9, true], [9, 10, false],
  [10, 6, false], [10, 11, false], [9, 12, true], [12, 13, true],
  [13, 10, false], [13, 14, false], [14, 11, false], [0, 4, false],
  [7, 11, false], [12, 8, false],
];

export function HeroConsole() {
  return (
    <div className="relative w-full max-w-[420px] sm:max-w-[460px]">
      {/* ambient glow behind the panel */}
      <div className="absolute -inset-8 -z-10 rounded-[2rem] bg-brand/20 blur-3xl" />

      <div className="rounded-xl border border-border-light bg-surface/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur">
        {/* window chrome */}
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-cycle/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-grade-c/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-grade-a/70" />
          <span className="ml-3 truncate font-mono text-[11px] text-muted">
            archon — analyzing facebook/react
          </span>
        </div>

        {/* graph canvas */}
        <div className="relative h-[300px] w-full overflow-hidden">
          <svg viewBox="0 0 360 300" className="h-full w-full" aria-hidden>
            {EDGES.map(([a, b, isCycle], i) => {
              const na = NODES[a];
              const nb = NODES[b];
              return (
                <line
                  key={i}
                  x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                  stroke={isCycle ? '#F0466E' : '#33394A'}
                  strokeWidth={isCycle ? 1.75 : 1.25}
                  strokeDasharray={isCycle ? '5 4' : undefined}
                  className="hero-graph-line"
                  style={{ animationDelay: `${i * 70}ms` }}
                />
              );
            })}
            {NODES.map((n, i) => (
              <circle
                key={i}
                cx={n.x} cy={n.y} r={i % 4 === 0 ? 5.5 : 4}
                fill={i % 4 === 0 ? '#8B7BFF' : '#4A5165'}
                className="animate-pulse-slow"
                style={{ animationDelay: `${i * 140}ms` }}
              />
            ))}
          </svg>

          {/* floating cycle callout */}
          <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-cycle/30 bg-cycle/10 px-2.5 py-1 font-mono text-[10px] text-cycle">
            <AlertTriangle className="h-3 w-3" />
            circular import
          </div>

          {/* floating health score card */}
          <div className="absolute bottom-4 right-4 flex items-center gap-3 rounded-lg border border-border-light bg-canvas/90 px-3 py-2 shadow-lg backdrop-blur">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">health</p>
              <p className="font-mono text-lg font-bold leading-none text-grade-a">A</p>
            </div>
            <div className="h-8 w-px bg-border-light" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">files</p>
              <p className="font-mono text-sm font-semibold leading-none">1,842</p>
            </div>
          </div>
        </div>

        {/* footer status line */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 font-mono text-[11px] text-muted">
          <GitBranch className="h-3 w-3 text-brand-light" />
          <span className="text-foreground">228</span> files parsed
          <span className="mx-1 text-border-light">·</span>
          <span className="text-cycle">1</span> cycle flagged
          <span className="mx-1 text-border-light">·</span>
          <span className="animate-pulse-slow text-brand-light">●</span> live
        </div>
      </div>
    </div>
  );
}
