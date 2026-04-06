"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { getSchoolOverview, getTopAtRisk } from "@/lib/api";
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [o, t] = await Promise.all([getSchoolOverview(user), getTopAtRisk(user)]);
      if (!cancelled) {
        setOverview(o);
        setTopRisk(t);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">School overview</h1>
      <p className="mt-1 text-sm text-slate-500">
        Aggregate metrics (mock or from <code className="text-sky-400">/api</code>).
      </p>

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
          <h2 className="text-lg font-medium text-slate-200">Top at-risk (preview)</h2>
          <Link href="/admin/risk" className="text-sm text-sky-400 hover:underline">
            Full risk view →
          </Link>
        </div>
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
      </div>
    </div>
  );
}
