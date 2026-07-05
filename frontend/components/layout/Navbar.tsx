'use client';

import Link from 'next/link';
import { Network, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/90 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand/15">
            <Network className="h-4 w-4 text-brand-light" />
          </div>
          <span className="font-semibold tracking-tight">Archon</span>
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{user.email}</span>
            <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
