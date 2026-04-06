"use client";

import Link from "next/link";

export default function Student360HubPage() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-slate-700/80 bg-slate-900/60 p-6 text-center">
      <h1 className="text-lg font-semibold text-slate-100">Student 360</h1>
      <p className="mt-2 text-sm text-slate-400">
        Open a specific student by ID in the URL:
      </p>
      <code className="mt-4 block rounded-lg bg-slate-950 px-3 py-2 text-sm text-sky-300">
        /student/&lt;studentId&gt;
      </code>
      <p className="mt-4 text-xs text-slate-500">
        Example: bookmark a student from your class roster, or paste a UUID from your SIS export.
      </p>
      <Link href="/teacher-dashboard" className="mt-6 inline-block text-sm text-sky-400 hover:underline">
        ← Back to Teacher Dashboard
      </Link>
    </div>
  );
}
