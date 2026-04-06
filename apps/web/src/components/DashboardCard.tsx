"use client";

import { cn } from "@/lib/cn";

export function DashboardCard({
  title,
  value,
  delta,
  deltaLabel,
  format = "number",
}: {
  title: string;
  value: string | number;
  delta?: number | null;
  deltaLabel?: string;
  format?: "number" | "percent";
}) {
  const positive = delta != null && delta >= 0;
  const negative = delta != null && delta < 0;
  const deltaStr =
    delta == null || Number.isNaN(delta)
      ? "—"
      : `${delta > 0 ? "+" : ""}${format === "percent" ? `${delta.toFixed(1)}%` : delta.toFixed(1)}`;

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">{value}</p>
      {delta != null && (
        <p
          className={cn(
            "mt-2 text-sm font-medium tabular-nums",
            positive && "text-emerald-400",
            negative && "text-rose-400",
            !positive && !negative && "text-slate-400",
          )}
        >
          {deltaStr}
          {deltaLabel ? <span className="ml-1 font-normal text-slate-500">{deltaLabel}</span> : null}
        </p>
      )}
    </div>
  );
}
