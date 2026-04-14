"use client";

import Link from "next/link";

import { BarChart } from "@/app/components/charts/BarChart";
import { LineChart } from "@/app/components/charts/LineChart";
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

import type { Class360Payload } from "./types";

function formatDelta(n: number, suffix = " pts") {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}${suffix}`;
}

function riskBadgeVariant(level: string): "success" | "warning" | "outline" | "secondary" {
  const u = level.toUpperCase();
  if (u.includes("LOW")) return "success";
  if (u.includes("MEDIUM")) return "warning";
  if (u.includes("HIGH")) return "outline";
  return "secondary";
}

function engagementLabel(raw: number): string {
  if (!Number.isFinite(raw)) return "—";
  const pct = raw <= 1 ? raw * 100 : raw;
  return `${pct.toFixed(0)}%`;
}

export function Class360View({ data }: { data: Class360Payload }) {
  const { classInfo, teacher, subject, term, riskSummary } = data;
  const scoreLineData = (data.scoreTrend ?? []).map((p) => ({
    date: p.date.slice(5),
    score: Math.round(p.value * 10) / 10,
  }));
  const riskDistBars = [
    { band: "Low", count: riskSummary.studentsLow },
    { band: "Medium", count: riskSummary.studentsMedium },
    { band: "High", count: riskSummary.studentsHigh },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {classInfo.name}
            {classInfo.sectionCode ? (
              <span className="ml-2 text-lg font-normal text-zinc-500">· {classInfo.sectionCode}</span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Class 360° ·{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
              GET /api/schools/…/dashboards/classes/{classInfo.id}
            </code>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              {subject.name}{" "}
              <span className="font-normal text-zinc-500">({subject.code})</span>
            </Badge>
            <Badge variant="outline">{term.label}</Badge>
            {classInfo.room ? <Badge variant="outline">Room {classInfo.room}</Badge> : null}
            <Badge variant="outline">{data.studentCount} students</Badge>
            <Badge variant={riskBadgeVariant(riskSummary.liveLevel)}>
              Live risk: {riskSummary.liveLevel}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/interventions/new?classId=${encodeURIComponent(classInfo.id)}`}
              className={linkButtonClass("outline", "sm")}
            >
              Create intervention for class
            </Link>
            <Link href="/interventions" className={linkButtonClass("ghost", "sm")}>
              All interventions
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="p-4 pb-2">
              <CardDescription>Avg score</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{data.averageScore.toFixed(1)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="p-4 pb-2">
              <CardDescription>Attendance</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {(data.attendanceSummary.currentRate * 100).toFixed(1)}%
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="p-4 pb-2">
              <CardDescription>Engagement</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {engagementLabel(data.engagementSummary.currentScore)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Class info</CardTitle>
            <CardDescription>Section metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800">
              <span className="text-zinc-500">Name</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{classInfo.name}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800">
              <span className="text-zinc-500">Section</span>
              <span className="text-zinc-900 dark:text-zinc-100">{classInfo.sectionCode ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <span className="text-zinc-500">Room</span>
              <span className="text-zinc-900 dark:text-zinc-100">{classInfo.room ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Teacher</CardTitle>
            <CardDescription>Primary instructor</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {teacher ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{teacher.name}</p>
                <p className="text-zinc-600 dark:text-zinc-400">{teacher.email ?? "No email on file"}</p>
              </div>
            ) : (
              <p className="text-zinc-500">No primary teacher assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subject</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{subject.name}</p>
            <p className="text-zinc-500">
              Code <span className="font-mono text-zinc-700 dark:text-zinc-300">{subject.code}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Term</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{term.label}</p>
            <p className="text-zinc-500">
              {term.startsOn} → {term.endsOn}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Risk summary</CardTitle>
            <CardDescription>Live model, weekly snapshots, and engine distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
                <p className="text-xs text-zinc-500">Overall</p>
                <p className="text-xl font-semibold tabular-nums">{riskSummary.liveOverall.toFixed(0)}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
                <p className="text-xs text-zinc-500">Performance</p>
                <p className="text-xl font-semibold tabular-nums">
                  {riskSummary.livePerformanceRisk.toFixed(0)}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
                <p className="text-xs text-zinc-500">Attendance</p>
                <p className="text-xl font-semibold tabular-nums">
                  {riskSummary.liveAttendanceRisk.toFixed(0)}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
                <p className="text-xs text-zinc-500">Engagement</p>
                <p className="text-xl font-semibold tabular-nums">
                  {riskSummary.liveEngagementRisk.toFixed(0)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-400">
              <span>Δ perf {formatDelta(riskSummary.deltas.performance)}</span>
              <span>Δ attend {formatDelta(riskSummary.deltas.attendance)}</span>
              <span>Δ engage {formatDelta(riskSummary.deltas.engagement)}</span>
              <span>Δ risk {formatDelta(riskSummary.deltas.risk)}</span>
              <span>Δ composite {formatDelta(riskSummary.deltas.riskComposite)}</span>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Engine mean · {riskSummary.averageEngineRisk.toFixed(0)} (by student tier)
              </p>
              {riskDistBars.some((b) => b.count > 0) ? (
                <BarChart data={riskDistBars} xKey="band" yKey="count" fill="#6366f1" height={200} />
              ) : (
                <p className="text-sm text-zinc-500">No enrolled students for engine distribution.</p>
              )}
            </div>
            {riskSummary.snapshotThisWeek ? (
              <p className="text-xs text-zinc-500">
                Snapshot week {riskSummary.snapshotThisWeek.weekStartDate.slice(0, 10)} · risk score{" "}
                {riskSummary.snapshotThisWeek.riskScore ?? "—"} · composite{" "}
                {riskSummary.snapshotThisWeek.riskComposite ?? "—"}{" "}
                {riskSummary.snapshotThisWeek.riskCategory
                  ? `· ${riskSummary.snapshotThisWeek.riskCategory}`
                  : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Score trend</CardTitle>
            <CardDescription>
              Class mean % · submissions {(data.submissionRate * 100).toFixed(0)}%
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {scoreLineData.length > 0 ? (
              <LineChart data={scoreLineData} xKey="date" yKey="score" stroke="#4f46e5" height={280} />
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">No score trend data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance summary</CardTitle>
            <CardDescription>Analytics rate and weekly snapshots</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Current rate</span>
              <span className="font-semibold tabular-nums">
                {(data.attendanceSummary.currentRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Snapshot Δ (week)</span>
              <span className="tabular-nums">{formatDelta(data.attendanceSummary.delta * 100, " pp")}</span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>This week snapshot</span>
              <span className="tabular-nums">
                {data.attendanceSummary.snapshotThisWeek != null
                  ? `${(data.attendanceSummary.snapshotThisWeek * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Last week snapshot</span>
              <span className="tabular-nums">
                {data.attendanceSummary.snapshotLastWeek != null
                  ? `${(data.attendanceSummary.snapshotLastWeek * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Engagement summary</CardTitle>
            <CardDescription>LMS signal and weekly snapshots</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Current score</span>
              <span className="font-semibold tabular-nums">
                {engagementLabel(data.engagementSummary.currentScore)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Snapshot Δ (week)</span>
              <span className="tabular-nums">{formatDelta(data.engagementSummary.delta)}</span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>This week snapshot</span>
              <span className="tabular-nums">
                {data.engagementSummary.snapshotThisWeek != null
                  ? data.engagementSummary.snapshotThisWeek.toFixed(1)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Last week snapshot</span>
              <span className="tabular-nums">
                {data.engagementSummary.snapshotLastWeek != null
                  ? data.engagementSummary.snapshotLastWeek.toFixed(1)
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>Active enrollments · open a learner profile</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-zinc-500">
                    No active enrollments.
                  </TableCell>
                </TableRow>
              ) : (
                data.students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/students/${s.id}`}
                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {s.displayName}
                      </Link>
                    </TableCell>
                    <TableCell>{s.gradeLevel ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.riskScore != null ? s.riskScore.toFixed(0) : "—"}
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
