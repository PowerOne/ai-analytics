"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, fetchPrincipalAttEngContributors } from "@/lib/api";
import type {
  PrincipalAttendanceEngagementHeatmapBlock,
  PrincipalAttEngContributorClass,
  PrincipalAttEngContributorStudent,
} from "@/lib/dashboard-types";

export function AttendanceEngagementModal({
  open,
  onClose,
  schoolId,
  token,
  block,
}: {
  open: boolean;
  onClose: () => void;
  schoolId: string;
  token: string;
  block: PrincipalAttendanceEngagementHeatmapBlock | null;
}) {
  const [bucketType] = useState<"day" | "week">("day");
  const [bucketKey, setBucketKey] = useState<string>("");
  const [metric, setMetric] = useState<"attendance" | "engagement">("attendance");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<PrincipalAttEngContributorStudent[]>([]);
  const [classes, setClasses] = useState<PrincipalAttEngContributorClass[]>([]);

  const dailySorted = useMemo(() => {
    if (!block?.daily?.length) return [];
    return [...block.daily].sort((a, b) => a.date.localeCompare(b.date));
  }, [block?.daily]);

  useEffect(() => {
    if (!open || !block || dailySorted.length === 0) return;
    setBucketKey((k) => (k && dailySorted.some((d) => d.date === k) ? k : dailySorted[0].date));
  }, [open, block, dailySorted]);

  const load = useCallback(async () => {
    if (!bucketKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPrincipalAttEngContributors(schoolId, {
        token,
        bucketType,
        bucketKey,
        metric,
        limit: 50,
      });
      setStudents(res.students);
      setClasses(res.classes);
    } catch (e) {
      setStudents([]);
      setClasses([]);
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setLoading(false);
    }
  }, [schoolId, token, bucketType, bucketKey, metric]);

  useEffect(() => {
    if (!open || !bucketKey) return;
    void load();
  }, [open, bucketKey, metric, load]);

  if (!open || block == null) return null;

  if (dailySorted.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
          <div className="flex justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">Attendance & engagement</h2>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
              ×
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-500">No daily buckets to load contributors.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Attendance & engagement contributors</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">bucketType</span>
            <span className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300">{bucketType}</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">bucketKey</span>
            <select
              value={bucketKey}
              onChange={(e) => setBucketKey(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
            >
              {dailySorted.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.date}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">metric</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as "attendance" | "engagement")}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
            >
              <option value="attendance">attendance</option>
              <option value="engagement">engagement</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading contributors…</p>
        ) : error ? (
          <p className="mt-4 text-sm text-rose-300">{error}</p>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <section>
              <h3 className="text-xs font-medium uppercase text-slate-500">Students</h3>
              {students.length === 0 ? (
                <p className="mt-1 text-slate-500">No students</p>
              ) : (
                <ul className="mt-1 space-y-1 text-slate-300">
                  {students.map((s) => (
                    <li key={s.id}>{s.displayName?.trim() || s.id}</li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="text-xs font-medium uppercase text-slate-500">Classes</h3>
              {classes.length === 0 ? (
                <p className="mt-1 text-slate-500">No classes</p>
              ) : (
                <ul className="mt-1 space-y-1 text-slate-300">
                  {classes.map((c) => (
                    <li key={c.id}>{c.name}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
