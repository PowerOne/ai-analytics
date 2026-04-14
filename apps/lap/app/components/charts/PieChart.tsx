"use client";

import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartShell } from "@/app/components/charts/chart-shell";
import { cn } from "@/app/lib/utils";

export type PieChartSlice = {
  name: string;
  value: number;
};

const DEFAULT_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

export type PieChartProps = {
  data: PieChartSlice[];
  className?: string;
  height?: number;
  colors?: string[];
  /** Name of the value field; defaults to `value` */
  valueKey?: string;
  nameKey?: string;
};

export function PieChart({
  data,
  className,
  height = 280,
  colors = DEFAULT_COLORS,
  valueKey = "value",
  nameKey = "name",
}: PieChartProps) {
  return (
    <ChartShell height={height} className={cn(className)}>
      <ResponsiveContainer width="100%" height="100%" debounce={50}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid #e4e4e7",
              fontSize: "0.875rem",
            }}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
