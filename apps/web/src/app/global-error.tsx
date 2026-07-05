'use client';

import { useEffect } from 'react';

// Root-level boundary. Only fires if the root layout itself throws, so it can't
// rely on any app providers/styling — keep it minimal and self-contained.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[Global Error Boundary]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            height: '100vh',
            textAlign: 'center',
            padding: '1.5rem',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
            TaskEasy hit an unexpected error
          </h2>
          <p style={{ maxWidth: '28rem', color: '#64748b', fontSize: '0.875rem' }}>
            Please try reloading the page. If this keeps happening, contact your administrator.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Reference: {error.digest}</p>
          )}
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
