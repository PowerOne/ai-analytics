"use client";

export function InterventionDetailModal({
  open,
  onClose,
  cohortInterventionTotal,
  createdThisWeek,
  resolvedThisWeek,
  resolutionRate,
  schoolInterventions,
}: {
  open: boolean;
  onClose: () => void;
  cohortInterventionTotal: number;
  createdThisWeek: number;
  resolvedThisWeek: number;
  resolutionRate: number;
  schoolInterventions: unknown[];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Interventions</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ×
          </button>
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Total (cohort snapshot sum)</dt>
            <dd className="tabular-nums text-slate-100">{cohortInterventionTotal}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Created this week</dt>
            <dd className="tabular-nums text-sky-200">{createdThisWeek}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Resolved this week</dt>
            <dd className="tabular-nums text-emerald-200">{resolvedThisWeek}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Resolution rate</dt>
            <dd className="tabular-nums text-slate-200">{Math.round(resolutionRate * 100)}%</dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-slate-800 pt-4">
          <h3 className="text-xs font-medium uppercase text-slate-500">School interventions (AI payload)</h3>
          {schoolInterventions.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">None</p>
          ) : (
            <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-xs text-slate-400">
              {schoolInterventions.map((item, i) => (
                <li key={i} className="break-words font-mono">
                  {typeof item === "string" ? item : JSON.stringify(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
