'use client';

import { useState } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import { getApiError } from '@/lib/axios';
import { PwaRegistration } from '@/components/PwaRegistration';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Surface every failed GET request, not just mutations. Pages no longer
        // need to remember to check `isError` themselves to get user feedback —
        // this is the safety net. Individual queries can opt out with
        // `meta: { silent: true }` (used for things like background polling).
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (query.meta?.silent) return;
            // Avoid spamming the same toast for every observer/retry of a query
            // that's already known to be failing.
            if (query.state.dataUpdatedAt === 0 && query.state.fetchFailureCount > 1) return;
            toast.error(getApiError(error), { id: query.queryHash });
          },
        }),
        // FE-01 fix: surface failed mutations globally so pages that forgot to
        // add an onError still show user feedback. Pages that need custom
        // handling can pass `meta: { silent: true }` on the mutation.
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (mutation.meta?.silent) return;
            if (mutation.options.onError) return;
            toast.error(getApiError(error));
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60_000,       // 1 minute
            gcTime: 5 * 60_000,      // 5 minutes
            retry: (failCount, error: any) => {
              // Don't retry on 4xx errors
              if (error?.response?.status >= 400 && error?.response?.status < 500) return false;
              return failCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '10px',
            fontSize: '14px',
            background: 'rgb(var(--card))',
            color: 'rgb(var(--card-foreground))',
            border: '1px solid rgb(var(--border))',
            borderLeft: '4px solid rgb(var(--primary))',
            boxShadow: '0 4px 12px -2px rgba(15,23,42,0.14)',
            maxWidth: '380px',
          },
          success: {
            iconTheme: { primary: '#50C5B7', secondary: '#fff' },
            style: { borderLeft: '4px solid rgb(80,197,183)' },
          },
          error: {
            duration: 5000,
            iconTheme: { primary: '#2563EB', secondary: '#fff' },
            style: { borderLeft: '4px solid rgb(37,99,235)' },
          },
        }}
      />
      <PwaRegistration />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
