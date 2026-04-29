"use client";

import { useEffect, useMemo, useState } from "react";
import { emitUnauthorized } from "@/lib/auth-events";
import { getApiBase } from "@/lib/api-base";
import type { SessionUser } from "@/lib/types";
import type {
  AtRiskStudentRow,
  AttendanceHeatmapCell,
  CohortComparisonRow,
  CohortSummaryRow,
  EngagementTrendPoint,
  InterventionAlertRow,
  ModernApiError,
  ModernKpis,
  RiskDistributionRow,
  RiskTrendPoint,
  SchoolDashboardResponse,
  SchoolHeatmapResponse,
  SchoolIntelligenceResponse,
  SchoolOverviewViewModel,
  SchoolRiskResponse,
  SubjectPerformanceRadarRow,
} from "./types";

class ModernDashboardApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ModernDashboardApiError";
  }
}

function normalizeError(e: unknown): ModernApiError {
  if (e instanceof ModernDashboardApiError) return { status: e.status, message: e.message };
  if (e instanceof Error) return { status: 0, message: e.message };
  return { status: 0, message: "Unexpected error" };
}

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) emitUnauthorized();
    const text = await res.text();
    throw new ModernDashboardApiError(res.status, (text || res.statusText).slice(0, 500));
  }
  return res.json() as Promise<T>;
}

// ============
// Typed fetches
// ============

export async function getSchoolDashboard(schoolId: string, token: string): Promise<SchoolDashboardResponse> {
  return fetchJson<SchoolDashboardResponse>(`/dashboards/school/${encodeURIComponent(schoolId)}`, token);
}

export async function getSchoolIntelligence(
  schoolId: string,
  token: string,
): Promise<SchoolIntelligenceResponse> {
  return fetchJson<SchoolIntelligenceResponse>(
    `/dashboards/school/${encodeURIComponent(schoolId)}/intelligence`,
    token,
  );
}

export async function getSchoolRisk(schoolId: string, token: string): Promise<SchoolRiskResponse> {
  return fetchJson<SchoolRiskResponse>(`/dashboards/school/${encodeURIComponent(schoolId)}/risk`, token);
}

export async function getSchoolHeatmap(schoolId: string, token: string): Promise<SchoolHeatmapResponse> {
  return fetchJson<SchoolHeatmapResponse>(`/dashboards/school/${encodeURIComponent(schoolId)}/heatmap`, token);
}

// ==========================
// Resilient normalization
// ==========================

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function clamp01or100(v: number | null): number | null {
  if (v == null) return null;
  // accept either 0..1 or 0..100; normalize to 0..100 for UI
  if (v <= 1) return Math.max(0, Math.min(1, v)) * 100;
  return Math.max(0, Math.min(100, v));
}

function pickKpis(dashboard: SchoolDashboardResponse, intelligence: SchoolIntelligenceResponse): ModernKpis {
  const d = dashboard as Record<string, unknown>;
  const i = intelligence as Record<string, unknown>;

  // try common keys; fall back to nulls (UI renders placeholders)
  const totalStudents = num(d.totalStudents ?? d.studentsTotal ?? d.studentCount ?? d.total_students);
  const totalClasses = num(d.totalClasses ?? d.classesTotal ?? d.classCount ?? d.total_classes);

  const avgRiskIndex = num(d.avgRiskIndex ?? d.avgRisk ?? d.riskIndex ?? (d.risk as any)?.average ?? d.riskAverage);
  const attendanceRate = num(d.attendanceRate ?? d.attendance ?? i.attendanceRate ?? (i.attendance as any)?.rate);
  const engagementScore = num(d.engagementScore ?? d.engagement ?? i.engagementScore ?? (i.engagement as any)?.score);
  const assessmentScore = num(d.assessmentScore ?? d.assessment ?? i.assessmentScore ?? (i.assessment as any)?.score);

  return {
    totalStudents,
    avgRiskIndex: clamp01or100(avgRiskIndex),
    totalClasses,
    attendanceRate: clamp01or100(attendanceRate),
    engagementScore: clamp01or100(engagementScore),
    assessmentScore: clamp01or100(assessmentScore),
  };
}

function pickRiskTrend(risk: SchoolRiskResponse): RiskTrendPoint[] {
  const r = risk as Record<string, unknown>;
  const points = asArray(r.trend ?? r.riskTrend ?? r.weeklyTrend ?? r.last6Weeks ?? r.weeks);
  const mapped = points
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      const label = str(o.weekLabel ?? o.week ?? o.label ?? o.date) ?? "";
      const value = num(o.avgRisk ?? o.risk ?? o.value ?? o.riskIndex);
      return label && value != null
        ? ({ weekLabel: label, avgRisk: clamp01or100(value) ?? value } as RiskTrendPoint)
        : null;
    })
    .filter(Boolean) as RiskTrendPoint[];

  // enforce last 6 (UI requirement)
  return mapped.slice(Math.max(0, mapped.length - 6));
}

