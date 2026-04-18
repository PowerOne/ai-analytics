"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NocHeatmapGrid } from "@/components/noc/NocHeatmapGrid";
import { NocInterventionCard } from "@/components/noc/NocInterventionCard";
import { avgRiskAccent, NocTile } from "@/components/noc/NocTile";
import { NocTrendDelta } from "@/components/noc/NocTrendDelta";
import { AttendanceEngagementModal } from "@/components/noc/modals/AttendanceEngagementModal";
import { CohortDetailModal } from "@/components/noc/modals/CohortDetailModal";
import { InterventionDetailModal } from "@/components/noc/modals/InterventionDetailModal";
import { TrendDetailModal } from "@/components/noc/modals/TrendDetailModal";
import { RiskBadge } from "@/components/risk/RiskBadge";
import { useAuth } from "@/context/auth-context";
import {
  computeSchoolOverviewFromDashboard,
  getPrincipalDashboard,
  mapDashboardToHeatmapCells,
  mapDashboardToRankedRiskRows,
} from "@/lib/api";
import type {
  PrincipalAttEngDayBucket,
  PrincipalCohortRow,
  PrincipalDashboardResponse,
} from "@/lib/dashboard-types";
import type { HeatmapCell } from "@/lib/types";

function findCohortForDashboardCell(
  dashboard: PrincipalDashboardResponse,
  cell: HeatmapCell,
): PrincipalCohortRow | undefined {
  return dashboard.cohorts.find((coh) => {
    if (coh.cohortId !== cell.classId) return false;
    if (cell.grade === "Subject") return coh.cohortType === "SUBJECT";
    return coh.cohortType === "GRADE";
  });
}

function countAttendanceBuckets(daily: PrincipalAttEngDayBucket[]) {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const d of daily) {
    const r = d.attendanceRate;
    if (r == null || !Number.isFinite(r)) continue;
    const pct = r <= 1.0001 ? r * 100 : r;
    if (pct >= 85) high += 1;
    else if (pct >= 65) medium += 1;
    else low += 1;
  }
  return { high, medium, low };
}

function countEngagementBuckets(daily: PrincipalAttEngDayBucket[]) {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const d of daily) {
    const v = d.engagementAvg;
    if (v == null || !Number.isFinite(v)) continue;
    const pct = v <= 1.0001 ? v * 100 : v;
    if (pct >= 70) high += 1;
    else if (pct >= 40) medium += 1;
    else low += 1;
  }
  return { high, medium, low };
}

