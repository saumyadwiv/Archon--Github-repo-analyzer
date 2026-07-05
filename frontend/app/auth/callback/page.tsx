'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function AuthCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { setUserFromToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('No authentication token received from Google.');
      return;
    }
    setUserFromToken(token)
      .then(() => router.replace('/dashboard'))
      .catch(() => setError('Could not complete sign-in. Please try again.'));
  }, [params, router, setUserFromToken]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      {error ? (
        <>
          <p className="text-sm text-cycle">{error}</p>
          <a href="/login" className="text-sm text-brand-light hover:underline">
            Back to sign in
          </a>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
          <p className="text-sm text-muted">Completing sign-in...</p>
        </>
      )}
    </main>
  );
}
