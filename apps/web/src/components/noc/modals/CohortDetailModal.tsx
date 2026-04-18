"use client";

import type { PrincipalCohortRow } from "@/lib/dashboard-types";

export function CohortDetailModal({
  open,
  cohort,
  onClose,
}: {
  open: boolean;
  cohort: PrincipalCohortRow | null;
  onClose: () => void;
}) {
  if (!open || cohort == null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Cohort detail</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ×
          </button>
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase text-slate-500">Name</dt>
            <dd className="font-medium text-slate-200">{cohort.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Type · id</dt>
            <dd className="text-slate-300">
              {cohort.cohortType} · {cohort.cohortId}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Risk average</dt>
            <dd className="tabular-nums text-slate-200">{cohort.risk.average.toFixed(1)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Risk bands</dt>
            <dd className="text-slate-300">
              Low {cohort.risk.low} · Medium {cohort.risk.medium} · High {cohort.risk.high}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Deltas (week-over-week)</dt>
            <dd className="space-y-1 text-slate-300">
              <div>Performance Δ {cohort.performanceDelta.toFixed(1)}</div>
              <div>Attendance Δ {cohort.attendanceDelta.toFixed(1)}</div>
              <div>Engagement Δ {cohort.engagementDelta.toFixed(1)}</div>
              <div>Risk Δ {cohort.riskDelta.toFixed(1)}</div>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Interventions (snapshot)</dt>
            <dd className="tabular-nums text-slate-200">{cohort.interventions}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
