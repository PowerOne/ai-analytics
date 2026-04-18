"use client";

import { CohortSummaryTable } from "@/components/CohortSummaryTable";
import { DashboardCard } from "@/components/DashboardCard";
import { Heatmap } from "@/components/Heatmap";
import { PrincipalAttendanceEngagementHeatmap } from "@/components/principal/PrincipalAttendanceEngagementHeatmap";
import { TrendDelta } from "@/components/TrendDelta";
import { useAuth } from "@/context/auth-context";
import { getPrincipalDashboard } from "@/lib/api";
import { useEffect, useState } from "react";

export default function PrincipalDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getPrincipalDashboard>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.token) return;
    if (user.role !== "ADMIN" && user.role !== "PRINCIPAL") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getPrincipalDashboard(user);
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (user?.role !== "ADMIN" && user?.role !== "PRINCIPAL") {
    return <p className="text-slate-400">Principal dashboard requires Admin or Principal role.</p>;
  }

  if (loading) {
    return <div className="animate-pulse text-slate-400">Loading principal dashboard…</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/40 p-4 text-rose-200">
        <p className="font-medium">Could not load dashboard</p>
        <p className="mt-1 text-sm opacity-90">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const t = data.schoolTrends;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Principal dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">School-wide trends, cohorts, and interventions.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="High risk (snapshot)" value={t.highRiskNew} />
        <DashboardCard title="Interventions created" value={data.interventions.created} />
        <DashboardCard title="Interventions resolved" value={data.interventions.resolved} />
        <DashboardCard
          title="Resolution rate"
          value={`${Math.round(data.interventions.resolutionRate * 100)}%`}
        />
      </div>

      <TrendDelta
        performanceDelta={t.performanceDelta}
        attendanceDelta={t.attendanceDelta}
        engagementDelta={t.engagementDelta}
        riskDelta={t.riskDelta}
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-200">Cohort summaries</h2>
        <CohortSummaryTable cohorts={data.cohorts} />
      </section>

      <Heatmap daily={data.heatmap.daily} weekly={data.heatmap.weekly} />

      {data.principalAttendanceEngagementHeatmap != null ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-200">Attendance &amp; Engagement</h2>
          <PrincipalAttendanceEngagementHeatmap
            principalAttendanceEngagementHeatmap={data.principalAttendanceEngagementHeatmap}
          />
        </section>
      ) : null}

      {data.aiSummary && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-slate-300">AI summary</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{data.aiSummary}</p>
        </div>
      )}
    </div>
  );
}
