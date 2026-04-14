"use client";

import { useEffect } from "react";

import { ErrorState } from "@/app/components/ui/error-state";

export default function Class360Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Class overview error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-12">
      <ErrorState
        title="Class overview unavailable"
        message={error.message || "This page failed to load."}
        onRetry={reset}
        retryLabel="Try again"
      />
    </div>
  );
}
