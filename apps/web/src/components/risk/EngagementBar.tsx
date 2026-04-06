"use client";

import { cn } from "@/lib/cn";

export function EngagementBar({ value }: { value: number | null }) {
  const v = value == null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            v >= 70 ? "bg-emerald-500" : v >= 45 ? "bg-amber-500" : "bg-red-400",
          )}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="text-xs text-slate-400">{value == null ? "—" : `${Math.round(v)}`}</span>
    </div>
  );
}
