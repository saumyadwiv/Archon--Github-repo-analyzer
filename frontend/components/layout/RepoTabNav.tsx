'use client';

import Link from 'next/link';
import { Network, Layers, MessageSquare, BarChart3, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type RepoTab = 'graph' | 'architecture' | 'chat' | 'metrics' | 'readme';

const TABS: { id: RepoTab; label: string; icon: typeof Network }[] = [
  { id: 'graph', label: 'Graph', icon: Network },
  { id: 'architecture', label: 'Architecture', icon: Layers },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'readme', label: 'README', icon: FileText },
];

/**
 * Full set of repo-scoped destinations, rendered identically on every
 * sub-page. The tab matching the current page is visually "active" (solid
 * brand fill + glow) instead of being missing from the list entirely — every
 * page links to every other page, including itself.
 */
export function RepoTabNav({
  repoId,
  active,
  onReanalyze,
  reanalyzing,
}: {
  repoId: string;
  active: RepoTab;
  onReanalyze?: () => void;
  reanalyzing?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        return (
          <Link key={tab.id} href={`/dashboard/${repoId}/${tab.id}`}>
            <Button
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'transition-all duration-200',
                isActive
                  ? 'shadow-[0_2px_16px_-2px_rgba(110,91,255,0.65)] ring-1 ring-brand-light/40'
                  : 'hover:-translate-y-0.5 hover:shadow-[0_2px_10px_-2px_rgba(110,91,255,0.25)]'
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {tab.label}
            </Button>
          </Link>
        );
      })}

      {onReanalyze && (
        <>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Button
            variant="ghost"
            size="sm"
            onClick={onReanalyze}
            disabled={reanalyzing}
            className="hover:text-brand-light"
          >
            {reanalyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Re-analyze
          </Button>
        </>
      )}
    </div>
  );
}
