"use client";

import { useEffect } from "react";

import { ErrorState } from "@/app/components/ui/error-state";

export default function PrincipalDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Principal dashboard error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-12">
      <ErrorState
        title="Could not load principal dashboard"
        message={
          error.message ||
          "The school dashboard request failed. Check your session and API configuration."
        }
        onRetry={reset}
        retryLabel="Try again"
      />
    </div>
  );
}
