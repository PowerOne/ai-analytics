"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  EmptyState,
  cardEmbeddedEmptyClassName,
} from "@/app/components/ui/empty-state";
import { ErrorState } from "@/app/components/ui/error-state";
import { Spinner } from "@/app/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { api } from "@/app/lib/api";
import type { AuthUser } from "@/app/lib/auth-types";
import type { StudentRosterRow } from "@/app/lib/school-directory-types";
import { qk } from "@/app/lib/query-keys";

function studentLabel(row: StudentRosterRow): string {
  const d = row.displayName?.trim();
  if (d) return d;
  const parts = [row.givenName, row.familyName].filter(Boolean).join(" ").trim();
  return parts || "Unnamed student";
}

export function StudentsListClient({ user }: { user: AuthUser }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: qk.students(),
    queryFn: () => api.get<StudentRosterRow[]>("students"),
  });

  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Students
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
              GET /api/students
            </code>
            {user.role === "TEACHER" ? (
              <span className="mt-1 block text-xs text-zinc-500">
                Showing learners enrolled in your classes.
              </span>
            ) : null}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
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
        <Button
          variant="secondary"
          size="sm"
          type="button"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
          <CardDescription>
            Open a profile for attendance, risk, assessments, and interventions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Spinner size="lg" label="Loading students" />
              <p className="text-sm text-zinc-500">Loading roster…</p>
            </div>
          ) : isError ? (
            <ErrorState
              title="Could not load students"
              message={
                error instanceof Error
                  ? error.message
                  : "Check your connection and try again."
              }
              onRetry={() => void refetch()}
              retryLabel={isFetching ? "Retrying…" : "Try again"}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              className={cardEmbeddedEmptyClassName}
              title="No students in scope"
              description={
                user.role === "TEACHER"
                  ? "No enrollments were found for your classes yet."
                  : "No student records were returned for your school."
              }
              action={{ label: "Interventions", href: "/interventions" }}
            />
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden sm:table-cell">Grade</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">External ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/students/${r.id}`}
                          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {studentLabel(r)}
                        </Link>
                        <p className="mt-0.5 text-xs text-zinc-500 sm:hidden">
                          {r.gradeLevel ?? "—"}
                          {r.email ? ` · ${r.email}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="hidden text-sm sm:table-cell">
                        {r.gradeLevel ?? "—"}
                      </TableCell>
                      <TableCell className="hidden max-w-[220px] truncate text-sm text-zinc-600 dark:text-zinc-400 md:table-cell">
                        {r.email ?? "—"}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-zinc-500 lg:table-cell">
                        {r.externalId ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-zinc-500">
        Use{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/interventions">
          Interventions
        </Link>{" "}
        to document support actions, or open a learner row above for their full profile.
      </p>
    </div>
  );
}
