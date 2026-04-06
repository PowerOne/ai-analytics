"use client";

import { DashboardCard } from "@/components/DashboardCard";
import { Heatmap } from "@/components/Heatmap";
import { InterventionsList, type InterventionListItem } from "@/components/InterventionsList";
import { TrendDelta } from "@/components/TrendDelta";
import { useAuth } from "@/context/auth-context";
import { getTeacherDashboard } from "@/lib/api";
import { useEffect, useState } from "react";

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getTeacherDashboard>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.token || !user.teacherId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getTeacherDashboard(user.schoolId, user.teacherId!, user.token);
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

  if (!user?.teacherId) {
    return (
      <p className="text-slate-400">
        Teacher dashboard is only available for users with a teacher profile. Try Principal Dashboard instead.
      </p>
    );
  }

  if (loading) {
    return <div className="animate-pulse text-slate-400">Loading teacher dashboard…</div>;
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

  const attentionItems: InterventionListItem[] = data.attentionStudents.map((s) => ({
    id: s.studentId,
    title: s.name,
    status: s.interventionsThisWeek > 0 ? "Intervention" : "Watch",
    subtitle: `Δ perf ${s.performanceDelta.toFixed(1)} · Δ att ${s.attendanceDelta.toFixed(2)} · interventions ${s.interventionsThisWeek}`,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Teacher dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Classes, trends, attention, and LMS heatmap for your roster.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Classes" value={data.classes.length} />
        <DashboardCard title="Attention students" value={data.attentionStudents.length} />
        <DashboardCard title="Interventions (week)" value={data.interventionsThisWeek} />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-200">Classes</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.classes.map((c) => (
            <div key={c.classId} className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-4">
              <h3 className="font-medium text-slate-100">{c.name}</h3>
              <div className="mt-3">
                <TrendDelta
                  performanceDelta={c.performanceDelta}
                  attendanceDelta={c.attendanceDelta}
                  engagementDelta={c.engagementDelta}
                  riskDelta={c.riskDelta}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <InterventionsList items={attentionItems} emptyMessage="No students flagged for attention." />
        <Heatmap daily={data.heatmap.daily} weekly={data.heatmap.weekly} />
      </div>

      {data.aiSummary && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-slate-300">AI summary</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{data.aiSummary}</p>
        </div>
      )}
    </div>
  );
}
