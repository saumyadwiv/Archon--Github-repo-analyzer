'use client';

import { useEffect, useRef, useState } from 'react';

type Node3D = { x: number; y: number; z: number; r: number; color: string };

// Three depth layers of a dependency graph — back (distant modules), mid
// (the graph body), front (the files currently in view). Perspective +
// slow auto-rotation does the rest; no WebGL needed for this to read as 3D.
const LAYERS: { z: number; nodes: Node3D[]; edges: [number, number][]; cycleEdges?: [number, number][] }[] = [
  {
    z: -140,
    nodes: [
      { x: -90, y: -60, z: 0, r: 5, color: '#3A4053' },
      { x: 60, y: -90, z: 0, r: 5, color: '#3A4053' },
      { x: 110, y: 40, z: 0, r: 4, color: '#3A4053' },
      { x: -110, y: 60, z: 0, r: 4, color: '#3A4053' },
      { x: 10, y: -30, z: 0, r: 4, color: '#4A5165' },
      { x: -50, y: 100, z: 0, r: 4, color: '#3A4053' },
      { x: 130, y: -30, z: 0, r: 3.5, color: '#4A5165' },
      { x: -140, y: -10, z: 0, r: 3.5, color: '#3A4053' },
    ],
    edges: [[0, 1], [1, 2], [0, 3], [0, 4], [4, 1], [3, 5], [2, 6], [0, 7]],
  },
  {
    z: 0,
    nodes: [
      { x: -70, y: -20, z: 0, r: 7, color: '#6E5BFF' },
      { x: 20, y: -70, z: 0, r: 6, color: '#8B7BFF' },
      { x: 90, y: 0, z: 0, r: 6, color: '#6E5BFF' },
      { x: 40, y: 70, z: 0, r: 7, color: '#8B7BFF' },
      { x: -80, y: 60, z: 0, r: 5, color: '#4A5165' },
      { x: -20, y: 10, z: 0, r: 6, color: '#8B7BFF' },
      { x: 130, y: -50, z: 0, r: 4.5, color: '#4A5165' },
      { x: 120, y: 60, z: 0, r: 4.5, color: '#4A5165' },
      { x: -130, y: 0, z: 0, r: 4.5, color: '#6E5BFF' },
      { x: -40, y: -70, z: 0, r: 4, color: '#4A5165' },
    ],
    edges: [
      [0, 1], [1, 2], [1, 3], [3, 4], [0, 4], [2, 3],
      [0, 5], [5, 1], [5, 3], [2, 6], [3, 7], [4, 8],
      [0, 8], [1, 9], [5, 9],
    ],
  },
  {
    z: 140,
    nodes: [
      { x: -30, y: -30, z: 0, r: 6, color: '#F0466E' },
      { x: 50, y: 10, z: 0, r: 6, color: '#F0466E' },
      { x: -10, y: 55, z: 0, r: 5, color: '#34D399' },
      { x: -90, y: 20, z: 0, r: 4.5, color: '#4A5165' },
      { x: 90, y: -40, z: 0, r: 4, color: '#4A5165' },
      { x: 20, y: -80, z: 0, r: 4, color: '#4A5165' },
    ],
    edges: [[3, 0], [1, 4], [0, 5]],
    cycleEdges: [[0, 1], [1, 0]],
  },
];

const LEGEND = [
  { label: 'Core module', color: '#8B7BFF', dashed: false },
  { label: 'Circular dependency', color: '#F0466E', dashed: true },
  { label: 'Cross-cutting', color: '#4A5165', dashed: false },
];

export function Graph3D() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [spin, setSpin] = useState(0);

  // Slow, continuous auto-rotation driven from JS (rather than a CSS
  // keyframe) so it can be combined with the mouse-parallax tilt below
  // without the two transform sources fighting each other.
  useEffect(() => {
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setSpin((s) => s + dt * 0.0006);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -14, y: px * 18 });
  }

  const wobble = Math.sin(spin) * 10;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
      {/* vignette panel behind the scene so it doesn't read as bare black space */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-surface/40">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(110,91,255,0.14), transparent 70%)',
          }}
        />
        {/* subtle floor grid, fading toward the edges */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(139,123,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(139,123,255,0.08) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 65% 65% at 50% 55%, black 20%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 65% 65% at 50% 55%, black 20%, transparent 75%)',
          }}
        />

        <div
          ref={wrapRef}
          onMouseMove={handleMove}
          onMouseLeave={() => setTilt({ x: 0, y: 0 })}
          className="relative h-[380px] w-full select-none"
          style={{ perspective: '1100px' }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${18 + tilt.x}deg) rotateY(${wobble + tilt.y}deg)`,
              transition: 'transform 200ms ease-out',
            }}
          >
            {LAYERS.map((layer, li) => (
              <svg
                key={li}
                viewBox="-160 -140 320 280"
                className="absolute h-[280px] w-[320px] overflow-visible"
                style={{ transform: `translateZ(${layer.z}px)` }}
              >
                {layer.edges.map(([a, b], i) => (
                  <line
                    key={`e-${i}`}
                    x1={layer.nodes[a].x} y1={layer.nodes[a].y}
                    x2={layer.nodes[b].x} y2={layer.nodes[b].y}
                    stroke="#2C3140"
                    strokeWidth={li === 1 ? 1.6 : 1.1}
                    opacity={0.35 + li * 0.25}
                  />
                ))}
                {layer.cycleEdges?.map(([a, b], i) => (
                  <line
                    key={`c-${i}`}
                    x1={layer.nodes[a].x} y1={layer.nodes[a].y}
                    x2={layer.nodes[b].x} y2={layer.nodes[b].y}
                    stroke="#F0466E"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    opacity={0.85}
                  />
                ))}
                {layer.nodes.map((n, i) => (
                  <circle
                    key={i}
                    cx={n.x} cy={n.y} r={n.r}
                    fill={n.color}
                    opacity={0.5 + li * 0.25}
                    className="animate-pulse-slow"
                    style={{ animationDelay: `${(li * 5 + i) * 130}ms` }}
                  />
                ))}
              </svg>
            ))}

            {/* ground shadow for depth grounding */}
            <div
              className="absolute h-[300px] w-[300px] rounded-full bg-brand/10 blur-2xl"
              style={{ transform: 'translateZ(-160px) rotateX(90deg)' }}
            />
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-muted">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
