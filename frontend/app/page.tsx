'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  GitBranch,
  Gauge,
  MessagesSquare,
  ArrowRight,
  Loader2,
  GitCompareArrows,
  Sparkles,
  Github,
  FileCode2,
  Radio,
  KeyRound,
  LayoutGrid,
  MousePointerClick,
  Wand2,
  History,
  Mail,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HeroConsole } from '@/components/marketing/HeroConsole';
import { Graph3D } from '@/components/marketing/Graph3D';
import {
  MiniDependencyGraphMockup,
  HealthRingMockup,
  ArchitectureClusterMockup,
  ChatBubbleMockup,
  ReadmePanelMockup,
} from '@/components/marketing/FeatureMockups';

const PIPELINE = [
  { step: '01', title: 'Paste a URL', desc: 'Any public GitHub repository. No install, no config file, no CI hook.' },
  { step: '02', title: 'Archon parses the AST', desc: 'Every file is walked at the syntax-tree level, across languages, not just grepped for imports.' },
  { step: '03', title: 'The graph gets built', desc: 'Import edges are mapped into a live dependency graph, and cycles are traced and flagged in red.' },
  { step: '04', title: 'Files get scored', desc: 'Cyclomatic complexity, fan-out, and file size roll up into a 0–100 health grade per file and per repo.' },
  { step: '05', title: 'You ask it anything', desc: 'Chat with an AI that has the whole codebase graph as context — not just the file you pasted.' },
];

// The five modules with the most visual payoff get a small illustrative
// mockup and a couple lines of copy; everything else stays a compact grid.
const FEATURED_MODULES = [
  {
    title: 'Dependency graph',
    desc: 'See how every file connects — core modules everything imports, and the cycles that need breaking.',
    mockup: <MiniDependencyGraphMockup />,
  },
  {
    title: 'Health scoring',
    desc: 'Complexity, cycles, file size, and structure roll up into a single 0–100 grade per repo.',
    mockup: <HealthRingMockup />,
  },
  {
    title: 'Architecture visualization',
    desc: 'Files cluster into layers — pages, components, tests — so you see the shape of the codebase, not just its files.',
    mockup: <ArchitectureClusterMockup />,
  },
  {
    title: 'AI chat over the codebase',
    desc: '"What breaks if I delete this file?" — answered with the full dependency graph as context.',
    mockup: <ChatBubbleMockup />,
  },
  {
    title: 'AI README generation',
    desc: 'One click drafts a README from the repo\u2019s real structure, stack, and health — not a generic template.',
    mockup: <ReadmePanelMockup />,
  },
];

const MODULES = [
  { icon: <Github className="h-4 w-4" />, title: 'GitHub import', desc: 'Paste a repo URL — Archon clones it in the background with a live progress bar.' },
  { icon: <FileCode2 className="h-4 w-4" />, title: 'AST parser', desc: 'Code is parsed like a compiler would — functions, exports, imports, class hierarchies.' },
  { icon: <GitCompareArrows className="h-4 w-4" />, title: 'Circular dependency detection', desc: 'Traces the whole import chain and flags the cycle in red.' },
  { icon: <Gauge className="h-4 w-4" />, title: 'Cyclomatic complexity', desc: 'Every function scored by its branches and loops.' },
  { icon: <MessagesSquare className="h-4 w-4" />, title: 'AI architecture explanations', desc: 'Click a file, hit "Explain," and get its role in the codebase.' },
  { icon: <Radio className="h-4 w-4" />, title: 'Async analysis, live updates', desc: 'Large repos run as background jobs — progress streams over WebSocket.' },
  { icon: <KeyRound className="h-4 w-4" />, title: 'Accounts & history', desc: 'Sign in with email or Google — every analysis is saved to your account.' },
];

