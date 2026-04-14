"use client";

import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartShell } from "@/app/components/charts/chart-shell";
import { cn } from "@/app/lib/utils";

export type LineChartPoint = Record<string, string | number | undefined>;

export type LineChartProps = {
  data: LineChartPoint[];
  xKey: string;
  yKey: string;
  className?: string;
  /** Pixel height of the chart area */
  height?: number;
  stroke?: string;
  showGrid?: boolean;
};

export function LineChart({
  data,
  xKey,
  yKey,
  className,
  height = 280,
  stroke = "#4f46e5",
  showGrid = true,
}: LineChartProps) {
  return (
    <ChartShell height={height} className={cn(className)}>
      <ResponsiveContainer width="100%" height="100%" debounce={50}>
        <RechartsLineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {showGrid ? (
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
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
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid #e4e4e7",
              fontSize: "0.875rem",
            }}
          />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
