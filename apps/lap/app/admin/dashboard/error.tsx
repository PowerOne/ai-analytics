"use client";

import { useEffect } from "react";

import { ErrorState } from "@/app/components/ui/error-state";

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin dashboard error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-12">
      <ErrorState
        title="Could not load admin dashboard"
        message={
          error.message ||
          "The dashboard request failed. Check your session and API configuration."
        }
        onRetry={reset}
        retryLabel="Try again"
      />
    </div>
  );
}
