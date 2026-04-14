"use client";

import Link from "next/link";

import { BarChart } from "@/app/components/charts/BarChart";
import { LineChart } from "@/app/components/charts/LineChart";
import { PieChart } from "@/app/components/charts/PieChart";
import { Badge } from "@/app/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  EmptyState,
  cardEmbeddedEmptyClassName,
} from "@/app/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";

import type {
  PrincipalCohortRow,
  PrincipalDashboardPayload,
  PrincipalHeatmapCell,
} from "./types";

function formatDelta(n: number, suffix = "%") {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}${suffix}`;
}

function aggregateEventTypes(daily: PrincipalHeatmapCell[]) {
  const map = new Map<string, number>();
  for (const cell of daily) {
    const types = cell.eventTypes ?? {};
    for (const [k, v] of Object.entries(types)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        map.set(k, (map.get(k) ?? 0) + v);
      }
    }
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

function aggregateGradeRisk(cohorts: PrincipalCohortRow[]) {
  const grades = cohorts.filter((c) => c.cohortType === "GRADE");
  const list = grades.length > 0 ? grades : cohorts;
  return list.reduce(
    (acc, c) => ({
      low: acc.low + c.risk.low,
      medium: acc.medium + c.risk.medium,
      high: acc.high + c.risk.high,
    }),
    { low: 0, medium: 0, high: 0 },
  );
}

export function PrincipalDashboardView({ data }: { data: PrincipalDashboardPayload }) {
  const { schoolTrends, cohorts, interventions, heatmap, aiSummary } = data;

  const riskTotals = aggregateGradeRisk(cohorts);
  const riskBars = [
    { band: "Low", count: riskTotals.low },
    { band: "Medium", count: riskTotals.medium },
    { band: "High", count: riskTotals.high },
  ];

  const pieSlices = aggregateEventTypes(heatmap.daily);
  const activityByDay = heatmap.daily.map((d) => ({
    date: d.date,
    events: d.count,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Principal dashboard
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          School snapshot from{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
            GET /api/schools/…/dashboards/principal
          </code>
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href="/students"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Students directory →
          </Link>
          <Link
            href="/classes"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Classes directory →
          </Link>
          <Link
            href="/interventions"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Interventions →
          </Link>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Performance Δ (7d)</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatDelta(schoolTrends.performanceDelta)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Attendance Δ (7d)</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatDelta(schoolTrends.attendanceDelta)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Engagement Δ (7d)</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {formatDelta(schoolTrends.engagementDelta)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High-risk students</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {schoolTrends.highRiskNew}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-zinc-500">
              Risk composite Δ {formatDelta(schoolTrends.riskCompositeDelta)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Interventions (this week)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{interventions.created}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">
            Resolved: {interventions.resolved} · Rate:{" "}
            {(interventions.resolutionRate * 100).toFixed(0)}%
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>Risk Δ (weekly snapshot)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatDelta(schoolTrends.riskDelta)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">
            Week-over-week change in mean risk from school snapshots.
          </CardContent>
          <CardFooter className="justify-end">
            <Link
              href="/interventions"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Open interventions workspace →
            </Link>
          </CardFooter>
        </Card>
      </div>

      {aiSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {aiSummary}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attendance trends</CardTitle>
            <CardDescription>
              Daily LMS participation volume (school heatmap). Official week-over-week attendance
              change is the Attendance Δ (7d) figure in school metrics above —
              the API does not return a day-level attendance time series on this endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activityByDay.length === 0 ? (
              <EmptyState
                className={cardEmbeddedEmptyClassName}
                title="No activity trend yet"
                description="LMS heatmap data will populate this chart when events exist in the reporting window."
              />
            ) : (
              <LineChart
                data={activityByDay}
                xKey="date"
                yKey="events"
                height={300}
                stroke="#059669"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk distribution</CardTitle>
            <CardDescription>
              Students in low / medium / high bands (grade cohorts aggregated when present).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {riskBars.every((b) => b.count === 0) ? (
              <EmptyState
                className={cardEmbeddedEmptyClassName}
                title="No risk distribution yet"
                description="Cohort risk bands appear when student risk counts are available."
              />
            ) : (
              <BarChart data={riskBars} xKey="band" yKey="count" height={280} fill="#dc2626" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Engagement summary</CardTitle>
            <CardDescription>
              LMS event types pooled from the school heatmap window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieSlices.length === 0 ? (
              <EmptyState
                className={cardEmbeddedEmptyClassName}
                title="No engagement breakdown"
                description="LMS event types will appear here once activity is recorded."
              />
            ) : (
              <PieChart data={pieSlices} height={280} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cohort analytics</CardTitle>
          <CardDescription>
            Weekly deltas and risk from each cohort snapshot in the principal payload.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {cohorts.length === 0 ? (
            <EmptyState
              className={cardEmbeddedEmptyClassName}
              title="No cohort rows"
              description="This dashboard will list cohorts when the API returns them."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Perf. Δ</TableHead>
                  <TableHead className="text-right">Attend. Δ</TableHead>
                  <TableHead className="text-right">Eng. Δ</TableHead>
                  <TableHead className="text-right">Risk Δ</TableHead>
                  <TableHead className="text-right">Risk avg</TableHead>
                  <TableHead className="text-right">IV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohorts.map((c) => (
                  <TableRow key={`${c.cohortType}-${c.cohortId}`}>
                    <TableCell className="max-w-[180px] truncate font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.cohortType}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatDelta(c.performanceDelta)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatDelta(c.attendanceDelta)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatDelta(c.engagementDelta)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatDelta(c.riskDelta)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {c.risk.average.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {c.interventions}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-zinc-500">
        Browse{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/students">
          Students
        </Link>
        ,{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/classes">
          Classes
        </Link>
        , or{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/interventions">
          Interventions
        </Link>
        .
      </p>
    </div>
  );
}
