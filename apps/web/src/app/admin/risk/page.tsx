"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { getSchoolHeatmap, getTopAtRisk } from "@/lib/api";
import type { HeatmapCell, StudentRow } from "@/lib/types";
import { RiskHeatmap } from "@/components/risk/RiskHeatmap";
import { RiskBadge } from "@/components/risk/RiskBadge";
import { EngagementBar } from "@/components/risk/EngagementBar";

export default function AdminRiskPage() {
  const { user } = useAuth();
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [atRisk, setAtRisk] = useState<StudentRow[]>([]);

  useEffect(() => {
    if (!user) return;
    let c = false;
    (async () => {
      const [h, a] = await Promise.all([getSchoolHeatmap(user), getTopAtRisk(user)]);
      if (!c) {
        setHeatmap(h);
        setAtRisk(a);
      }
    })();
    return () => {
      c = true;
    };
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Risk & engagement</h1>
      <p className="mt-1 text-sm text-slate-500">
        Heatmap uses average risk by grade/class. Wire{" "}
        <code className="text-sky-400">GET /analytics/school/heatmap</code> when ready.
      </p>

      <div className="mt-8">
        <RiskHeatmap data={heatmap} />
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium text-slate-200">Top at-risk students</h2>
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
      </div>
    </div>
  );
}
