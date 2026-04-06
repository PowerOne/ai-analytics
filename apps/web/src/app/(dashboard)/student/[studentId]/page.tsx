"use client";

import { DashboardCard } from "@/components/DashboardCard";
import { Heatmap } from "@/components/Heatmap";
import { InterventionsList } from "@/components/InterventionsList";
import { TrendDelta } from "@/components/TrendDelta";
import { useAuth } from "@/context/auth-context";
import { getStudent360 } from "@/lib/api";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function Student360Page() {
  const params = useParams();
  const studentId = String(params.studentId ?? "");
  const { user } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getStudent360>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.token || !studentId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getStudent360(user.schoolId, studentId, user.token);
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
  }, [user, studentId]);

  if (loading) {
    return <div className="animate-pulse text-slate-400">Loading student 360…</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/40 p-4 text-rose-200">
        <p className="font-medium">Could not load student</p>
        <p className="mt-1 text-sm opacity-90">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const cur = data.current;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-sky-400">Student 360</p>
        <h1 className="text-2xl font-bold text-slate-100">Student {data.studentId.slice(0, 8)}…</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Performance (current)" value={cur.performance.toFixed(1)} />
        <DashboardCard title="Attendance (current)" value={`${(cur.attendance * 100).toFixed(1)}%`} />
        <DashboardCard title="Engagement" value={cur.engagement.toFixed(2)} />
        <DashboardCard title="Risk score" value={cur.riskScore.toFixed(0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendDelta
          performanceDelta={data.performanceDelta}
          attendanceDelta={data.attendanceDelta}
          engagementDelta={data.engagementDelta}
          riskDelta={data.riskDelta}
        />
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
          <p className="text-xs uppercase text-slate-500">Risk tier (current)</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{cur.riskTier}</p>
          <p className="mt-2 text-xs text-slate-500">
            Distribution charts apply to cohorts; this view shows the live composite risk score only.
          </p>
        </div>
      </div>

      <InterventionsList
        title="Interventions"
        items={
          data.interventions > 0
            ? [
                {
                  id: "count",
                  title: `Total interventions involving this student`,
                  status: `${data.interventions} recorded`,
                  subtitle: "Count from API (all statuses)",
                },
              ]
            : []
        }
        emptyMessage="No interventions recorded for this student."
      />

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
