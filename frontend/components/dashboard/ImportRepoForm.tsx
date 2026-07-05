'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { repositoryApi, apiErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

export function ImportRepoForm() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized = /^(https:\/\/|git@)/.test(trimmed) ? trimmed : `https://${trimmed}`;

    setLoading(true);
    try {
      const res = await repositoryApi.import(normalized);
      const repo = res.data.data!.repository;
      toast({ title: 'Analysis started', description: repo.fullName, variant: 'success' });
      router.push(`/dashboard/${repo._id}`);
    } catch (err) {
      toast({ title: 'Could not start analysis', description: apiErrorMessage(err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted">
          $
        </span>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="github.com/owner/repository"
          className="h-12 pl-7 font-mono text-sm"
          disabled={loading}
        />
      </div>
      <Button type="submit" size="lg" disabled={loading} className="shrink-0">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        Analyze
      </Button>
    </form>
  );
}
