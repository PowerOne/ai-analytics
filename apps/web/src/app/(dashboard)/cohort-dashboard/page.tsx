"use client";

import Link from "next/link";

export default function CohortDashboardHubPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Cohort dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Choose a grade cohort or subject cohort. URLs use the API shape:
        </p>
      </div>
      <ul className="space-y-3 text-sm text-slate-300">
        <li>
          <span className="text-slate-500">Grade: </span>
          <code className="rounded bg-slate-900 px-2 py-1 text-sky-300">/cohort-dashboard/grade/&lt;gradeKey&gt;</code>
        </li>
        <li>
          <span className="text-slate-500">Subject: </span>
          <code className="rounded bg-slate-900 px-2 py-1 text-sky-300">/cohort-dashboard/subject/&lt;subjectUuid&gt;</code>
        </li>
      </ul>
      <p className="text-xs text-slate-500">
        Example: replace <code className="text-slate-400">gradeKey</code> with a value like{" "}
        <code className="text-slate-400">9</code> or <code className="text-slate-400">_unassigned</code>.
      </p>
      <Link href="/principal-dashboard" className="inline-block text-sm text-sky-400 hover:underline">
        ← Principal dashboard
      </Link>
    </div>
  );
}
