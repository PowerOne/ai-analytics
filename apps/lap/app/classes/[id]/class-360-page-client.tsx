"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { DashboardPageLoading } from "@/app/components/ui/dashboard-page-loading";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ErrorState } from "@/app/components/ui/error-state";
import { ApiError, api } from "@/app/lib/api";
import type { AuthUser } from "@/app/lib/auth-types";
import { qk } from "@/app/lib/query-keys";

import { Class360View } from "./class-360-view";
import type { Class360Payload } from "./types";

function Breadcrumb() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
      <Link
        href="/classes"
        className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        Classes
      </Link>
      <span aria-hidden>/</span>
      <span className="text-zinc-500">Section</span>
    </div>
  );
}

export function Class360PageClient({
  user,
  classId,
}: {
  user: AuthUser;
  classId: string;
}) {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: qk.class360(user.schoolId, classId),
    queryFn: () =>
      api.get<Class360Payload>(`schools/${user.schoolId}/dashboards/classes/${classId}`),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        return false;
      }
      return failureCount < 2;
    },
  });

  if (isPending) {
    return <DashboardPageLoading />;
  }

  if (isError && error instanceof ApiError && (error.status === 404 || error.status === 403)) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Breadcrumb />
        <EmptyState
          title="Class not found"
          description="This section may have been removed or you may not have access."
          action={{ label: "Back to classes", href: "/classes" }}
        />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Breadcrumb />
        <div className="mx-auto max-w-lg py-4">
          <ErrorState
            title="Could not load class overview"
            message={
              error instanceof Error
                ? error.message
                : "The request failed. Check your session and try again."
            }
            onRetry={() => void refetch()}
            retryLabel={isFetching ? "Retrying…" : "Try again"}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Breadcrumb />
      <Class360View data={data} />
    </div>
  );
}
