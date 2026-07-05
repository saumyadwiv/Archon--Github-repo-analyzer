'use client';

const NODES = [
  { x: 90, y: 80 }, { x: 260, y: 40 }, { x: 430, y: 90 }, { x: 600, y: 50 },
  { x: 150, y: 220 }, { x: 340, y: 210 }, { x: 520, y: 240 }, { x: 680, y: 190 },
  { x: 80, y: 360 }, { x: 260, y: 380 }, { x: 460, y: 360 }, { x: 630, y: 400 },
];

const EDGES: [number, number, boolean][] = [
  [0, 1, false], [1, 2, false], [2, 3, false], [1, 5, false],
  [4, 5, false], [5, 6, false], [6, 7, false], [2, 6, false],
  [4, 8, false], [5, 9, false], [8, 9, true], [9, 10, false],
  [10, 6, false], [10, 11, false], [9, 4, true], [0, 4, false],
];

export function GraphBackdrop() {
  return (
    <svg
      viewBox="0 0 760 460"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {EDGES.map(([a, b, isCycle], i) => {
        const na = NODES[a];
        const nb = NODES[b];
        return (
          <line
            key={i}
            x1={na.x}
            y1={na.y}
            x2={nb.x}
            y2={nb.y}
            stroke={isCycle ? '#F0466E' : '#2C3140'}
            strokeWidth={isCycle ? 1.5 : 1}
            className="hero-graph-line"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        );
      })}
      {NODES.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={5}
          fill={i % 5 === 0 ? '#6E5BFF' : '#8B92A3'}
          className="animate-pulse-slow"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </svg>
  );
}
