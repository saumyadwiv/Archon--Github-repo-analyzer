'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, Loader2 } from 'lucide-react';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Navbar } from '@/components/layout/Navbar';
import { RepoTabNav } from '@/components/layout/RepoTabNav';
import { Button } from '@/components/ui/button';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatEmptyState } from '@/components/chat/ChatEmptyState';
import { aiApi, repositoryApi, apiErrorMessage } from '@/lib/api';
import { getSocket, connectSocket } from '@/lib/socket';
import { useToast } from '@/components/ui/toast';
import type { AIMessage, Repository } from '@/lib/types';

function ChatPageContent() {
  const { repoId } = useParams<{ repoId: string }>();
  const router = useRouter();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [repoRes, historyRes] = await Promise.all([
          repositoryApi.get(repoId),
          aiApi.getChatHistory(repoId),
        ]);
        setRepo(repoRes.data.data!.repository);
        setMessages(historyRes.data.data!.conversation.messages);
      } catch (err) {
        toast({ title: 'Could not load chat', description: apiErrorMessage(err), variant: 'error' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [repoId, toast]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    const socket = connectSocket();

    const onChunk = (data: { requestId: string; chunk: string }) => {
      if (data.requestId !== requestIdRef.current) return;
      setStreamingText((prev) => (prev ?? '') + data.chunk);
    };
    const onDone = (data: { requestId: string; message: AIMessage }) => {
      if (data.requestId !== requestIdRef.current) return;
      setMessages((prev) => [...prev, data.message]);
      setStreamingText(null);
      setSending(false);
      requestIdRef.current = null;
    };
    const onError = (data: { requestId: string; message: string }) => {
      if (data.requestId !== requestIdRef.current) return;
      toast({ title: 'AI chat failed', description: data.message, variant: 'error' });
      setStreamingText(null);
      setSending(false);
      requestIdRef.current = null;
    };

    socket.on('ai:chat:chunk', onChunk);
    socket.on('ai:chat:done', onDone);
    socket.on('ai:chat:error', onError);

    return () => {
      socket.off('ai:chat:chunk', onChunk);
      socket.off('ai:chat:done', onDone);
      socket.off('ai:chat:error', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setMessages((prev) => [...prev, { role: 'user', content: trimmed, createdAt: new Date().toISOString() }]);
      setDraft('');
      setSending(true);

      const socket = getSocket();
      if (socket.connected) {
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        requestIdRef.current = requestId;
        setStreamingText('');
        socket.emit('ai:chat:send', { repositoryId: repoId, message: trimmed, requestId });
        return;
      }

      // Socket unavailable (e.g. behind a proxy) — fall back to the plain REST endpoint.
      try {
        const res = await aiApi.chat(repoId, trimmed);
        setMessages((prev) => [...prev, res.data.data!.message]);
      } catch (err) {
        toast({ title: 'AI chat failed', description: apiErrorMessage(err), variant: 'error' });
      } finally {
        setSending(false);
      }
    },
    [repoId, sending, toast]
  );

  async function handleReset() {
    try {
      await aiApi.resetChat(repoId);
      setMessages([]);
      toast({ title: 'Conversation cleared', variant: 'success' });
    } catch (err) {
      toast({ title: 'Could not reset conversation', description: apiErrorMessage(err), variant: 'error' });
    }
  }

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

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <Navbar />
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          {repo && <span className="font-mono text-sm font-medium">{repo.fullName}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={messages.length === 0}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <RepoTabNav repoId={repoId} active="chat" reanalyzing={reanalyzing} onReanalyze={handleReanalyze} />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : repo && repo.status !== 'completed' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-foreground">This repository has not finished analysis yet.</p>
          <Link href={`/dashboard/${repoId}`}>
            <Button variant="outline" size="sm">
              View analysis progress
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messages.length === 0 && !streamingText ? (
              <ChatEmptyState repoName={repo?.fullName} onPick={(p) => send(p)} />
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
                {messages.map((m, i) => (
                  <ChatBubble key={i} message={m} />
                ))}
                {streamingText !== null && (
                  <ChatBubble
                    message={{ role: 'assistant', content: streamingText, createdAt: new Date().toISOString() }}
                    streaming
                  />
                )}
              </div>
            )}
          </div>
          <div className="mx-auto w-full max-w-3xl">
            <ChatComposer value={draft} onChange={setDraft} onSend={() => send(draft)} disabled={sending} />
          </div>
        </>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <RequireAuth>
      <ChatPageContent />
    </RequireAuth>
  );
}
