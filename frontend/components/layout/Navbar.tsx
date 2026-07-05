'use client';

import Link from 'next/link';
import { Network, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/90 backdrop-blur relative">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
      <div className="container flex h-14 items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15 shadow-[0_0_16px_-2px_rgba(110,91,255,0.6)] transition-shadow duration-200 hover:shadow-[0_0_20px_-1px_rgba(110,91,255,0.85)]">
            <Network className="h-4 w-4 text-brand-light" />
          </div>
          <span className="font-semibold tracking-tight">Archon</span>
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 font-mono text-xs font-semibold text-brand-light">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
              <span className="text-sm text-muted">{user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} title="Sign out">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
