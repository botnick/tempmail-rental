'use client';

import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { httpBatchLink, TRPCClientError } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import superjson from 'superjson';
import type { AppRouter } from '@/server/trpc/root';

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  return process.env.APP_URL ?? 'http://localhost:3000';
}

/**
 * Global handler: redirect to login when session expires (UNAUTHORIZED).
 * Prevents duplicate redirects using a simple flag.
 */
let isRedirecting = false;
function handleAuthError(error: unknown) {
  if (isRedirecting) return;
  if (
    error instanceof TRPCClientError &&
    error.data?.code === 'UNAUTHORIZED' &&
    typeof window !== 'undefined'
  ) {
    isRedirecting = true;
    window.location.href = '/login';
  }
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            retry: (failureCount, error) => {
              // Don't retry on auth errors — redirect instead
              if (error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED') {
                return false;
              }
              return failureCount < 1;
            },
          },
          mutations: {
            onError: handleAuthError,
          },
        },
        queryCache: new QueryCache({
          onError: handleAuthError,
        }),
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers() {
            return {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

