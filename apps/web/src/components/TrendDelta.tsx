"use client";

import { cn } from "@/lib/cn";

function Row({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  const up = value > 0;
  const down = value < 0;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800 py-2 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          up && "text-emerald-400",
          down && "text-rose-400",
          value === 0 && "text-slate-300",
        )}
      >
        {value > 0 ? "+" : ""}
        {value.toFixed(1)}
        {suffix}
      </span>
    </div>
  );
}

export function TrendDelta({
  performanceDelta,
  attendanceDelta,
  engagementDelta,
  riskDelta,
  attendanceAsPercent = false,
}: {
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  /** When true, attendance deltas are shown as percentage points (×100). */
  attendanceAsPercent?: boolean;
}) {
  const att = attendanceAsPercent ? attendanceDelta * 100 : attendanceDelta;
  const attSuffix = attendanceAsPercent ? " pp" : "";

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Week-over-week deltas</h3>
      <Row label="Performance" value={performanceDelta} suffix=" pts" />
      <Row label="Attendance" value={att} suffix={attSuffix} />
      <Row label="Engagement" value={engagementDelta} />
      <Row label="Risk" value={riskDelta} />
    </div>
  );
}
