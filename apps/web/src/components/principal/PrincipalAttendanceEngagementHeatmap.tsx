"use client";

import { useCallback, useMemo, useState } from "react";
import { PrincipalAttEngContributorsDialog } from "@/components/principal/PrincipalAttEngContributorsDialog";
import { useAuth } from "@/context/auth-context";
import { ApiError, fetchPrincipalAttEngContributors } from "@/lib/api";
import { cn } from "@/lib/cn";
import type {
  PrincipalAttEngContributorClass,
  PrincipalAttEngContributorStudent,
  PrincipalAttEngDayBucket,
  PrincipalAttEngWeekBucket,
  PrincipalAttendanceEngagementHeatmapBlock,
} from "@/lib/dashboard-types";

function normalizeIntensity(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Higher value = greener. Null / non-finite = neutral slate. */
function heatBackground(value: number | null | undefined, min: number, max: number): string {
  if (value == null || !Number.isFinite(value)) return "rgb(51 65 85)";
  const t = normalizeIntensity(value, min, max);
  const hue = t * 120;
  return `hsl(${hue} 65% 32%)`;
}

function formatShortYmd(ymd: string): string {
  return ymd.length >= 10 ? ymd.slice(5) : ymd;
}

function attendanceTooltip(rate: number | null | undefined, sessions: number): string {
  if (rate == null || !Number.isFinite(rate)) return `Attendance: no data · ${sessions} session(s)`;
  const pct = rate <= 1.0001 ? Math.round(rate * 10_000) / 100 : Math.round(rate * 100) / 100;
  return `Attendance: ${pct}${rate <= 1.0001 ? "%" : ""} · ${sessions} session(s)`;
}

function engagementTooltip(avg: number | null | undefined, events: number): string {
  if (avg == null || !Number.isFinite(avg)) return `Engagement: no data · ${events} event(s)`;
  return `Engagement: ${Math.round(avg * 100) / 100} avg · ${events} event(s)`;
}

type Tab = "daily" | "weekly";

export function PrincipalAttendanceEngagementHeatmap({
  principalAttendanceEngagementHeatmap: block,
}: {
  principalAttendanceEngagementHeatmap: PrincipalAttendanceEngagementHeatmapBlock;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("daily");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogSubtitle, setDialogSubtitle] = useState<string | undefined>();
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogStudents, setDialogStudents] = useState<PrincipalAttEngContributorStudent[]>([]);
  const [dialogClasses, setDialogClasses] = useState<PrincipalAttEngContributorClass[]>([]);

  const dailySorted = useMemo(
    () => [...block.daily].sort((a, b) => a.date.localeCompare(b.date)),
    [block.daily],
  );
  const weeklySorted = useMemo(
    () => [...block.weekly].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    [block.weekly],
  );

  const bothEmpty = dailySorted.length === 0 && weeklySorted.length === 0;

  const buckets = tab === "daily" ? dailySorted : weeklySorted;
  const bucketKeys = tab === "daily" ? dailySorted.map((d) => d.date) : weeklySorted.map((w) => w.weekStart);

  const attRates = useMemo(
    () => buckets.map((b) => ("date" in b ? (b as PrincipalAttEngDayBucket).attendanceRate : (b as PrincipalAttEngWeekBucket).attendanceRate)),
    [buckets],
  );
  const engAvgs = useMemo(
    () => buckets.map((b) => ("date" in b ? (b as PrincipalAttEngDayBucket).engagementAvg : (b as PrincipalAttEngWeekBucket).engagementAvg)),
    [buckets],
  );

  const attBounds = useMemo(() => {
    const nums = attRates.filter((v): v is number => v != null && Number.isFinite(v));
    if (nums.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(...nums), max: Math.max(...nums) };
  }, [attRates]);

  const engBounds = useMemo(() => {
    const nums = engAvgs.filter((v): v is number => v != null && Number.isFinite(v));
    if (nums.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(...nums), max: Math.max(...nums) };
  }, [engAvgs]);

  const openContributors = useCallback(
    async (metric: "attendance" | "engagement", bucketKey: string) => {
      if (!user?.token) {
        setDialogTitle("Contributors");
        setDialogSubtitle(undefined);
        setDialogError("Not signed in.");
        setDialogStudents([]);
        setDialogClasses([]);
        setDialogOpen(true);
        setDialogLoading(false);
        return;
      }
      const bucketType = tab === "daily" ? "day" : "week";
      setDialogOpen(true);
      setDialogLoading(true);
      setDialogError(null);
      setDialogStudents([]);
      setDialogClasses([]);
      setDialogTitle(metric === "attendance" ? "Attendance contributors" : "Engagement contributors");
      setDialogSubtitle(`${bucketType} · ${bucketKey}`);
      try {
        const res = await fetchPrincipalAttEngContributors(user.schoolId, {
          token: user.token,
          bucketType,
          bucketKey,
          metric,
        });
        setDialogStudents(res.students);
        setDialogClasses(res.classes);
      } catch (e) {
        setDialogError(e instanceof ApiError ? e.message : "Failed to load contributors");
      } finally {
        setDialogLoading(false);
      }
    },
    [tab, user?.schoolId, user?.token],
  );

  const gridTemplateColumns = useMemo(() => {
    const n = Math.max(bucketKeys.length, 1);
    return `minmax(5.5rem,auto) repeat(${n},minmax(2.25rem,1fr))`;
  }, [bucketKeys.length]);

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-200">Attendance &amp; engagement</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {block.window.from} → {block.window.to} <span className="text-slate-600">(UTC)</span>
          </p>
        </div>
        {!bothEmpty ? (
          <div className="flex rounded-lg border border-slate-700 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab("daily")}
              className={cn(
                "rounded-md px-3 py-1",
                tab === "daily" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-200",
              )}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setTab("weekly")}
              className={cn(
                "rounded-md px-3 py-1",
                tab === "weekly" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-slate-200",
              )}
            >
              Weekly
            </button>
          </div>
        ) : null}
      </div>

      {!block.snapshot.available ? (
        <p className="mb-3 rounded-md border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
          {block.snapshot.message?.trim() || "No snapshot data available."}
        </p>
      ) : null}

      {bothEmpty ? (
        <p className="text-sm text-slate-500">No attendance or engagement data in this range.</p>
      ) : bucketKeys.length === 0 ? (
        <p className="text-sm text-slate-500">No buckets for this view.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid gap-x-1 gap-y-1.5 text-[10px]" style={{ gridTemplateColumns }}>
            <div />
            {bucketKeys.map((k) => (
              <div
                key={k}
                className="flex min-h-7 items-end justify-center pb-0.5 text-center font-medium text-slate-500"
                title={k}
              >
                {formatShortYmd(k)}
              </div>
            ))}
            <div className="flex items-center text-xs font-medium uppercase tracking-wide text-slate-500">Attendance</div>
            {buckets.map((b) => {
              const key = "date" in b ? b.date : b.weekStart;
              const rate = b.attendanceRate;
              const sessions = b.attendanceSessions;
              return (
                <button
                  key={`att-${key}`}
                  type="button"
                  title={attendanceTooltip(rate ?? null, sessions)}
                  onClick={() => void openContributors("attendance", key)}
                  className={cn(
                    "flex h-9 min-w-[2.25rem] items-center justify-center rounded border text-slate-200",
                    rate == null || !Number.isFinite(rate) ? "border-slate-600" : "border-slate-800",
                  )}
                  style={{ backgroundColor: heatBackground(rate ?? null, attBounds.min, attBounds.max) }}
                >
                  {rate != null && Number.isFinite(rate) ? (rate <= 1.0001 ? `${Math.round(rate * 100)}` : `${Math.round(rate)}`) : "—"}
                </button>
              );
            })}
            <div className="flex items-center text-xs font-medium uppercase tracking-wide text-slate-500">Engagement</div>
            {buckets.map((b) => {
              const key = "date" in b ? b.date : b.weekStart;
              const avg = b.engagementAvg;
              const events = b.engagementEventCount;
              return (
                <button
                  key={`eng-${key}`}
                  type="button"
                  title={engagementTooltip(avg ?? null, events)}
                  onClick={() => void openContributors("engagement", key)}
                  className={cn(
                    "flex h-9 min-w-[2.25rem] items-center justify-center rounded border text-slate-200",
                    avg == null || !Number.isFinite(avg) ? "border-slate-600" : "border-slate-800",
                  )}
                  style={{ backgroundColor: heatBackground(avg ?? null, engBounds.min, engBounds.max) }}
                >
                  {avg != null && Number.isFinite(avg) ? `${Math.round(avg)}` : "—"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <PrincipalAttEngContributorsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={dialogTitle}
        subtitle={dialogSubtitle}
        loading={dialogLoading}
        error={dialogError}
        students={dialogStudents}
        classes={dialogClasses}
      />
    </div>
  );
}
