"use client";

import { BarChart } from "@tremor/react";
import type { RiskDistributionRow } from "@/lib/modern-dashboard/types";
import { Card } from "@/components/modern/ui/card";

export function RiskDistributionChart({ data }: { data: RiskDistributionRow[] }) {
  const chart = data.map((d) => ({ band: d.band, Students: d.count }));
  return (
    <Card className="p-5">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Risk Distribution</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Students by risk band</p>
      </div>
      <BarChart
        className="h-72"
        data={chart}
        index="band"
        categories={["Students"]}
        colors={["indigo"]}
        yAxisWidth={48}
        valueFormatter={(v) => Intl.NumberFormat().format(v)}
      />
    </Card>
  );
}
