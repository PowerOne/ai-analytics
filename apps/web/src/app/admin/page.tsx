"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  ApiError,
  computeSchoolOverviewFromDashboard,
  getPrincipalDashboard,
  mapDashboardToRankedRiskRows,
} from "@/lib/api";
import type { StudentRow } from "@/lib/types";
import { RiskBadge } from "@/components/risk/RiskBadge";

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<{
    totalStudents: number;
    avgRisk: number;
    classesCount: number;
  } | null>(null);
  const [topRisk, setTopRisk] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const dash = await getPrincipalDashboard(user);
        if (!cancelled) {
          setOverview(computeSchoolOverviewFromDashboard(dash));
          setTopRisk(mapDashboardToRankedRiskRows(dash).slice(0, 5));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return <p className="text-slate-500">Loading overview…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/40 p-4 text-rose-200">
        <p className="font-medium">Could not load overview</p>
        <p className="mt-1 text-sm opacity-90">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">School overview</h1>
      <p className="mt-1 text-sm text-slate-500">Aggregate metrics from the principal dashboard snapshot.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="text-xs uppercase text-slate-500">Students</div>
          <div className="mt-1 text-3xl font-bold tabular-nums">
            {overview?.totalStudents ?? "—"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="text-xs uppercase text-slate-500">Avg risk index</div>
          <div className="mt-1 text-3xl font-bold tabular-nums">
            {overview ? `${Math.round(overview.avgRisk)}` : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="text-xs uppercase text-slate-500">Classes</div>
          <div className="mt-1 text-3xl font-bold tabular-nums">
            {overview?.classesCount ?? "—"}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-200">Top at-risk</h2>
          <Link href="/admin/risk" className="text-sm text-sky-400 hover:underline">
            Full risk view →
          </Link>
        </div>
        {topRisk.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No ranked students yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-800 rounded-xl border border-slate-700">
            {topRisk.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium text-slate-200">{s.displayName}</span>
                  <span className="ml-2 text-xs text-slate-500">Grade {s.gradeLevel ?? "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <RiskBadge level={s.riskLevel} />
                  <span className="tabular-nums text-slate-400">
                    {s.riskScore == null ? "—" : `${Math.round(s.riskScore)}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
