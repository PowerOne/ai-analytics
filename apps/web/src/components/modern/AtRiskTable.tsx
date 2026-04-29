"use client";

import type { AtRiskStudentRow } from "@/lib/modern-dashboard/types";
import { Card } from "@/components/modern/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/modern/ui/table";

function fmtPct(v: number | null) {
  if (v == null) return "—";
  return `${Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(v)}%`;
}

export function AtRiskTable({ rows }: { rows: AtRiskStudentRow[] }) {
  return (
    <Card className="p-5">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top At-Risk Students</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Prioritize interventions by risk index</p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead className="text-right">Risk</TableHead>
              <TableHead className="text-right">Attendance</TableHead>
              <TableHead className="text-right">Engagement</TableHead>
              <TableHead>Last intervention</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 10).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.grade ?? "—"}</TableCell>
                <TableCell className="text-right">{fmtPct(r.riskIndex)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.attendanceRate)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.engagementScore)}</TableCell>
                <TableCell className="max-w-[240px] truncate text-slate-500 dark:text-slate-400">
                  {r.lastIntervention ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
