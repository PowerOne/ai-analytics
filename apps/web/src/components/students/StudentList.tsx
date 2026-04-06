"use client";

import Link from "next/link";
import type { StudentRow } from "@/lib/types";
import { EngagementBar } from "@/components/risk/EngagementBar";
import { RiskBadge } from "@/components/risk/RiskBadge";

export function StudentList({
  students,
  baseHref,
}: {
  students: StudentRow[];
  /** e.g. `/teacher/classes/${classId}/students` */
  baseHref: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Grade</th>
            <th className="px-4 py-3">Risk</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Engagement</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-slate-800/40">
              <td className="px-4 py-3">
                <Link
                  href={`${baseHref}/${s.id}`}
                  className="font-medium text-sky-400 hover:underline"
                >
                  {s.displayName}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-400">{s.gradeLevel ?? "—"}</td>
              <td className="px-4 py-3">
                <RiskBadge level={s.riskLevel} />
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-300">
                {s.riskScore == null ? "—" : `${Math.round(s.riskScore)}`}
              </td>
              <td className="px-4 py-3">
                <EngagementBar value={s.engagementScore} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
