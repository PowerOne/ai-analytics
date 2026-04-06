"use client";

import { Heatmap } from "@/components/Heatmap";
import { RiskDistribution } from "@/components/RiskDistribution";
import { TrendDelta } from "@/components/TrendDelta";
import { useAuth } from "@/context/auth-context";
import { getCohortDashboard } from "@/lib/api";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function CohortGradeDashboardPage() {
  const params = useParams();
  const gradeId = decodeURIComponent(String(params.gradeId ?? ""));
  const { user } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getCohortDashboard>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.token || !gradeId) return;
    if (user.role !== "ADMIN" && user.role !== "PRINCIPAL") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getCohortDashboard(user.schoolId, "grade", gradeId, user.token);
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
  }, [user, gradeId]);

  if (user?.role !== "ADMIN" && user?.role !== "PRINCIPAL") {
    return <p className="text-slate-400">Cohort dashboards require Admin or Principal role.</p>;
  }

  if (loading) {
    return <div className="animate-pulse text-slate-400">Loading cohort…</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/40 p-4 text-rose-200">
        <p className="font-medium">Could not load cohort</p>
        <p className="mt-1 text-sm opacity-90">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-sky-400">Grade cohort</p>
        <h1 className="text-2xl font-bold text-slate-100">{data.name}</h1>
        <p className="mt-1 text-sm text-slate-400">Key: {data.cohortId}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TrendDelta
          performanceDelta={data.performanceDelta}
          attendanceDelta={data.attendanceDelta}
          engagementDelta={data.engagementDelta}
          riskDelta={data.riskDelta}
        />
        <RiskDistribution
          low={data.risk.low}
          medium={data.risk.medium}
          high={data.risk.high}
          average={data.risk.average}
        />
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
        <p className="text-sm text-slate-400">
          Interventions (cohort):{" "}
          <span className="font-mono text-lg text-slate-100">{data.interventions}</span>
        </p>
      </div>

      <Heatmap daily={data.heatmap.daily} weekly={data.heatmap.weekly} />

      {data.aiSummary && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-slate-300">AI summary</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{data.aiSummary}</p>
        </div>
      )}
    </div>
  );
}
