"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { getClasses } from "@/lib/api";
import type { ClassSummary } from "@/lib/types";

export default function TeacherClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassSummary[]>([]);

  useEffect(() => {
    if (!user) return;
    let c = false;
    (async () => {
      const data = await getClasses(user);
      if (!c) setClasses(data);
    })();
    return () => {
      c = true;
    };
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Your classes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Open a class to see students, risk/engagement indicators, and drill-down.
      </p>
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
    </div>
  );
}
