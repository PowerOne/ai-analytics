"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  ApiError,
  getPrincipalDashboard,
  mapDashboardToHeatmapCells,
  mapDashboardToRankedRiskRows,
} from "@/lib/api";
import type { HeatmapCell, StudentRow } from "@/lib/types";
import { RiskHeatmap } from "@/components/risk/RiskHeatmap";
import { RiskBadge } from "@/components/risk/RiskBadge";
import { EngagementBar } from "@/components/risk/EngagementBar";

export default function AdminRiskPage() {
  const { user } = useAuth();
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [atRisk, setAtRisk] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let c = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const dash = await getPrincipalDashboard(user);
        if (!c) {
          setHeatmap(mapDashboardToHeatmapCells(dash));
          setAtRisk(mapDashboardToRankedRiskRows(dash));
        }
      } catch (e) {
        if (!c) setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [user]);

  if (loading) {
    return <p className="text-slate-500">Loading risk data…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/40 p-4 text-rose-200">
        <p className="font-medium">Could not load risk view</p>
        <p className="mt-1 text-sm opacity-90">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Risk & engagement</h1>
      <p className="mt-1 text-sm text-slate-500">
        Cohort risk from the principal dashboard snapshot (weekly cohort aggregates).
      </p>

      <div className="mt-8">
        {heatmap.length === 0 ? (
          <p className="text-sm text-slate-500">No cohort heatmap data.</p>
        ) : (
          <RiskHeatmap data={heatmap} />
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium text-slate-200">Students by risk score</h2>
        {atRisk.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No students to rank.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {atRisk.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-slate-200">{s.displayName}</td>
                    <td className="px-4 py-3 text-slate-400">{s.gradeLevel ?? "—"}</td>
                    <td className="px-4 py-3">
                      <RiskBadge level={s.riskLevel} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {s.riskScore == null ? "—" : Math.round(s.riskScore)}
                    </td>
                    <td className="px-4 py-3">
                      <EngagementBar value={s.engagementScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
