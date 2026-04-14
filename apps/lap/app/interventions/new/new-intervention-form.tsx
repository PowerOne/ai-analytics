"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, linkButtonClass } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { ErrorState } from "@/app/components/ui/error-state";
import { Spinner } from "@/app/components/ui/spinner";
import { ApiError, api } from "@/app/lib/api";
import type { AuthUser } from "@/app/lib/auth-types";
import type { InterventionRecord, TeacherOption } from "@/app/lib/intervention-types";
import { qk } from "@/app/lib/query-keys";
import { teacherDisplayName } from "@/app/lib/teacher-label";

export function NewInterventionForm({
  user,
  defaultClassId,
  defaultStudentId,
}: {
  user: AuthUser;
  defaultClassId: string | null;
  defaultStudentId: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [teacherId, setTeacherId] = useState(
    user.role === "TEACHER" ? user.teacherId ?? "" : "",
  );
  const [classId, setClassId] = useState(defaultClassId ?? "");
  const [studentId, setStudentId] = useState(defaultStudentId ?? "");
  const [triggerType, setTriggerType] = useState("manual_concern");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: teachers = [],
    isLoading: teachersLoading,
    isError: teachersError,
    error: teachersQueryError,
    refetch: refetchTeachers,
    isFetching: teachersFetching,
  } = useQuery({
    queryKey: qk.teachers(user.schoolId),
    enabled: user.role !== "TEACHER",
    queryFn: () => api.get<TeacherOption[]>(`schools/${user.schoolId}/teachers`),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api.post<InterventionRecord>(`schools/${user.schoolId}/interventions`, body),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: qk.interventions(user.schoolId) });
      router.push(`/interventions/${created.id}`);
      router.refresh();
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Could not create intervention");
    },
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const tid =
      user.role === "TEACHER" ? user.teacherId : teacherId.trim() || null;
    if (!tid) {
      setFormError("Select a teacher.");
      return;
    }
    if (!description.trim()) {
      setFormError("Description is required.");
      return;
    }
    const body: Record<string, string> = {
      teacherId: tid,
      triggerType: triggerType.trim() || "manual_concern",
      description: description.trim(),
    };
    const c = classId.trim();
    const s = studentId.trim();
    if (c) body.classId = c;
    if (s) body.studentId = s;
    createMutation.mutate(body);
  }

  const teacherLocked = user.role === "TEACHER";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/interventions"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Interventions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Create intervention
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
            POST /api/schools/…/interventions
          </code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            AI recommendations are requested automatically when the record is created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {teacherLocked ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
                <span className="text-zinc-500">Teacher</span>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">You (logged-in teacher)</p>
                {!user.teacherId ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Your account has no teacher id; ask an administrator to create on your behalf.
                  </p>
                ) : null}
              </div>
            ) : teachersLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 sm:flex-row sm:justify-start">
                <Spinner size="sm" label="Loading teachers" />
                <span className="text-sm text-zinc-500">Loading teachers…</span>
              </div>
            ) : teachersError ? (
              <ErrorState
                className="py-6"
                title="Could not load teachers"
                message={
                  teachersQueryError instanceof Error
                    ? teachersQueryError.message
                    : "Try again in a moment."
                }
                onRetry={() => void refetchTeachers()}
                retryLabel={teachersFetching ? "Retrying…" : "Try again"}
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Teacher <span className="text-red-500">*</span>
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {teacherDisplayName(t)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Input
              label="Class ID (optional)"
              name="classId"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder="UUID"
              className="font-mono text-sm"
            />
            <Input
              label="Student ID (optional)"
              name="studentId"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="UUID"
              className="font-mono text-sm"
            />
            <Input
              label="Trigger type"
              name="triggerType"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="intervention-description"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="intervention-description"
                required
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="Describe the concern, context, and desired outcome."
              />
            </div>

            {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={createMutation.isPending || (teacherLocked && !user.teacherId)}
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
              <Link href="/interventions" className={linkButtonClass("outline", "md")}>
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
