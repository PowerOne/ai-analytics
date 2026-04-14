"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Badge } from "@/app/components/ui/badge";
import { Button, linkButtonClass } from "@/app/components/ui/button";
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
import type { InterventionRecord } from "@/app/lib/intervention-types";
import { qk } from "@/app/lib/query-keys";

function statusVariant(
  status: string,
): "default" | "secondary" | "outline" | "success" | "warning" {
  const s = status.toLowerCase();
  if (s === "resolved") return "success";
  if (s === "in_progress") return "warning";
  return "secondary";
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function InterventionsListClient({ user }: { user: AuthUser }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: qk.interventions(user.schoolId),
    queryFn: () =>
      api.get<InterventionRecord[]>(`schools/${user.schoolId}/interventions`),
  });

  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Interventions
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
              GET /api/schools/…/interventions
            </code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          <Link href="/interventions/new" className={linkButtonClass("primary", "sm")}>
            Create intervention
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All in scope</CardTitle>
          <CardDescription>
            {user.role === "TEACHER"
              ? "Interventions you own as primary teacher."
              : "School-wide intervention records."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Spinner size="lg" label="Loading interventions" />
              <p className="text-sm text-zinc-500">Loading interventions…</p>
            </div>
          ) : isError ? (
            <ErrorState
              title="Could not load interventions"
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
              title="No interventions yet"
              description="Create a record to track support actions for students or classes."
              action={{ label: "Create intervention", href: "/interventions/new" }}
            />
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead className="hidden md:table-cell">Student</TableHead>
                    <TableHead className="hidden md:table-cell">Class</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
                        {formatWhen(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate font-mono text-xs sm:max-w-[140px]">
                        {r.triggerType}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">
                        {r.studentId ? (
                          <Link
                            href={`/students/${r.studentId}`}
                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {r.studentId.slice(0, 8)}…
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">
                        {r.classId ? (
                          <Link
                            href={`/classes/${r.classId}`}
                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {r.classId.slice(0, 8)}…
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] sm:max-w-[280px]">
                        <Link
                          href={`/interventions/${r.id}`}
                          className="line-clamp-2 text-sm text-zinc-800 hover:text-indigo-600 dark:text-zinc-200 dark:hover:text-indigo-400"
                        >
                          {r.description}
                        </Link>
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
        Open a{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/students">
          student
        </Link>{" "}
        or{" "}
        <Link className="text-primary underline-offset-2 hover:underline" href="/classes">
          class
        </Link>{" "}
        profile for full context while logging support.
      </p>
    </div>
  );
}
