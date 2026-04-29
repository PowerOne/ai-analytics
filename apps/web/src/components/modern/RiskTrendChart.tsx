"use client";

import { LineChart } from "@tremor/react";
import type { RiskTrendPoint } from "@/lib/modern-dashboard/types";
import { Card } from "@/components/modern/ui/card";

export function RiskTrendChart({ data }: { data: RiskTrendPoint[] }) {
  return (
    <Card className="p-5">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Risk Trend (last 6 weeks)</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Average risk index over time</p>
      </div>
      <LineChart
        className="h-72"
        data={data}
        index="weekLabel"
        categories={["avgRisk"]}
        colors={["rose"]}
        yAxisWidth={44}
        valueFormatter={(v) => `${Math.round(v)}%`}
      />
    </Card>
  );
}
