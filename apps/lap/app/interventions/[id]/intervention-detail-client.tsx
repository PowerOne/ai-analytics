"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { ErrorState } from "@/app/components/ui/error-state";
import { Spinner } from "@/app/components/ui/spinner";
import { ApiError, api } from "@/app/lib/api";
import type { AuthUser } from "@/app/lib/auth-types";
import { INTERVENTION_STATUSES, type InterventionRecord } from "@/app/lib/intervention-types";
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
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function InterventionDetailClient({
  user,
  interventionId,
}: {
  user: AuthUser;
  interventionId: string;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const {
    data: row,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: qk.intervention(user.schoolId, interventionId),
    queryFn: () =>
      api.get<InterventionRecord>(
        `schools/${user.schoolId}/interventions/${interventionId}`,
      ),
  });

  useEffect(() => {
    if (row) {
      setStatus(row.status);
      setNotes(row.notes ?? "");
    }
  }, [row]);

  const patchMutation = useMutation({
    mutationFn: (body: { status?: string; notes?: string }) =>
      api.patch<InterventionRecord>(
        `schools/${user.schoolId}/interventions/${interventionId}`,
        body,
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.intervention(user.schoolId, interventionId), updated);
      void queryClient.invalidateQueries({ queryKey: qk.interventions(user.schoolId) });
      setStatus(updated.status);
      setNotes(updated.notes ?? "");
      setFormError(null);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Update failed");
    },
  });

  async function onSaveStatus(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    patchMutation.mutate({ status, notes });
  }

  function quickStatus(next: string) {
    setStatus(next);
    setFormError(null);
    patchMutation.mutate({ status: next });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <Spinner size="lg" label="Loading intervention" />
        <p className="text-sm text-zinc-500">Loading intervention…</p>
      </div>
    );
  }

  if (isError || !row) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <ErrorState
          title="Could not load intervention"
          message={
            error instanceof Error
              ? error.message
              : "It may have been removed or you may not have access."
          }
          onRetry={() => void refetch()}
          retryLabel={isFetching ? "Retrying…" : "Try again"}
        />
        <Link href="/interventions" className="text-sm text-indigo-600 dark:text-indigo-400">
          ← Back to list
        </Link>
      </div>
    );
  }

  let recommendationsText = "";
  try {
    recommendationsText =
      row.recommendations == null ? "" : JSON.stringify(row.recommendations, null, 2);
  } catch {
    recommendationsText = String(row.recommendations);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/interventions"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Interventions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Intervention
          </h1>
          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
        </div>
        <p className="mt-1 font-mono text-xs text-zinc-500 break-all">{row.id}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
            GET/PATCH /api/schools/…/interventions/{row.id}
          </code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            Created {formatWhen(row.createdAt)} · Updated {formatWhen(row.updatedAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="text-zinc-500">Trigger</span>
            <p className="font-mono text-zinc-900 dark:text-zinc-100">{row.triggerType}</p>
          </div>
          <div>
            <span className="text-zinc-500">Teacher ID</span>
            <p className="break-all font-mono text-xs text-zinc-800 dark:text-zinc-200">
              {row.teacherId}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
            <div>
              <span className="text-zinc-500">Student</span>
              <p className="mt-0.5">
                {row.studentId ? (
                  <Link
                    href={`/students/${row.studentId}`}
                    className="break-all font-mono text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {row.studentId}
                  </Link>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Class</span>
              <p className="mt-0.5">
                {row.classId ? (
                  <Link
                    href={`/classes/${row.classId}`}
                    className="break-all font-mono text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {row.classId}
                  </Link>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Description</span>
            <p className="mt-1 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
              {row.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {recommendationsText ? (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>Structured output from the AI service (if available)</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900">
              {recommendationsText}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Update status & notes</CardTitle>
          <CardDescription>
            <code className="text-xs">PATCH /api/schools/…/interventions/{row.id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="w-full text-xs font-medium text-zinc-500">Quick status</span>
            {INTERVENTION_STATUSES.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={status === s ? "primary" : "outline"}
                disabled={patchMutation.isPending}
                onClick={() => quickStatus(s)}
              >
                {s.replace("_", " ")}
              </Button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={onSaveStatus}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Status</label>
              <select
                className="h-10 w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {INTERVENTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="inv-notes"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Notes
              </label>
              <textarea
                id="inv-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="Case notes, follow-ups, resolution summary…"
              />
            </div>
            {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
            {savedFlash ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
            ) : null}
            <Button type="submit" variant="primary" disabled={patchMutation.isPending}>
              {patchMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
