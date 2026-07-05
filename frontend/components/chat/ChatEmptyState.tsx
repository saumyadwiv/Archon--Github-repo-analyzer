import { Sparkles } from 'lucide-react';

const EXAMPLE_PROMPTS = [
  'What are the most complex files in this repo, and why?',
  'Explain the circular dependencies you found.',
  'Which files look like entry points, and what do they likely wire together?',
  'Where would you start refactoring to improve the health score?',
];

export function ChatEmptyState({ repoName, onPick }: { repoName?: string; onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15">
        <Sparkles className="h-6 w-6 text-brand-light" />
      </div>
      <div>
        <h2 className="font-mono text-base font-semibold">Chat about {repoName || 'this repository'}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Gemini has full access to the dependency graph, complexity metrics, and health score from the latest
          analysis. Ask it anything about the architecture.
        </p>
      </div>
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPick(prompt)}
            className="rounded-md border border-border bg-surface px-3 py-2.5 text-left text-xs text-muted transition-colors hover:border-border-light hover:text-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
