'use client';

import { useState } from 'react';
import { Sparkles, Loader2, FileCode2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import client from '@/lib/api';
import type { FileNode } from '@/lib/types';

export function FileExplainDialog({
  file,
  repositoryId,
  open,
  onOpenChange,
}: {
  file: FileNode | null;
  repositoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExplain() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      // AI endpoint lands in Part 4 (Gemini integration). Calling it now so
      // the UI is already wired once that route exists.
      const res = await client.post<{ success: boolean; data: { explanation: string } }>('/ai/explain', {
        repositoryId,
        filePath: file.filePath,
      });
      setExplanation(res.data.data.explanation);
    } catch {
      setError('AI explain will be available once the Gemini integration (Part 4) is connected.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setExplanation(null);
          setError(null);
        }
      }}
    >
      <DialogContent className="max-w-xl">
        {file && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-mono text-base">
                <FileCode2 className="h-4 w-4 text-muted" />
                {file.fileName}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">{file.filePath}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Badge>{file.language}</Badge>
              <Badge>{file.linesOfCode} LOC</Badge>
              <Badge variant={file.averageComplexity >= 15 ? 'danger' : file.averageComplexity >= 8 ? 'warning' : 'success'}>
                avg complexity {file.averageComplexity.toFixed(1)}
              </Badge>
              {file.inCycle && <Badge variant="danger">circular dependency</Badge>}
              {file.isEntryPoint && <Badge variant="brand">entry point</Badge>}
            </div>

            <Separator />

            <div className="min-h-[100px]">
              {!explanation && !loading && !error && (
                <Button onClick={handleExplain} variant="outline" className="w-full">
                  <Sparkles className="h-4 w-4" />
                  Explain this file with AI
                </Button>
              )}
              {loading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Asking Gemini...
                </div>
              )}
              {error && <p className="text-sm text-muted">{error}</p>}
              {explanation && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{explanation}</p>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
