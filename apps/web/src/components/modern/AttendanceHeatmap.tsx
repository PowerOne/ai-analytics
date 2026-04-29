"use client";

import type { AttendanceHeatmapCell } from "@/lib/modern-dashboard/types";
import { Card } from "@/components/modern/ui/card";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function AttendanceHeatmap({ data }: { data: AttendanceHeatmapCell[] }) {
  const hours = Array.from(new Set(data.map((d) => d.hour))).sort();
  const byKey = new Map(data.map((d) => [`${d.day}:${d.hour}`, clamp(d.value)]));

  return (
    <Card className="p-5">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Attendance Heatmap</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Relative intensity by day/hour</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid" style={{ gridTemplateColumns: `80px repeat(${hours.length}, minmax(20px, 1fr))` }}>
            <div />
            {hours.map((h) => (
              <div key={h} className="pb-2 text-center text-xs text-slate-500 dark:text-slate-400">
                {h}
              </div>
            ))}

            {DAYS.map((day) => (
              <div key={day} className="contents">
                <div className="pr-3 text-xs font-medium text-slate-600 dark:text-slate-300">{day}</div>
                {hours.map((h) => {
                  const v = byKey.get(`${day}:${h}`) ?? 0;
                  const bg = v > 0 ? `rgba(14, 165, 233, ${0.08 + (v / 100) * 0.6})` : "transparent";
                  return (
                    <div
                      key={`${day}:${h}`}
                      className="h-7 rounded-md border border-slate-200 dark:border-slate-800"
                      style={{ background: bg }}
                      title={`${day} ${h}:00 — ${Math.round(v)}%`}
                    />
                  );
                })}
                <div className="h-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
