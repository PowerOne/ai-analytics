"use client";

import type { PrincipalCohortRow } from "@/lib/dashboard-types";
import { cn } from "@/lib/cn";

function DeltaCell({ v }: { v: number }) {
  const up = v > 0;
  const down = v < 0;
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        up && "text-emerald-400",
        down && "text-rose-400",
        v === 0 && "text-slate-400",
      )}
    >
      {v > 0 ? "+" : ""}
      {v.toFixed(1)}
    </span>
  );
}

export function CohortSummaryTable({ cohorts }: { cohorts: PrincipalCohortRow[] }) {
  if (!cohorts.length) {
    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-6 text-center text-sm text-slate-500">
        No cohort snapshot rows yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Perf Δ</th>
            <th className="px-4 py-3">Att Δ</th>
            <th className="px-4 py-3">Eng Δ</th>
            <th className="px-4 py-3">Risk Δ</th>
            <th className="px-4 py-3">Interventions</th>
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={`${c.cohortType}-${c.cohortId}`} className="border-b border-slate-800/80 last:border-0">
              <td className="px-4 py-2.5 text-slate-400">{c.cohortType}</td>
              <td className="px-4 py-2.5 font-medium text-slate-200">{c.name}</td>
              <td className="px-4 py-2.5">
                <DeltaCell v={c.performanceDelta} />
              </td>
              <td className="px-4 py-2.5">
                <DeltaCell v={c.attendanceDelta} />
              </td>
              <td className="px-4 py-2.5">
                <DeltaCell v={c.engagementDelta} />
              </td>
              <td className="px-4 py-2.5">
                <DeltaCell v={c.riskDelta} />
              </td>
              <td className="px-4 py-2.5 text-slate-300">{c.interventions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
