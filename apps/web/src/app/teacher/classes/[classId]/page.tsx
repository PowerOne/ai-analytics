"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { getClasses, getClassStudentsWithIndicators } from "@/lib/api";
import type { ClassSummary, StudentRow } from "@/lib/types";
import { StudentList } from "@/components/students/StudentList";

export default function TeacherClassDashboardPage() {
  const params = useParams<{ classId: string }>();
  const classId = params.classId;
  const { user } = useAuth();
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);

  useEffect(() => {
    if (!user || !classId) return;
    let c = false;
    (async () => {
      const [allClasses, rows] = await Promise.all([
        getClasses(user),
        getClassStudentsWithIndicators(user, classId),
      ]);
      if (!c) {
        setCls(allClasses.find((x) => x.id === classId) ?? null);
        setStudents(rows);
      }
    })();
    return () => {
      c = true;
    };
  }, [user, classId]);

  const baseHref = `/teacher/classes/${classId}/students`;

  return (
    <div>
      <div className="text-sm text-slate-500">
        <Link href="/teacher/classes" className="text-sky-400 hover:underline">
          Classes
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-400">{cls?.name ?? "…"}</span>
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">{cls?.name ?? "Class"}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Risk & engagement indicators (mock enriched). Backend: class analytics + student list.
      </p>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
          Students
        </h2>
        <StudentList students={students} baseHref={baseHref} />
      </div>
    </div>
  );
}
