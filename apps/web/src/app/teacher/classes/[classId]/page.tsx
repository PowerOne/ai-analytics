"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { ApiError, getClasses, getClassStudentsForClass } from "@/lib/api";
import type { ClassSummary, StudentRow } from "@/lib/types";
import { StudentList } from "@/components/students/StudentList";

export default function TeacherClassDashboardPage() {
  const params = useParams<{ classId: string }>();
  const classId = params.classId;
  const { user } = useAuth();
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !classId) return;
    let c = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [allClasses, rows] = await Promise.all([
          getClasses(user),
          getClassStudentsForClass(user, classId),
        ]);
        if (!c) {
          setCls(allClasses.find((x) => x.id === classId) ?? null);
          setStudents(rows);
        }
      } catch (e) {
        if (!c) setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [user, classId]);

  const baseHref = `/teacher/classes/${classId}/students`;

  if (loading) {
    return (
      <div>
        <p className="text-slate-500">Loading class…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/40 p-4 text-rose-200">
        <p className="font-medium">Could not load class</p>
        <p className="mt-1 text-sm opacity-90">{error}</p>
        <Link href="/teacher/classes" className="mt-4 inline-block text-sm text-sky-400 hover:underline">
          ← Back to classes
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="text-sm text-slate-500">
        <Link href="/teacher/classes" className="text-sky-400 hover:underline">
          Classes
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-400">{cls?.name ?? "—"}</span>
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">{cls?.name ?? "Class"}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Students enrolled in this class with performance and attendance from the live API.
      </p>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Students</h2>
        {students.length === 0 ? (
          <p className="text-slate-500">No students in this class.</p>
        ) : (
          <StudentList students={students} baseHref={baseHref} />
        )}
      </div>
    </div>
  );
}