const ADVANCED = [
  { icon: <LayoutGrid className="h-4 w-4" />, title: 'Alternative layout modes', desc: 'Switch between a hierarchical tree, a force-directed layout that clusters tightly-coupled modules, or a radial view grouped by folder.' },
  { icon: <MousePointerClick className="h-4 w-4" />, title: 'Focus & isolation mode', desc: "Click a node and everything outside its direct dependencies and dependents dims — built for exploring a graph one file at a time, not all 400 at once." },
  { icon: <Wand2 className="h-4 w-4" />, title: '"Explain this cycle"', desc: 'A dedicated prompt that explains why a specific circular dependency likely exists — and suggests which import to invert to break it.' },
  { icon: <History className="h-4 w-4" />, title: 'Health score history', desc: 'Every analysis run is stored, so re-analyzing after changes plots your health score over time on a simple trend line.' },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15">
            <GitBranch className="h-5 w-5 text-brand-light" />
          </div>
          <span className="text-xl font-bold tracking-tight sm:text-2xl">Archon</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-14 px-6 pb-20 pt-6 sm:px-10 lg:flex-row lg:items-center lg:gap-10 lg:pt-10">
        <div className="flex max-w-xl flex-col items-start text-left">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-light bg-surface/60 px-3 py-1 font-mono text-xs text-muted backdrop-blur">
            <Sparkles className="h-3 w-3 text-brand-light" />
            AST-powered codebase intelligence
          </span>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            See the architecture{' '}
            <span className="relative whitespace-nowrap text-brand-light">hiding in any repo</span>.
          </h1>
          <p className="mt-5 max-w-md text-balance text-base text-muted sm:text-lg">
            Paste a GitHub URL. Archon parses every file, maps the dependency graph, flags
            circular imports, scores complexity, and lets you ask an AI about what it finds.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Create a free account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Sign in
              </Button>
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-2 font-mono text-xs text-muted">
            <span className="text-brand-light">$</span>
            <span>paste any public repo — analysis starts in seconds</span>
          </div>
        </div>

        <div className="flex w-full justify-center lg:justify-end">
          <HeroConsole />
        </div>
      </section>

      {/* 3D graph showcase */}
      <section className="relative z-10 border-t border-border bg-surface/30">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center sm:px-10">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">One graph, every angle.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">
            Drag your cursor across it — the same graph Archon renders in your browser, tilted into three
            dimensions so the depth of a real dependency tree is easier to feel.
          </p>
          <div className="mt-10">
            <Graph3D />
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="relative z-10 border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
          <div className="mb-12 max-w-lg">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              From URL to architecture map, in five steps.
            </h2>
            <p className="mt-3 text-sm text-muted">
              The whole pipeline runs the moment you paste a link — nothing to install locally.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
            {PIPELINE.map((p) => (
              <div key={p.step} className="flex flex-col gap-2">
                <span className="font-mono text-sm text-brand-light">{p.step}</span>
                <h3 className="text-sm font-semibold">{p.title}</h3>
                <p className="text-xs leading-relaxed text-muted">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core modules */}
      <section className="relative z-10 border-t border-border bg-surface/30">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
          <div className="mb-12 max-w-lg">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Every module, mapped.
            </h2>
            <p className="mt-3 text-sm text-muted">
              Everything you need to read a codebase you didn&apos;t write — end to end.
            </p>
          </div>
          {/* Alternating visual + short copy, like a real product page */}
          <div className="flex flex-col gap-16 sm:gap-20">
            {FEATURED_MODULES.map((f, i) => (
              <div
                key={f.title}
                className={cn(
                  'flex flex-col items-center gap-8 lg:flex-row lg:gap-14',
                  i % 2 === 1 && 'lg:flex-row-reverse'
                )}
              >
                <div className="flex w-full flex-1 justify-center">{f.mockup}</div>
                <div className="w-full flex-1 text-center lg:text-left">
                  <h3 className="text-lg font-semibold sm:text-xl">{f.title}</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted lg:mx-0">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Remaining smaller features, compact icon + short text */}
          <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((f) => (
              <div
                key={f.title}
                className="group flex gap-3.5 rounded-lg border border-border bg-surface/60 p-4 backdrop-blur transition-colors hover:border-border-light"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand-light">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advanced features */}
      <section className="relative z-10 border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
          <div className="mb-12 max-w-lg">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Built for big, messy repos.
            </h2>
            <p className="mt-3 text-sm text-muted">
              Nobody reads a 400-node graph all at once — these are the tools for exploring one instead.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ADVANCED.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 rounded-lg border border-border bg-surface/60 p-5 backdrop-blur transition-colors hover:border-border-light"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand-light">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center sm:px-10">
          <h2 className="max-w-lg text-2xl font-bold tracking-tight sm:text-3xl">
            Stop guessing how a repo fits together.
          </h2>
          <p className="max-w-md text-sm text-muted">
            Create a free account and paste your first repository — the graph builds itself.
          </p>
          <Link href="/register">
            <Button size="lg">
              Create a free account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Contact / support */}
      <section className="relative z-10 border-t border-border bg-surface/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-16 text-center sm:px-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand/15 text-brand-light">
            <Mail className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Questions, bugs, or feedback?</h2>
          <p className="max-w-sm text-sm text-muted">
            Archon is built and maintained by a single developer — reach out directly and you&apos;ll hear back.
          </p>
          <a href="mailto:saumyadwivedi1904@gmail.com" className="font-mono text-sm text-brand-light hover:underline">
            saumyadwivedi1904@gmail.com
          </a>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border px-6 py-8 text-center text-xs text-muted sm:px-10">
        Archon — AST-powered codebase intelligence.
      </footer>
    </main>
  );
}
