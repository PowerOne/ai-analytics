"use client";

import { useEffect } from "react";

import { ErrorState } from "@/app/components/ui/error-state";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <ErrorState
          title="Something went wrong"
          message={
            error.message ||
            "An unexpected error occurred. You can try again or return to the previous page."
          }
          onRetry={reset}
          retryLabel="Try again"
        />
      </div>
    </div>
  );
}
