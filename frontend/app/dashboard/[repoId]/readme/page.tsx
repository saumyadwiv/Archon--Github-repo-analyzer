'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  FileText,
  Copy,
  Download,
  Sparkles,
  Loader2,
  Check,
  Wand2,
  AlertTriangle,
} from 'lucide-react';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Navbar } from '@/components/layout/Navbar';
import { RepoTabNav } from '@/components/layout/RepoTabNav';
import { Button } from '@/components/ui/button';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { aiApi, repositoryApi, apiErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { Repository } from '@/lib/types';

type RefineTurn = {
  id: string;
  instruction: string;
  status: 'pending' | 'done' | 'error';
  error?: string;
};

function ReadmePageContent() {
  const { repoId } = useParams<{ repoId: string }>();
  const router = useRouter();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [readme, setReadme] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refineInput, setRefineInput] = useState('');
  const [refining, setRefining] = useState(false);
  const [refineTurns, setRefineTurns] = useState<RefineTurn[]>([]);
  const [reanalyzing, setReanalyzing] = useState(false);
  const { toast } = useToast();

  async function handleReanalyze() {
    setReanalyzing(true);
    try {
      await repositoryApi.reanalyze(repoId);
      router.push(`/dashboard/${repoId}`);
    } catch (err) {
      toast({ title: 'Could not start re-analysis', description: apiErrorMessage(err), variant: 'error' });
      setReanalyzing(false);
    }
  }

  useEffect(() => {
    repositoryApi
      .get(repoId)
      .then((res) => setRepo(res.data.data!.repository))
      .catch((err) => toast({ title: 'Could not load repository', description: apiErrorMessage(err), variant: 'error' }));
  }, [repoId, toast]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await aiApi.generateReadme(repoId);
      setReadme(res.data.data!.readme);
      setRefineTurns([]);
    } catch (err) {
      toast({ title: 'Could not generate README', description: apiErrorMessage(err), variant: 'error' });
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefine() {
    const instruction = refineInput.trim();
    if (!instruction || refining) return;

    const turnId = crypto.randomUUID();
    setRefineTurns((prev) => [...prev, { id: turnId, instruction, status: 'pending' }]);
    setRefineInput('');
    setRefining(true);
    try {
      const res = await aiApi.refineReadme(repoId, instruction);
      setReadme(res.data.data!.readme);
      setRefineTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, status: 'done' } : t)));
    } catch (err) {
      const message = apiErrorMessage(err, 'Failed to update the README');
      setRefineTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, status: 'error', error: message } : t)));
    } finally {
      setRefining(false);
    }
  }

  async function handleCopy() {
    if (!readme) return;
    await navigator.clipboard.writeText(readme);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDownload() {
    if (!readme) return;
    const blob = new Blob([readme], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="container flex flex-col gap-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <h1 className="font-mono text-xl font-semibold">{repo?.fullName}</h1>
          </div>
          <RepoTabNav repoId={repoId} active="readme" reanalyzing={reanalyzing} onReanalyze={handleReanalyze} />
        </div>

        {!readme ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface px-6 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15">
              <FileText className="h-6 w-6 text-brand-light" />
            </div>
            <div>
              <h2 className="font-mono text-base font-semibold">Generate a README</h2>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Gemini will draft a README.md from the repository&rsquo;s detected languages, structure, and health
                analysis — tech stack, project layout, setup steps, and any architecture notes worth flagging.
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? 'Generating...' : 'Generate README'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 items-start gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" /> Download README.md
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-surface p-8">
                <div className="prose-chat mx-auto max-w-3xl">
                  <ReactMarkdown>{readme}</ReactMarkdown>
                </div>
              </div>
            </div>

            <div className="flex h-[calc(100vh-9rem)] w-80 shrink-0 flex-col rounded-lg border border-border bg-surface">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Wand2 className="h-3.5 w-3.5 text-brand-light" />
                <h2 className="text-sm font-medium">Refine with AI</h2>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {refineTurns.length === 0 ? (
                  <p className="text-xs leading-relaxed text-muted">
                    Tell Gemini what to change — e.g. &ldquo;shorten the tech stack section&rdquo;, &ldquo;add a
                    badges row&rdquo;, or &ldquo;drop the architecture notes&rdquo;. Each instruction updates the
                    README on the left in place.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {refineTurns.map((turn) => (
                      <div key={turn.id} className="flex flex-col gap-1.5">
                        <div className="ml-auto max-w-[90%] rounded-lg border border-brand/25 bg-brand/10 px-3 py-2 text-xs leading-relaxed text-foreground">
                          {turn.instruction}
                        </div>
                        <div
                          className={cn(
                            'flex items-center gap-1.5 px-1 text-xs',
                            turn.status === 'error' ? 'text-cycle' : 'text-muted'
                          )}
                        >
                          {turn.status === 'pending' && (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" /> Updating README...
                            </>
                          )}
                          {turn.status === 'done' && (
                            <>
                              <Check className="h-3 w-3" /> README updated
                            </>
                          )}
                          {turn.status === 'error' && (
                            <>
                              <AlertTriangle className="h-3 w-3" /> {turn.error}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <ChatComposer
                value={refineInput}
                onChange={setRefineInput}
                onSend={handleRefine}
                disabled={refining}
                placeholder="e.g. make the setup section shorter..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReadmePage() {
  return (
    <RequireAuth>
      <ReadmePageContent />
    </RequireAuth>
  );
}
