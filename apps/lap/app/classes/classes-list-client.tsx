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
import type { ClassDirectoryRow } from "@/app/lib/school-directory-types";
import { qk } from "@/app/lib/query-keys";

function teacherLabel(t: ClassDirectoryRow["primaryTeacher"]): string {
  if (!t) return "—";
  const d = t.displayName?.trim();
  if (d) return d;
  return t.email?.trim() || "—";
}

export function ClassesListClient({ user }: { user: AuthUser }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: qk.classes(),
    queryFn: () => api.get<ClassDirectoryRow[]>("classes"),
  });

  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Classes
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
              GET /api/classes
            </code>
            {user.role === "TEACHER" ? (
              <span className="mt-1 block text-xs text-zinc-500">
                Sections where you are the primary teacher.
              </span>
            ) : null}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link
              href="/students"
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Students directory →
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
          <CardTitle>Directory</CardTitle>
          <CardDescription>
            Open a class for rosters, term context, and learning signals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Spinner size="lg" label="Loading classes" />
              <p className="text-sm text-zinc-500">Loading sections…</p>
            </div>
          ) : isError ? (
            <ErrorState
              title="Could not load classes"
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
              title="No classes in scope"
              description={
                user.role === "TEACHER"
                  ? "You are not listed as primary teacher on any section yet."
                  : "No class sections were returned for your school."
              }
              action={{ label: "Students", href: "/students" }}
            />
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead className="hidden sm:table-cell">Subject</TableHead>
                    <TableHead className="hidden md:table-cell">Term</TableHead>
                    <TableHead className="hidden lg:table-cell">Primary teacher</TableHead>
                    <TableHead className="hidden xl:table-cell">Room</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/classes/${r.id}`}
                          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {r.name}
                        </Link>
                        {r.sectionCode ? (
                          <span className="ml-2 text-xs text-zinc-500">§ {r.sectionCode}</span>
                        ) : null}
                        <p className="mt-0.5 text-xs text-zinc-500 sm:hidden">
                          {r.subject.name}
                          {r.term.label ? ` · ${r.term.label}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm">{r.subject.name}</span>
                        <span className="ml-1 font-mono text-xs text-zinc-500">
                          ({r.subject.code})
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {r.term.label}
                      </TableCell>
                      <TableCell className="hidden text-sm text-zinc-600 dark:text-zinc-400 lg:table-cell">
                        {teacherLabel(r.primaryTeacher)}
                      </TableCell>
                      <TableCell className="hidden text-sm xl:table-cell">
                        {r.room ?? "—"}
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
        Each row opens a{" "}
        <span className="text-zinc-600 dark:text-zinc-400">class 360°</span> view. Cross-check
        learners in the{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/students">
          Students
        </Link>{" "}
        directory.
      </p>
    </div>
  );
}
