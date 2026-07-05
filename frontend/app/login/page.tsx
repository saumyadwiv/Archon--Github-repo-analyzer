'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GitBranch, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { authApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-brand/15">
            <GitBranch className="h-4 w-4 text-brand-light" />
          </div>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to keep analyzing your repositories.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <a href={authApi.googleUrl()}>
            <Button variant="outline" type="button" className="w-full">
              Continue with Google
            </Button>
          </a>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted">or</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-cycle">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-muted">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-light hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
