"use client";

import { useQueries } from "@tanstack/react-query";
import Link from "next/link";

import { AdminDashboardCharts } from "./admin-dashboard-charts";
import {
  buildGradeBars,
  buildInterventionTrend,
  buildStatusSlices,
  formatShortDate,
} from "./admin-dashboard-utils";
import type {
  DashboardClass,
  DashboardCohort,
  DashboardIntervention,
  DashboardStudent,
  DashboardTeacher,
} from "./types";
import { Badge } from "@/app/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { DashboardPageLoading } from "@/app/components/ui/dashboard-page-loading";
import {
  EmptyState,
  cardEmbeddedEmptyClassName,
} from "@/app/components/ui/empty-state";
import { ErrorState } from "@/app/components/ui/error-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { ApiError, api } from "@/app/lib/api";
import type { AuthUser } from "@/app/lib/auth-types";
import { qk } from "@/app/lib/query-keys";

function errStatus(e: unknown): string {
  return e instanceof ApiError ? String(e.status) : "?";
}

function queryErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

export function AdminDashboardClient({ user }: { user: AuthUser }) {
  const schoolId = user.schoolId;

  const queries = useQueries({
    queries: [
      {
        queryKey: qk.students(),
        queryFn: () => api.get<DashboardStudent[]>("students"),
      },
      {
        queryKey: qk.classes(),
        queryFn: () => api.get<DashboardClass[]>("classes"),
      },
      {
        queryKey: qk.teachers(schoolId),
        queryFn: () =>
          api.get<DashboardTeacher[]>(`schools/${schoolId}/teachers`),
      },
      {
        queryKey: qk.interventions(schoolId),
        queryFn: () =>
          api.get<DashboardIntervention[]>(`schools/${schoolId}/interventions`),
      },
      {
        queryKey: qk.cohortsGrades(schoolId),
        queryFn: () =>
          api.get<DashboardCohort[]>(`schools/${schoolId}/cohorts/grades`),
      },
    ],
  });

  const [studentsQ, classesQ, teachersQ, interventionsQ, cohortsQ] = queries;

  const bootstrapping = queries.some((q) => q.isPending);

  if (bootstrapping) {
    return <DashboardPageLoading />;
  }

  const errors: string[] = [];
  const students = studentsQ.data ?? [];
  if (studentsQ.isError) {
    errors.push(`Students (${errStatus(studentsQ.error)}): could not load roster.`);
  }
  const classes = classesQ.data ?? [];
  if (classesQ.isError) {
    errors.push(`Classes (${errStatus(classesQ.error)}): could not load sections.`);
  }
  const teachers = teachersQ.data ?? [];
  if (teachersQ.isError) {
    errors.push(`Teachers (${errStatus(teachersQ.error)}): could not load staff list.`);
  }
  const interventions = interventionsQ.data ?? [];
  if (interventionsQ.isError) {
    errors.push(
      `Interventions (${errStatus(interventionsQ.error)}): could not load interventions.`,
    );
  }
  const cohorts = cohortsQ.data ?? [];
  if (cohortsQ.isError) {
    errors.push(`Cohorts (${errStatus(cohortsQ.error)}): could not load cohort summaries.`);
  }

  const gradeBars = buildGradeBars(students);
  const interventionTrend = buildInterventionTrend(interventions);
  const interventionStatus = buildStatusSlices(interventions);
  const recentInterventions = interventions.slice(0, 8);

  const totalStudents = students.length;
  const totalClasses = classes.length;
  const totalTeachers = teachers.length;

  const refetchAll = () => {
    void Promise.all(queries.map((q) => q.refetch()));
  };

  const anyFetching = queries.some((q) => q.isFetching);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Admin dashboard
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          School-wide metrics, cohort health, and intervention activity.
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

      {errors.length > 0 ? (
        <ErrorState
          title="Some data could not be loaded"
          message={errors.join(" ")}
          onRetry={refetchAll}
          retryLabel={anyFetching ? "Retrying…" : "Retry failed requests"}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total students</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {!studentsQ.isError ? totalStudents : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              From{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                GET /api/students
              </code>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total teachers</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {!teachersQ.isError ? totalTeachers : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              From{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                GET /api/schools/…/teachers
              </code>
            </p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>Total classes</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {!classesQ.isError ? totalClasses : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              From{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                GET /api/classes
              </code>
            </p>
          </CardContent>
        </Card>
      </div>

      <AdminDashboardCharts
        gradeBars={gradeBars}
        interventionStatus={interventionStatus}
        interventionTrend={interventionTrend}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent interventions</CardTitle>
            <CardDescription>
              Latest records from{" "}
              <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
                GET /api/schools/…/interventions
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {interventionsQ.isError ? (
              <ErrorState
                className="py-8"
                title="Could not load recent interventions"
                message={queryErrorMessage(interventionsQ.error)}
                onRetry={() => void interventionsQ.refetch()}
                retryLabel={interventionsQ.isFetching ? "Retrying…" : "Try again"}
              />
            ) : recentInterventions.length === 0 ? (
              <EmptyState
                className={cardEmbeddedEmptyClassName}
                title="No interventions yet"
                description="New records will appear here after they are created."
                action={{ label: "Create intervention", href: "/interventions/new" }}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInterventions.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400">
                        {formatShortDate(inv.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{inv.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs">
                        {inv.triggerType}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {inv.description}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grade cohorts</CardTitle>
            <CardDescription>
              Summaries from{" "}
              <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
                GET /api/schools/…/cohorts/grades
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cohortsQ.isError ? (
              <ErrorState
                className="py-8"
                title="Could not load cohorts"
                message={queryErrorMessage(cohortsQ.error)}
                onRetry={() => void cohortsQ.refetch()}
                retryLabel={cohortsQ.isFetching ? "Retrying…" : "Try again"}
              />
            ) : cohorts.length === 0 ? (
              <EmptyState
                className={cardEmbeddedEmptyClassName}
                title="No cohort summaries"
                description="Grade cohort analytics will show when data is available for your school."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cohort</TableHead>
                    <TableHead className="text-right">Perf.</TableHead>
                    <TableHead className="text-right">Attend.</TableHead>
                    <TableHead className="text-right">Risk avg</TableHead>
                    <TableHead className="text-right">IV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cohorts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {c.performance.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {(c.attendance * 100).toFixed(0)}%
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
      </div>

      <p className="text-center text-xs text-zinc-500">
        Need class or student detail? Open{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/classes">
          Classes
        </Link>{" "}
        or{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/students">
          Students
        </Link>
        .
      </p>
    </div>
  );
}