function pickRiskDistribution(risk: SchoolRiskResponse): RiskDistributionRow[] {
  const r = risk as Record<string, unknown>;
  const rows = asArray(r.distribution ?? r.riskDistribution ?? r.bands);

  const mapped = rows
    .map((row) => {
      const o = (row ?? {}) as Record<string, unknown>;
      const bandRaw = str(o.band ?? o.level ?? o.name) ?? "";
      const count = num(o.count ?? o.value ?? o.students) ?? 0;
      const band =
        bandRaw.toLowerCase().includes("low")
          ? "Low"
          : bandRaw.toLowerCase().includes("med")
            ? "Medium"
            : bandRaw.toLowerCase().includes("high")
              ? "High"
              : "Unknown";
      return { band, count } satisfies RiskDistributionRow;
    })
    .filter((x) => x.count >= 0);

  // ensure all bands present (stable chart legend)
  const byBand = new Map(mapped.map((m) => [m.band, m]));
  return (["Low", "Medium", "High", "Unknown"] as const).map((b) => byBand.get(b) ?? { band: b, count: 0 });
}

function pickCohortComparison(dashboard: SchoolDashboardResponse): CohortComparisonRow[] {
  const d = dashboard as Record<string, unknown>;
  const cohorts = asArray(d.cohorts ?? d.cohortSummary ?? d.cohortComparison);
  return cohorts
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const cohort = str(o.name ?? o.cohort ?? o.label) ?? null;
      if (!cohort) return null;
      return {
        cohort,
        riskAvg: clamp01or100(num(o.avgRisk ?? o.riskAvg ?? o.risk ?? o.riskIndex)),
        attendance: clamp01or100(num(o.attendanceRate ?? o.attendance ?? o.attendancePct)),
        engagement: clamp01or100(num(o.engagementScore ?? o.engagement ?? o.engagementPct)),
      } satisfies CohortComparisonRow;
    })
    .filter(Boolean) as CohortComparisonRow[];
}

function pickSubjectRadar(intelligence: SchoolIntelligenceResponse): SubjectPerformanceRadarRow[] {
  const i = intelligence as Record<string, unknown>;
  const subjects = asArray(i.subjects ?? i.subjectPerformance ?? i.radar ?? i.subjectsRadar);
  return subjects
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const subject = str(o.subject ?? o.name ?? o.label) ?? null;
      if (!subject) return null;
      return {
        subject,
        assessment: clamp01or100(num(o.assessment ?? o.assessmentScore ?? o.score)),
        engagement: clamp01or100(num(o.engagement ?? o.engagementScore)),
        attendance: clamp01or100(num(o.attendance ?? o.attendanceRate)),
      } satisfies SubjectPerformanceRadarRow;
    })
    .filter(Boolean) as SubjectPerformanceRadarRow[];
}

function pickAttendanceHeatmap(heatmap: SchoolHeatmapResponse): AttendanceHeatmapCell[] {
  const h = heatmap as Record<string, unknown>;
  const cells = asArray(h.cells ?? h.heatmap ?? h.attendance ?? h.data);
  return cells
    .map((cell) => {
      const o = (cell ?? {}) as Record<string, unknown>;
      const day = str(o.day ?? o.d) ?? null;
      const hour = str(o.hour ?? o.h) ?? null;
      const value = clamp01or100(num(o.value ?? o.v));
      if (!day || !hour || value == null) return null;
      return { day, hour, value } satisfies AttendanceHeatmapCell;
    })
    .filter(Boolean) as AttendanceHeatmapCell[];
}

function pickEngagementTrend(intelligence: SchoolIntelligenceResponse): EngagementTrendPoint[] {
  const i = intelligence as Record<string, unknown>;
  const pts = asArray(i.engagementTrend ?? i.engagementTimeline ?? (i.engagement as any)?.trend ?? i.trend);
  const mapped = pts
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      const label = str(o.weekLabel ?? o.week ?? o.label ?? o.date) ?? "";
      const value = clamp01or100(num(o.value ?? o.engagement ?? o.score));
      return label && value != null ? ({ weekLabel: label, engagement: value } as EngagementTrendPoint) : null;
    })
    .filter(Boolean) as EngagementTrendPoint[];
  return mapped.slice(Math.max(0, mapped.length - 6));
}

