"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartShell } from "@/app/components/charts/chart-shell";
import { cn } from "@/app/lib/utils";

export type BarChartPoint = Record<string, string | number | undefined>;

export type BarChartProps = {
  data: BarChartPoint[];
  xKey: string;
  yKey: string;
  className?: string;
  height?: number;
  fill?: string;
  showGrid?: boolean;
};

export function BarChart({
  data,
  xKey,
  yKey,
  className,
  height = 280,
  fill = "#6366f1",
  showGrid = true,
}: BarChartProps) {
  return (
    <ChartShell height={height} className={cn(className)}>
      <ResponsiveContainer width="100%" height="100%" debounce={50}>
        <RechartsBarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {showGrid ? (
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" vertical={false} />
          ) : null}
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-zinc-500"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-zinc-500"
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid #e4e4e7",
              fontSize: "0.875rem",
            }}
          />
          <Bar dataKey={yKey} fill={fill} radius={[6, 6, 0, 0]} maxBarSize={48} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
