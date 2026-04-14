"use client";

import Link from "next/link";

import { BarChart } from "@/app/components/charts/BarChart";
import { LineChart } from "@/app/components/charts/LineChart";
import { PieChart } from "@/app/components/charts/PieChart";
import { Badge } from "@/app/components/ui/badge";
import { linkButtonClass } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";

import type { Student360HeatmapCell, Student360Payload } from "./types";

function formatDelta(n: number, suffix = " pts") {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}${suffix}`;
}

function aggregateEventTypes(daily: Student360HeatmapCell[]) {
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

function riskTierVariant(tier: string): "success" | "warning" | "outline" | "secondary" {
  const u = tier.toUpperCase();
  if (u.includes("LOW")) return "success";
  if (u.includes("MEDIUM") || u.includes("MODERATE")) return "warning";
  if (u.includes("HIGH")) return "outline";
  return "secondary";
}

function engineCategoryVariant(cat: string): "success" | "warning" | "outline" | "secondary" {
  const c = cat.toLowerCase();
  if (c === "low") return "success";
  if (c === "medium") return "warning";
  if (c === "high") return "outline";
  return "secondary";
}

function interventionLine(item: unknown, index: number): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    for (const k of ["title", "summary", "description", "text", "name"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return `Suggestion ${index + 1}`;
}

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function engagementPercent(raw: number): string {
  if (!Number.isFinite(raw)) return "—";
  const pct = raw <= 1 ? raw * 100 : raw;
  return `${pct.toFixed(0)}%`;
}

export function Student360View({ data }: { data: Student360Payload }) {
  const { identity } = data;
  const attendanceLineData = (data.attendanceTimeline ?? []).map((p) => ({
    date: p.date.slice(5),
    pct: Math.round(p.value * 1000) / 10,
  }));
  const scoreLineData = (data.scoreTimeline ?? []).map((p) => ({
    date: p.date.slice(5),
    score: Math.round(p.value * 10) / 10,
  }));
  const lmsDailyBars = (data.heatmap?.daily ?? []).map((d) => ({
    day: d.date.slice(5),
    events: d.count,
  }));
  const lmsWeeklyBars = (data.heatmap?.weekly ?? []).map((w) => ({
    week: w.date.slice(5),
    events: w.count,
  }));
  const eventMix = aggregateEventTypes(data.heatmap?.daily ?? []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {identity.displayName}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Student 360° ·{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
              GET /api/schools/…/dashboards/students/{data.studentId}
            </code>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {identity.gradeLevel ? (
              <Badge variant="secondary">Grade {identity.gradeLevel}</Badge>
            ) : null}
            {identity.email ? (
              <Badge variant="outline" className="font-normal">
                {identity.email}
              </Badge>
            ) : null}
            <Badge variant={riskTierVariant(data.current.riskTier)}>Risk: {data.current.riskTier}</Badge>
            <Badge variant={engineCategoryVariant(data.riskEngine.category)}>
              Engine: {data.riskEngine.category}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="p-4 pb-2">
              <CardDescription>Risk score</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-zinc-900 dark:text-zinc-50">
                {Math.round(data.current.riskScore)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="p-4 pb-2">
              <CardDescription>Engagement</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-zinc-900 dark:text-zinc-50">
                {engagementPercent(data.current.engagement)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="p-4 pb-2">
              <CardDescription>Attendance</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-zinc-900 dark:text-zinc-50">
                {(data.current.attendance * 100).toFixed(1)}%
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="p-4 pb-2">
              <CardDescription>Performance</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-zinc-900 dark:text-zinc-50">
                {data.current.performance.toFixed(1)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Performance Δ</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatDelta(data.performanceDelta)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Attendance Δ</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatDelta(data.attendanceDelta)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Engagement Δ</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatDelta(data.engagementDelta)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Risk composite Δ</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatDelta(data.riskCompositeDelta)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assessments over time</CardTitle>
            <CardDescription>Daily mean score % · submission rate {(data.submissionRate * 100).toFixed(0)}%</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {scoreLineData.length > 0 ? (
              <LineChart data={scoreLineData} xKey="date" yKey="score" stroke="#4f46e5" height={260} />
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">No assessment timeline yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attendance trend</CardTitle>
            <CardDescription>Daily present-like rate (% of sessions)</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {attendanceLineData.length > 0 ? (
              <LineChart data={attendanceLineData} xKey="date" yKey="pct" stroke="#0ea5e9" height={260} />
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">No attendance timeline yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>LMS activity</CardTitle>
            <CardDescription>Events per day (recent window)</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {lmsDailyBars.some((b) => b.events > 0) ? (
              <BarChart data={lmsDailyBars} xKey="day" yKey="events" fill="#6366f1" height={260} />
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">No LMS events in this range.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Engagement mix</CardTitle>
            <CardDescription>Event types across the heatmap window</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {eventMix.length > 0 ? (
              <PieChart data={eventMix} height={260} />
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">No typed LMS events to chart.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {lmsWeeklyBars.some((w) => w.events > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle>Weekly LMS volume</CardTitle>
            <CardDescription>Bucketed engagement signal</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <BarChart data={lmsWeeklyBars} xKey="week" yKey="events" fill="#8b5cf6" height={240} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Risk engine</CardTitle>
            <CardDescription>Composite {data.riskEngine.compositeRisk.toFixed(1)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
              {(data.riskEngine.reasons?.length ? data.riskEngine.reasons : ["No reasons returned"]).map(
                (r, i) => (
                  <li key={i}>{r}</li>
                ),
              )}
            </ul>
            {data.riskEngineHistory.composite != null ? (
              <p className="text-xs text-zinc-500">
                Snapshot composite: {data.riskEngineHistory.composite.toFixed(1)}
                {data.riskEngineHistory.category ? ` · ${data.riskEngineHistory.category}` : ""}
                {data.riskEngineHistory.stability != null
                  ? ` · stability ${data.riskEngineHistory.stability.toFixed(2)}`
                  : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Interventions</CardTitle>
            <CardDescription>
              {data.interventionCount} recorded in scope · {data.interventions?.length ?? 0} AI suggestions
            </CardDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/interventions/new?studentId=${encodeURIComponent(data.studentId)}${
                  data.classes[0]?.id
                    ? `&classId=${encodeURIComponent(data.classes[0].id)}`
                    : ""
                }`}
                className={linkButtonClass("outline", "sm")}
              >
                Create intervention
              </Link>
              <Link href="/interventions" className={linkButtonClass("ghost", "sm")}>
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {(data.interventions?.length ?? 0) > 0 ? (
              <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {data.interventions!.map((item, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/40"
                  >
                    {interventionLine(item, i)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">No AI intervention suggestions for this student.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {data.aiSummary ? (
        <Card className="border-indigo-200/80 bg-indigo-50/40 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <CardHeader>
            <CardTitle className="text-lg">AI summary</CardTitle>
            <CardDescription>Generated overview</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {data.aiSummary}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
            <CardDescription>Active enrollments</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Term</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.classes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-zinc-500">
                      No class enrollments in your scope.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.classes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.name}
                        {c.sectionCode ? (
                          <span className="ml-1 text-zinc-500">· {c.sectionCode}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {c.subjectName}{" "}
                        <span className="text-zinc-500">({c.subjectCode})</span>
                      </TableCell>
                      <TableCell>{c.termLabel}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Teachers</CardTitle>
            <CardDescription>Primary instructors for enrolled classes</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.teachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-zinc-500">
                      No primary teachers linked.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.teachers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-400">{t.email ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent assessments</CardTitle>
          <CardDescription>Latest scored results</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Score %</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.assessments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-zinc-500">
                    No assessment results in your scope.
                  </TableCell>
                </TableRow>
              ) : (
                data.assessments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a.className ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {a.scorePercent != null ? `${a.scorePercent.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-zinc-600 dark:text-zinc-400">
                      {formatShortDate(a.submittedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