function pickTopAtRisk(risk: SchoolRiskResponse): AtRiskStudentRow[] {
  const r = risk as Record<string, unknown>;
  const rows = asArray(r.topAtRiskStudents ?? r.atRisk ?? r.students ?? r.topStudents);
  return rows
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const id = str(o.id ?? o.studentId) ?? null;
      const name = str(o.name ?? o.displayName ?? o.studentName) ?? null;
      if (!id || !name) return null;
      return {
        id,
        name,
        grade: str(o.grade ?? o.gradeLevel) ?? null,
        riskIndex: clamp01or100(num(o.riskIndex ?? o.risk ?? o.riskScore)),
        attendanceRate: clamp01or100(num(o.attendanceRate ?? o.attendance)),
        engagementScore: clamp01or100(num(o.engagementScore ?? o.engagement)),
        lastIntervention: str(o.lastIntervention ?? o.intervention) ?? null,
      } satisfies AtRiskStudentRow;
    })
    .filter(Boolean) as AtRiskStudentRow[];
}

function pickCohortSummary(dashboard: SchoolDashboardResponse): CohortSummaryRow[] {
  const d = dashboard as Record<string, unknown>;
  const rows = asArray(d.cohortSummary ?? d.cohorts ?? d.cohortRows);
  return rows
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const cohort = str(o.cohort ?? o.name ?? o.label) ?? null;
      if (!cohort) return null;
      return {
        cohort,
        students: num(o.students ?? o.studentCount ?? o.count),
        avgRiskIndex: clamp01or100(num(o.avgRiskIndex ?? o.avgRisk ?? o.riskIndex ?? (o.risk as any)?.average)),
        attendanceRate: clamp01or100(num(o.attendanceRate ?? o.attendance)),
        engagementScore: clamp01or100(num(o.engagementScore ?? o.engagement)),
        assessmentScore: clamp01or100(num(o.assessmentScore ?? o.assessment)),
      } satisfies CohortSummaryRow;
    })
    .filter(Boolean) as CohortSummaryRow[];
}

function pickInterventionAlerts(intelligence: SchoolIntelligenceResponse): InterventionAlertRow[] {
  const i = intelligence as Record<string, unknown>;
  const rows = asArray(i.interventionAlerts ?? i.alerts ?? i.interventions);
  return rows
    .map((a) => {
      const o = (a ?? {}) as Record<string, unknown>;
      const id = str(o.id ?? o.alertId) ?? null;
      const title = str(o.title ?? o.name) ?? null;
      if (!id || !title) return null;
      const sevRaw = (str(o.severity ?? o.level) ?? "Medium").toLowerCase();
      const severity = sevRaw.includes("high") ? "High" : sevRaw.includes("low") ? "Low" : "Medium";
      return {
        id,
        severity,
        title,
        description: str(o.description ?? o.message) ?? "",
        cohort: str(o.cohort ?? o.group) ?? null,
        createdAt: str(o.createdAt ?? o.created_at ?? o.timestamp) ?? null,
      } satisfies InterventionAlertRow;
    })
    .filter(Boolean) as InterventionAlertRow[];
}

export function buildSchoolOverviewViewModel(args: {
  dashboard: SchoolDashboardResponse;
  intelligence: SchoolIntelligenceResponse;
  risk: SchoolRiskResponse;
  heatmap: SchoolHeatmapResponse;
}): SchoolOverviewViewModel {
  const { dashboard, intelligence, risk, heatmap } = args;
  return {
    kpis: pickKpis(dashboard, intelligence),
    riskTrend: pickRiskTrend(risk),
    riskDistribution: pickRiskDistribution(risk),
    cohortComparison: pickCohortComparison(dashboard),
    subjectRadar: pickSubjectRadar(intelligence),
    attendanceHeatmap: pickAttendanceHeatmap(heatmap),
    engagementTrend: pickEngagementTrend(intelligence),
    topAtRiskStudents: pickTopAtRisk(risk),
    cohortSummary: pickCohortSummary(dashboard),
    interventionAlerts: pickInterventionAlerts(intelligence),
  };
}

// ==========================
// Loading + error (client hook)
// ==========================

export function useSchoolOverviewData(user: SessionUser | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ModernApiError | null>(null);
  const [data, setData] = useState<SchoolOverviewViewModel | null>(null);

  const key = useMemo(() => (user ? `${user.schoolId}:${user.token.slice(0, 8)}` : "anon"), [user]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const [dashboard, intelligence, risk, heatmap] = await Promise.all([
          getSchoolDashboard(user.schoolId, user.token),
          getSchoolIntelligence(user.schoolId, user.token),
          getSchoolRisk(user.schoolId, user.token),
          getSchoolHeatmap(user.schoolId, user.token),
        ]);
        if (cancelled) return;
        setData(buildSchoolOverviewViewModel({ dashboard, intelligence, risk, heatmap }));
      } catch (e) {
        if (cancelled) return;
        setError(normalizeError(e));
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [key, user]);

  return { loading, error, data };
}
