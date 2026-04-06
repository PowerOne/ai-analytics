"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { getClasses, getStudentAnalytics, getStudentTrends } from "@/lib/api";
import type { ClassSummary, StudentAnalytics, TrendPoint } from "@/lib/types";
import { StudentDetailTabs } from "@/components/students/StudentDetailTabs";

export default function TeacherStudentDetailPage() {
  const params = useParams<{ classId: string; studentId: string }>();
  const { classId, studentId } = params;
  const { user } = useAuth();
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);

  useEffect(() => {
    if (!user || !studentId || !classId) return;
    let c = false;
    (async () => {
      const [allClasses, a, t] = await Promise.all([
        getClasses(user),
        getStudentAnalytics(user, studentId),
        getStudentTrends(user, studentId, classId),
      ]);
      if (!c) {
        setCls(allClasses.find((x) => x.id === classId) ?? null);
        setAnalytics(a);
        setTrends(t);
      }
    })();
    return () => {
      c = true;
    };
  }, [user, studentId, classId]);

  if (!analytics) {
    return (
      <div className="text-slate-500">
        <Link href={`/teacher/classes/${classId}`} className="text-sky-400">
          ← Back
        </Link>
        <p className="mt-4">Loading…</p>
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
        <Link href={`/teacher/classes/${classId}`} className="text-sky-400 hover:underline">
          {cls?.name ?? "Class"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-400">{analytics.displayName}</span>
      </div>
      <h1 className="mt-3 text-2xl font-semibold text-slate-100">{analytics.displayName}</h1>
      <p className="mt-1 text-sm text-slate-500">Student drill-down — performance, attendance, engagement, trends.</p>

      <div className="mt-8">
        <StudentDetailTabs analytics={analytics} trends={trends} />
      </div>
    </div>
  );
}
