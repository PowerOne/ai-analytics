"use client";

import type { HeatmapCell } from "@/lib/types";
import { cn } from "@/lib/cn";

function cellColor(avgRisk: number) {
  if (avgRisk >= 65) return "from-red-600/40 to-red-900/30 border-red-500/30";
  if (avgRisk >= 45) return "from-amber-600/30 to-amber-900/20 border-amber-500/30";
  return "from-emerald-600/30 to-emerald-900/20 border-emerald-500/30";
}

export function RiskHeatmap({ data }: { data: HeatmapCell[] }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-300">Risk heatmap by grade / class</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((c) => (
          <div
            key={`${c.grade}-${c.classId}`}
            className={cn(
              "rounded-lg border bg-gradient-to-br p-4 transition hover:ring-1 hover:ring-sky-500/40",
              cellColor(c.avgRisk),
            )}
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">Grade {c.grade}</div>
            <div className="mt-1 font-medium text-slate-200">{c.classLabel}</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-slate-100">
                {Math.round(c.avgRisk)}
              </span>
              <span className="text-xs text-slate-500">avg risk</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">{c.studentCount} students</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-800 pt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-500/60" /> Lower risk
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-amber-500/60" /> Medium
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-red-500/70" /> Higher risk
        </span>
      </div>
    </div>
  );
}
