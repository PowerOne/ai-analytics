"use client";

import { useMemo, useState } from "react";
import type { LmsHeatmapCell } from "@/lib/dashboard-types";
import { cn } from "@/lib/cn";

function maxCount(cells: LmsHeatmapCell[]): number {
  return cells.reduce((m, c) => Math.max(m, c.count), 0) || 1;
}

function HeatGrid({ cells, title }: { cells: LmsHeatmapCell[]; title: string }) {
  const max = maxCount(cells);
  const sorted = useMemo(() => [...cells].sort((a, b) => a.date.localeCompare(b.date)), [cells]);

  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="flex flex-wrap gap-1">
        {sorted.map((c) => {
          const intensity = c.count / max;
          return (
            <div
              key={c.date}
              title={`${c.date}: ${c.count} events`}
              className={cn(
                "flex h-8 min-w-[2.25rem] items-center justify-center rounded border border-slate-800 text-[10px] font-medium text-slate-200",
              )}
              style={{
                backgroundColor: `rgba(56, 189, 248, ${0.15 + intensity * 0.75})`,
              }}
            >
              {c.count}
            </div>
          );
        })}
      </div>
      {sorted.length === 0 && <p className="text-sm text-slate-500">No LMS activity in range.</p>}
    </div>
  );
}

export function Heatmap({
  daily,
  weekly,
}: {
  daily: LmsHeatmapCell[];
  weekly: LmsHeatmapCell[];
}) {
  const [tab, setTab] = useState<"daily" | "weekly">("daily");

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">LMS engagement</h3>
        <div className="flex rounded-lg border border-slate-700 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab("daily")}
            className={cn(
              "rounded-md px-3 py-1",
              tab === "daily" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-200",
            )}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setTab("weekly")}
            className={cn(
              "rounded-md px-3 py-1",
              tab === "weekly" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-200",
            )}
          >
            Weekly
          </button>
        </div>
      </div>
      {tab === "daily" ? <HeatGrid cells={daily} title="Daily buckets" /> : <HeatGrid cells={weekly} title="Weekly buckets" />}
    </div>
  );
}
