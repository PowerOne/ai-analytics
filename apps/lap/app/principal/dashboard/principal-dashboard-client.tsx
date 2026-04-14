"use client";

import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/app/components/ui/error-state";
import { DashboardPageLoading } from "@/app/components/ui/dashboard-page-loading";
import { api } from "@/app/lib/api";
import type { AuthUser } from "@/app/lib/auth-types";
import { qk } from "@/app/lib/query-keys";

import { PrincipalDashboardView } from "./principal-dashboard-view";
import type { PrincipalDashboardPayload } from "./types";

export function PrincipalDashboardClient({ user }: { user: AuthUser }) {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: qk.principalDashboard(user.schoolId),
    queryFn: () =>
      api.get<PrincipalDashboardPayload>(
        `schools/${user.schoolId}/dashboards/principal`,
      ),
  });

  if (isPending) {
    return <DashboardPageLoading />;
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <ErrorState
          title="Could not load principal dashboard"
          message={
            error instanceof Error
              ? error.message
              : "The school dashboard request failed. Check your session and API configuration."
          }
          onRetry={() => void refetch()}
          retryLabel={isFetching ? "Retrying…" : "Try again"}
        />
      </div>
    );
  }

  return <PrincipalDashboardView data={data} />;
}
