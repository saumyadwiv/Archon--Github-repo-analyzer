'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GitBranch, Zap, Bot } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { GraphBackdrop } from '@/components/dashboard/GraphBackdrop';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

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
      <GraphBackdrop />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15">
            <GitBranch className="h-4 w-4 text-brand-light" />
          </div>
          <span className="font-semibold tracking-tight">Archon</span>
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

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 rounded-full border border-border-light bg-surface/60 px-3 py-1 font-mono text-xs text-muted backdrop-blur">
          AST-powered codebase intelligence
        </span>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          See the architecture hiding in <span className="text-brand-light">any repo</span>.
        </h1>
        <p className="mt-4 max-w-lg text-balance text-muted">
          Paste a GitHub URL. Archon parses every file, maps the dependency graph, flags circular
          imports, scores complexity, and lets you ask an AI about what it finds.
        </p>

        <div className="mt-8">
          <Link href="/register">
            <Button size="lg">Create a free account to analyze a repo</Button>
          </Link>
        </div>

        <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <Feature icon={<GitBranch className="h-4 w-4" />} title="Dependency graph" desc="Every import mapped, circular dependencies flagged in red." />
          <Feature icon={<Zap className="h-4 w-4" />} title="Health score" desc="A 0–100 grade from complexity, cycles, and file size." />
          <Feature icon={<Bot className="h-4 w-4" />} title="AI architecture chat" desc="Ask Gemini about any file or the whole codebase." />
        </div>
      </div>

      <footer className="relative z-10 pb-8 text-center text-xs text-muted">
        Sign in to paste a repository URL and start an analysis.
      </footer>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/60 p-4 text-left backdrop-blur">
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-brand/15 text-brand-light">
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted">{desc}</p>
    </div>
  );
}
