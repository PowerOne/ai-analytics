"use client";

import type { ModernKpis } from "@/lib/modern-dashboard/types";
import { KPICard } from "@/components/modern/KPICard";

function fmtInt(v: number | null) {
  if (v == null) return "—";
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number | null) {
  if (v == null) return "—";
  return `${Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(v)}%`;
}

function fmtScore(v: number | null) {
  if (v == null) return "—";
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(v);
}

export function KPIGrid({ kpis }: { kpis: ModernKpis }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <KPICard title="Total Students" metric={fmtInt(kpis.totalStudents)} subtitle="Active enrollment snapshot" />
      <KPICard title="Avg Risk Index" metric={fmtScore(kpis.avgRiskIndex)} subtitle="Higher means more risk" />
      <KPICard title="Total Classes" metric={fmtInt(kpis.totalClasses)} subtitle="Classes included in analytics" />
      <KPICard title="Attendance Rate" metric={fmtPct(kpis.attendanceRate)} subtitle="Recent period attendance" />
      <KPICard title="Engagement Score" metric={fmtScore(kpis.engagementScore)} subtitle="LMS + activity composite" />
      <KPICard title="Assessment Score" metric={fmtScore(kpis.assessmentScore)} subtitle="Avg assessment performance" />
    </div>
  );
}
