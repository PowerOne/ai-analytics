"use client";

import { useEffect } from "react";

import { ErrorState } from "@/app/components/ui/error-state";

export default function InterventionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Interventions error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-12">
      <ErrorState
        title="Interventions unavailable"
        message={error.message || "This section failed to load."}
        onRetry={reset}
        retryLabel="Try again"
      />
    </div>
  );
}
