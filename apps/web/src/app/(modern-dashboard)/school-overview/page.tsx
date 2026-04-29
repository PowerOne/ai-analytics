"use client";

import { useAuth } from "@/context/auth-context";
import { useSchoolOverviewData } from "@/lib/modern-dashboard/api";
import { KPIGrid } from "@/components/modern/KPIGrid";
import { RiskTrendChart } from "@/components/modern/RiskTrendChart";
import { RiskDistributionChart } from "@/components/modern/RiskDistributionChart";
import { AttendanceHeatmap } from "@/components/modern/AttendanceHeatmap";
import { EngagementAreaChart } from "@/components/modern/EngagementAreaChart";
import { AtRiskTable } from "@/components/modern/AtRiskTable";
import { CohortSummaryTable } from "@/components/modern/CohortSummaryTable";
import { Card } from "@/components/modern/ui/card";
import { Skeleton } from "@/components/modern/ui/skeleton";

function ErrorState({ message }: { message: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Failed to load dashboard</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Uses existing endpoints under <code>/dashboards/school/:id</code> with your existing auth token.
      </p>
    </Card>
  );
}

export default function SchoolOverviewPage() {
  const { user } = useAuth();
  const { loading, error, data } = useSchoolOverviewData(user);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Skeleton className="h-[360px]" />
          <Skeleton className="h-[360px]" />
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Skeleton className="h-[360px]" />
          <Skeleton className="h-[360px]" />
        </div>
        <Skeleton className="h-[420px]" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  if (error) return <ErrorState message={`${error.status ? `${error.status}: ` : ""}${error.message}`} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <KPIGrid kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RiskTrendChart data={data.riskTrend} />
        <RiskDistributionChart data={data.riskDistribution} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AttendanceHeatmap data={data.attendanceHeatmap} />
        <EngagementAreaChart data={data.engagementTrend} />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AtRiskTable rows={data.topAtRiskStudents} />
        <CohortSummaryTable rows={data.cohortSummary} />
      </div>
    </div>
  );
}
