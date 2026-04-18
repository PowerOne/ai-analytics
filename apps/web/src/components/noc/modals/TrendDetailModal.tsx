"use client";

import type { SchoolTrendSummary } from "@/lib/dashboard-types";

export function TrendDetailModal({
  open,
  trends,
  onClose,
}: {
  open: boolean;
  trends: SchoolTrendSummary | null;
  onClose: () => void;
}) {
  if (!open || trends == null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-100">School trend detail</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Week-over-week deltas from the principal dashboard snapshot. Absolute prior-week values are not included in
          this payload.
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Performance delta</dt>
            <dd className="font-mono tabular-nums text-slate-200">{trends.performanceDelta.toFixed(1)}%</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Attendance delta</dt>
            <dd className="font-mono tabular-nums text-slate-200">{trends.attendanceDelta.toFixed(1)}%</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Engagement delta</dt>
            <dd className="font-mono tabular-nums text-slate-200">{trends.engagementDelta.toFixed(1)}%</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-slate-800 pt-3">
            <dt className="text-slate-400">Risk delta (avg)</dt>
            <dd className="font-mono tabular-nums text-slate-200">{trends.riskDelta.toFixed(1)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">High risk (snapshot count)</dt>
            <dd className="font-mono tabular-nums text-slate-200">{trends.highRiskNew}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Risk composite delta</dt>
            <dd className="font-mono tabular-nums text-slate-200">{trends.riskCompositeDelta.toFixed(1)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
