'use client';

import { useEffect } from 'react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Route error boundary caught an error:', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-xl w-full text-center space-y-4">
        <h1 className="card-title">Something went wrong</h1>
        <p className="text-sm text-slate-300">
          The page failed to render. Try again or refresh the app.
        </p>
        <div className="flex gap-2 justify-center">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <button onClick={() => window.location.reload()} className="btn-secondary">
            Refresh
          </button>
        </div>
      </div>
    </main>
  );
}
