"use client";

import type { CohortSummaryRow } from "@/lib/modern-dashboard/types";
import { Card } from "@/components/modern/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/modern/ui/table";

function fmtInt(v: number | null) {
  if (v == null) return "—";
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number | null) {
  if (v == null) return "—";
  return `${Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(v)}%`;
}

export function CohortSummaryTable({ rows }: { rows: CohortSummaryRow[] }) {
  return (
    <Card className="p-5">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cohort Summary</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Cohort-level KPIs</p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cohort</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Avg Risk</TableHead>
              <TableHead className="text-right">Attendance</TableHead>
              <TableHead className="text-right">Engagement</TableHead>
              <TableHead className="text-right">Assessment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 12).map((r) => (
              <TableRow key={r.cohort}>
                <TableCell className="font-medium">{r.cohort}</TableCell>
                <TableCell className="text-right">{fmtInt(r.students)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.avgRiskIndex)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.attendanceRate)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.engagementScore)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.assessmentScore)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
