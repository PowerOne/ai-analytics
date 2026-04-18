"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { ApiError, getClasses } from "@/lib/api";
import type { ClassSummary } from "@/lib/types";

export default function TeacherClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let c = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getClasses(user);
        if (!c) setClasses(data);
      } catch (e) {
        if (!c) setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [user]);

  if (loading) {
    return <p className="text-slate-500">Loading classes…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/40 p-4 text-rose-200">
        <p className="font-medium">Could not load classes</p>
        <p className="mt-1 text-sm opacity-90">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Your classes</h1>
      <p className="mt-1 text-sm text-slate-500">Open a class to see enrolled students and drill-down.</p>
      {classes.length === 0 ? (
        <p className="mt-8 text-slate-500">No classes assigned.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {classes.map((cl) => (
            <li key={cl.id}>
              <Link
                href={`/teacher/classes/${cl.id}`}
                className="block rounded-xl border border-slate-700 bg-slate-900/40 p-4 transition hover:border-sky-500/40 hover:bg-slate-900/60"
              >
                <div className="font-medium text-sky-300">{cl.name}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {cl.subject?.name} · {cl.term?.label}
                  {cl.sectionCode ? ` · Section ${cl.sectionCode}` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
