'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router, isAuthenticated]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
      <div className="text-center bg-[var(--card-bg)] p-8 rounded-2xl shadow-[var(--shadow-lg)]">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--accent)]/20 rounded-full mb-4 shadow-md">
          <svg
            className="w-8 h-8 text-[var(--accent)] animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Redirecionando...</h1>
        <p className="text-white/90 font-medium">Aguarde um momento</p>
      </div>
    </div>
  );
}