export default function PrincipalDashboardNocPage() {
  const { user } = useAuth();
  const [data, setData] = useState<PrincipalDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cohortModalCohort, setCohortModalCohort] = useState<PrincipalCohortRow | null>(null);
  const [trendModalOpen, setTrendModalOpen] = useState(false);
  const [interventionModalOpen, setInterventionModalOpen] = useState(false);
  const [attEngModalOpen, setAttEngModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.token) return;
    if (user.role !== "ADMIN" && user.role !== "PRINCIPAL") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getPrincipalDashboard(user);
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (user?.role !== "ADMIN" && user?.role !== "PRINCIPAL") {
    return <div className="text-slate-400">NOC dashboard requires Admin or Principal role.</div>;
  }

  if (loading) {
    return <div className="text-slate-500">Loading NOC snapshot…</div>;
  }

  if (error) {
    return <div className="text-rose-300">{error}</div>;
  }

  if (!data) {
    return null;
  }

  const overview = computeSchoolOverviewFromDashboard(data);
  const heatmapCells = mapDashboardToHeatmapCells(data);
  const topCohorts = mapDashboardToRankedRiskRows(data).slice(0, 5);
  const cohortInterventionTotal = data.cohorts.reduce((s, c) => s + c.interventions, 0);
  const block = data.principalAttendanceEngagementHeatmap;
  const attBuckets = block ? countAttendanceBuckets(block.daily) : null;
  const engBuckets = block ? countEngagementBuckets(block.daily) : null;
  const snapshotWindow =
    block?.window != null ? `${block.window.from} → ${block.window.to}` : null;

  const sectionFirst = "mt-10 space-y-5";
  const sectionNext = "mt-10 space-y-5 border-t border-slate-800 pt-10";

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-16 text-slate-200 sm:px-4">
      <header className="border-b border-slate-800 pb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Hybrid NOC + STROM</h1>
        <p className="mt-2 text-sm text-slate-500">
          School intelligence snapshot (same source as Principal Dashboard API).
        </p>
      </header>

      {/* SITUATION */}
      <section className={sectionFirst}>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">SITUATION</h2>
        <p className="text-sm text-slate-500">Headcount, risk posture, and cohort breadth</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <NocTile title="Total students" value={overview.totalStudents} subtitle="Grade cohort headcount (snapshot)" />
          <NocTile
            title="Avg risk"
            value={Number.isFinite(overview.avgRisk) ? overview.avgRisk.toFixed(1) : "—"}
            subtitle="Weighted by cohort size"
            accent={avgRiskAccent(overview.avgRisk)}
          />
          <NocTile title="Classes count" value={overview.classesCount} subtitle="Cohort rows (grade + subject)" />
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-500">
          <span className="text-slate-400">Snapshot window: </span>
          {snapshotWindow ?? "Not available (attendance–engagement block missing)"}
        </div>
      </section>

      {/* THREAT */}
      <section className={sectionNext}>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">THREAT</h2>
        <p className="text-sm text-slate-500">Cohort risk concentration and top cohorts</p>
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Click a cell to open cohort detail.</p>
          <NocHeatmapGrid
            cells={heatmapCells}
            onCellClick={(cell) => {
              const co = findCohortForDashboardCell(data, cell);
              if (co) setCohortModalCohort(co);
            }}
          />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-medium text-slate-500">Top risk cohorts</h3>
          {topCohorts.length === 0 ? (
            <p className="text-sm text-slate-500">No cohort rows.</p>
          ) : (
            <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900/30">
              {topCohorts.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="truncate font-medium text-slate-200">{row.displayName}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <RiskBadge level={row.riskLevel} />
                    <span className="tabular-nums text-slate-400">
                      {row.riskScore == null ? "—" : row.riskScore.toFixed(1)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* RESPONSE */}
      <section className={sectionNext}>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">RESPONSE</h2>
        <p className="text-sm text-slate-500">Intervention load and AI suggestions</p>
        <NocInterventionCard
          cohortInterventionTotal={cohortInterventionTotal}
          createdThisWeek={data.interventions.created}
          resolvedThisWeek={data.interventions.resolved}
          schoolSuggestionsCount={Array.isArray(data.schoolInterventions) ? data.schoolInterventions.length : 0}
          interventionsHref="/principal-dashboard"
          onCardClick={() => setInterventionModalOpen(true)}
        />
      </section>

      {/* OUTCOME */}
      <section className={sectionNext}>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">OUTCOME</h2>
        <p className="text-sm text-slate-500">Week-over-week school trend deltas</p>
        <NocTrendDelta trends={data.schoolTrends} onOpenDetail={() => setTrendModalOpen(true)} />
      </section>

      {/* MONITORING */}
      <section className={sectionNext}>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">MONITORING</h2>
        <p className="text-sm text-slate-500">Attendance & engagement bucket mix</p>
        {block == null ? (
          <p className="text-sm text-slate-500">No attendance–engagement block in this response.</p>
        ) : (
          <div
            className="cursor-pointer space-y-5 rounded-xl border border-slate-600/70 bg-slate-900/40 p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-sky-500/35 hover:shadow-md"
            role="button"
            tabIndex={0}
            onClick={() => setAttEngModalOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setAttEngModalOpen(true);
              }
            }}
          >
            <div>
              <div className="text-sm font-medium text-slate-500">Attendance buckets (daily)</div>
              <div className="mt-2 flex flex-wrap gap-6 text-sm">
                <span>
                  High: <span className="font-semibold text-emerald-300">{attBuckets?.high ?? 0}</span>
                </span>
                <span>
                  Medium: <span className="font-semibold text-amber-300">{attBuckets?.medium ?? 0}</span>
                </span>
                <span>
                  Low: <span className="font-semibold text-rose-300">{attBuckets?.low ?? 0}</span>
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Engagement buckets (daily)</div>
              <div className="mt-2 flex flex-wrap gap-6 text-sm">
                <span>
                  High: <span className="font-semibold text-emerald-300">{engBuckets?.high ?? 0}</span>
                </span>
                <span>
                  Medium: <span className="font-semibold text-amber-300">{engBuckets?.medium ?? 0}</span>
                </span>
                <span>
                  Low: <span className="font-semibold text-rose-300">{engBuckets?.low ?? 0}</span>
                </span>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-4 text-sm text-slate-400">
              <p>
                Contributor drill-down uses{" "}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
                  GET …/dashboards/principal/attendance-engagement/contributors
                </code>
                . Click this card to load contributors for a bucket.
              </p>
              <Link
                href="/principal-dashboard"
                className="mt-3 inline-block text-sm font-medium text-sky-400 hover:text-sky-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Go to Principal Dashboard (attendance & engagement)
              </Link>
            </div>
          </div>
        )}
      </section>

      <CohortDetailModal
        open={cohortModalCohort != null}
        cohort={cohortModalCohort}
        onClose={() => setCohortModalCohort(null)}
      />
      <TrendDetailModal open={trendModalOpen} trends={data.schoolTrends} onClose={() => setTrendModalOpen(false)} />
      <InterventionDetailModal
        open={interventionModalOpen}
        onClose={() => setInterventionModalOpen(false)}
        cohortInterventionTotal={cohortInterventionTotal}
        createdThisWeek={data.interventions.created}
        resolvedThisWeek={data.interventions.resolved}
        resolutionRate={data.interventions.resolutionRate}
        schoolInterventions={Array.isArray(data.schoolInterventions) ? data.schoolInterventions : []}
      />
      {user ? (
        <AttendanceEngagementModal
          open={attEngModalOpen}
          onClose={() => setAttEngModalOpen(false)}
          schoolId={user.schoolId}
          token={user.token}
          block={block ?? null}
        />
      ) : null}
    </div>
  );
}
