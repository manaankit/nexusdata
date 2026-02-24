'use client';

import { useEffect } from 'react';

interface GlobalErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    console.error('Global error boundary caught an error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="card max-w-xl w-full text-center space-y-4">
            <h1 className="card-title">Application error</h1>
            <p className="text-sm text-slate-300">
              An unexpected error occurred while loading the application shell.
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={reset} className="btn-primary">
                Retry
              </button>
              <button onClick={() => window.location.reload()} className="btn-secondary">
                Refresh app
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
