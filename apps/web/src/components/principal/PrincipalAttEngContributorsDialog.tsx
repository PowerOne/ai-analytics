"use client";

import { useEffect } from "react";
import type { PrincipalAttEngContributorClass, PrincipalAttEngContributorStudent } from "@/lib/dashboard-types";

export function PrincipalAttEngContributorsDialog({
  open,
  onClose,
  title,
  subtitle,
  loading,
  error,
  students,
  classes,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  loading: boolean;
  error: string | null;
  students: PrincipalAttEngContributorStudent[];
  classes: PrincipalAttEngContributorClass[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="principal-att-eng-contributors-title"
        className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <div className="min-w-0">
            <h2 id="principal-att-eng-contributors-title" className="text-sm font-semibold text-slate-100">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(85vh-3.5rem)] overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-sm text-slate-400">Loading contributors…</p>
          ) : error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Students</h3>
                {students.length === 0 ? (
                  <p className="text-sm text-slate-500">No students in this bucket.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm text-slate-200">
                    {students.map((s) => (
                      <li key={s.id} className="truncate rounded border border-slate-700/80 bg-slate-950/40 px-2 py-1.5">
                        {s.displayName?.trim() || s.id}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Classes</h3>
                {classes.length === 0 ? (
                  <p className="text-sm text-slate-500">No classes in this bucket.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm text-slate-200">
                    {classes.map((c) => (
                      <li key={c.id} className="truncate rounded border border-slate-700/80 bg-slate-950/40 px-2 py-1.5">
                        {c.name}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
