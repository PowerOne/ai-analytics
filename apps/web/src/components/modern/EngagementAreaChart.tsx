"use client";

import { AreaChart } from "@tremor/react";
import type { EngagementTrendPoint } from "@/lib/modern-dashboard/types";
import { Card } from "@/components/modern/ui/card";

export function EngagementAreaChart({ data }: { data: EngagementTrendPoint[] }) {
  return (
    <Card className="p-5">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Engagement Trend</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Engagement score over time</p>
      </div>
      <AreaChart
        className="h-72"
        data={data}
        index="weekLabel"
        categories={["engagement"]}
        colors={["sky"]}
        yAxisWidth={44}
        valueFormatter={(v) => `${Math.round(v)}%`}
      />
    </Card>
  );
}
