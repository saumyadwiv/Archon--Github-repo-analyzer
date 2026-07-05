'use client';

import { useMemo, useState } from 'react';
import { ArrowUpDown, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { FileNode } from '@/lib/types';

type SortKey = 'filePath' | 'linesOfCode' | 'averageComplexity' | 'fileComplexity';

export function FileBreakdownTable({ files }: { files: FileNode[] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('fileComplexity');
  const [sortDesc, setSortDesc] = useState(true);

  const rows = useMemo(() => {
    let result = files;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((f) => f.filePath.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
    return result;
  }, [files, search, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Filter by file path..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-xs text-muted">
              <Th label="File" sortKey="filePath" active={sortKey} onClick={toggleSort} />
              <Th label="LOC" sortKey="linesOfCode" active={sortKey} onClick={toggleSort} />
              <Th label="Avg CX" sortKey="averageComplexity" active={sortKey} onClick={toggleSort} />
              <Th label="Total CX" sortKey="fileComplexity" active={sortKey} onClick={toggleSort} />
              <th className="px-3 py-2 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f._id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
                <td className="max-w-[320px] truncate px-3 py-2 font-mono text-xs text-foreground">{f.filePath}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{f.linesOfCode}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{f.averageComplexity.toFixed(1)}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{f.fileComplexity}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    {f.inCycle && <Badge variant="danger">cycle</Badge>}
                    {f.averageComplexity >= 15 && <Badge variant="warning">complex</Badge>}
                    {f.parseError && (
                      <Badge variant="outline" title={f.parseError}>
                        <AlertTriangle className="mr-1 h-3 w-3" /> parse error
                      </Badge>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted">
                  No files match &ldquo;{search}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  label,
  sortKey,
  active,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  onClick: (key: SortKey) => void;
}) {
  return (
    <th className="px-3 py-2 font-medium">
      <button onClick={() => onClick(sortKey)} className="flex items-center gap-1 hover:text-foreground">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active === sortKey ? 'text-brand-light' : 'opacity-40'}`} />
      </button>
    </th>
  );
}
