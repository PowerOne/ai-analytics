"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ApiError, subscribeApiErrors } from "@/app/lib/api";

function ApiErrorToast() {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    return subscribeApiErrors((err) => {
      if (err.status === 401) return;
      setToast({ id: Date.now(), message: err.message || "Request failed" });
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[100] w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-800 shadow-lg dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-200"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 leading-snug">{toast.message}</p>
        <button
          type="button"
          className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
          aria-label="Dismiss"
          onClick={() => setToast(null)}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.status === 401) return false;
            if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
              return false;
            }
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ApiErrorToast />
    </QueryClientProvider>
  );
}
