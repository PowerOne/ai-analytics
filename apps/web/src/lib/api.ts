/**
 * API client: base URL from getApiBase() (NEXT_PUBLIC_API_URL in browser; API_INTERNAL_URL on server in Docker).
 * Failures throw ApiError; 401 triggers global logout via emitUnauthorized.
 */

import { emitUnauthorized } from "./auth-events";
import { getApiBase } from "./api-base";
import type {
  CohortDashboardResponse,
  PrincipalAttEngContributorsParams,
  PrincipalAttEngContributorsResponse,
  PrincipalDashboardResponse,
  Student360DashboardResponse,
  TeacherDashboardResponse,
} from "./dashboard-types";
import type {
  ClassSummary,
  HeatmapCell,
  SessionUser,
  StudentAnalytics,
  StudentRow,
  StudentTrendChartRow,
} from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function handleStatus(res: Response, text: string): never {
  if (res.status === 401) emitUnauthorized();
  throw new ApiError(res.status, text || res.statusText);
}

async function fetchJson<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...init?.headers,
  };
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    handleStatus(res, text);
  }
  return res.json() as Promise<T>;
}

async function dashboardFetchJson<T>(path: string, token: string): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    handleStatus(res, text.slice(0, 500));
  }
  return res.json() as Promise<T>;
}

/** Principal school dashboard (`GET .../dashboards/principal`). Pass `SessionUser` or `(schoolId, token)`. */
export async function getPrincipalDashboard(
  schoolIdOrUser: string | SessionUser,
  token?: string,
): Promise<PrincipalDashboardResponse> {
  if (typeof schoolIdOrUser === "object" && schoolIdOrUser !== null && "schoolId" in schoolIdOrUser) {
    const u = schoolIdOrUser as SessionUser;
    return dashboardFetchJson<PrincipalDashboardResponse>(
      `/schools/${u.schoolId}/dashboards/principal`,
      u.token,
    );
  }
  if (typeof schoolIdOrUser !== "string" || token === undefined) {
    throw new TypeError("getPrincipalDashboard: pass SessionUser or (schoolId, token)");
  }
  return dashboardFetchJson<PrincipalDashboardResponse>(
    `/schools/${schoolIdOrUser}/dashboards/principal`,
    token,
  );
}

function riskLevelFromScore(score: number | null): StudentRow["riskLevel"] {
  if (score == null || !Number.isFinite(score)) return "UNKNOWN";
  if (score < 33) return "LOW";
  if (score <= 66) return "MEDIUM";
  return "HIGH";
}

export async function getClasses(user: SessionUser): Promise<ClassSummary[]> {
  const data = await fetchJson<
    { id: string; name: string; sectionCode: string | null; subject: object; term: object }[]
  >("/classes", user.token);
  return data as ClassSummary[];
}

type ClassAnalyticsStudent = {
  studentId: string;
  displayName: string;
  avgScorePercent: number | null;
  attendanceRate: number | null;
  riskScore: number | null;
  engagementScore: number | null;
};

export async function getClassStudentsForClass(
  user: SessionUser,
  classId: string,
): Promise<StudentRow[]> {
  const data = await fetchJson<{ students: ClassAnalyticsStudent[] }>(
    `/schools/${user.schoolId}/classes/${encodeURIComponent(classId)}/analytics`,
    user.token,
  );
  return data.students.map((s) => ({
    id: s.studentId,
    displayName: s.displayName,
    gradeLevel: null,
    riskScore: s.riskScore,
    riskLevel: riskLevelFromScore(s.riskScore),
    engagementScore: s.engagementScore,
  }));
}

export async function getStudentAnalytics(
  user: SessionUser,
  studentId: string,
): Promise<StudentAnalytics> {
  return fetchJson<StudentAnalytics>(`/students/${encodeURIComponent(studentId)}/analytics`, user.token);
}

type TimelinePoint = { date: string; value: number };

type StudentAnalyticsDetailResponse = {
  scoreTimeline: TimelinePoint[];
  attendanceTimeline: TimelinePoint[];
  engagementScore: number;
  submissionRate: number;
};

export async function getStudentTrendChart(
  user: SessionUser,
  studentId: string,
): Promise<StudentTrendChartRow[]> {
  const data = await fetchJson<StudentAnalyticsDetailResponse>(
    `/schools/${user.schoolId}/students/${encodeURIComponent(studentId)}/analytics`,
    user.token,
  );
  const byDate = new Map<string, StudentTrendChartRow>();
  const merge = (date: string, patch: Partial<StudentTrendChartRow>) => {
    const cur = byDate.get(date) ?? { name: date, score: null, attendancePct: null, engagement: null };
    byDate.set(date, { ...cur, ...patch, name: date });
  };
  for (const p of data.scoreTimeline) merge(p.date, { score: p.value });
  for (const p of data.attendanceTimeline)
    merge(p.date, { attendancePct: Math.round(p.value * 10_000) / 100 });
  const eng =
    data.engagementScore != null && Number.isFinite(data.engagementScore) ? data.engagementScore : null;
  const sorted = [...byDate.keys()].sort();
  return sorted.map((d) => {
    const row = byDate.get(d)!;
    return { ...row, engagement: eng };
  });
}

/**
 * KPIs from `PrincipalDashboardResponse` (same source as Risk & heatmap).
 * - avgRisk: cohort-count-weighted mean of cohort risk.average.
 * - totalStudents: sum of risk band counts on GRADE cohort rows only.
 * - classesCount: cohort snapshot row count (grade + subject).
 */
export function computeSchoolOverviewFromDashboard(dash: PrincipalDashboardResponse): {
  totalStudents: number;
  avgRisk: number;
  classesCount: number;
} {
  let weight = 0;
  let riskSum = 0;
  for (const c of dash.cohorts) {
    const n = c.risk.low + c.risk.medium + c.risk.high;
    if (n > 0) {
      riskSum += c.risk.average * n;
      weight += n;
    }
  }

  const totalStudents = dash.cohorts
    .filter((c) => c.cohortType === "GRADE")
    .reduce((s, c) => s + c.risk.low + c.risk.medium + c.risk.high, 0);

  const classesCount = dash.cohorts.length;

  return {
    totalStudents,
    avgRisk: weight === 0 ? 0 : riskSum / weight,
    classesCount,
  };
}

/** Cohort rows as Risk heatmap cells (same mapping as prior `getSchoolHeatmap`). */
export function mapDashboardToHeatmapCells(dash: PrincipalDashboardResponse): HeatmapCell[] {
  return dash.cohorts.map((c) => ({
    grade: c.cohortType === "GRADE" ? c.cohortId : "Subject",
    classLabel: c.name,
    classId: c.cohortId,
    avgRisk: c.risk.average,
    studentCount: c.risk.low + c.risk.medium + c.risk.high,
  }));
}

/**
 * Cohort snapshots ranked by average risk (desc). Uses `StudentRow` shape for existing tables;
 * `id` is stable `cohortType:cohortId`, `displayName` is the cohort label.
 */
export function mapDashboardToRankedRiskRows(dash: PrincipalDashboardResponse): StudentRow[] {
  const rows: StudentRow[] = dash.cohorts.map((c) => ({
    id: `${c.cohortType}:${c.cohortId}`,
    displayName: c.name,
    gradeLevel: c.cohortType === "GRADE" ? c.cohortId : null,
    riskScore: c.risk.average,
    riskLevel: riskLevelFromScore(c.risk.average),
    engagementScore: null,
  }));
  rows.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
  return rows;
}

export async function getSchoolOverview(user: SessionUser): Promise<{
  totalStudents: number;
  avgRisk: number;
  classesCount: number;
}> {
  const dash = await getPrincipalDashboard(user);
  return computeSchoolOverviewFromDashboard(dash);
}

export async function getSchoolHeatmap(user: SessionUser): Promise<HeatmapCell[]> {
  const dash = await getPrincipalDashboard(user);
  return mapDashboardToHeatmapCells(dash);
}

export async function getTopAtRisk(user: SessionUser): Promise<StudentRow[]> {
  const dash = await getPrincipalDashboard(user);
  return mapDashboardToRankedRiskRows(dash);
}

export async function getTeacherDashboard(
  schoolId: string,
  teacherId: string,
  token: string,
): Promise<TeacherDashboardResponse> {
  return dashboardFetchJson<TeacherDashboardResponse>(
    `/schools/${schoolId}/dashboards/teacher/${teacherId}`,
    token,
  );
}

export async function fetchPrincipalAttEngContributors(
  schoolId: string,
  params: PrincipalAttEngContributorsParams,
): Promise<PrincipalAttEngContributorsResponse> {
  const { token, bucketType, bucketKey, metric, limit } = params;
  const q = new URLSearchParams();
  q.set("bucketType", bucketType);
  q.set("bucketKey", bucketKey);
  q.set("metric", metric);
  if (limit != null) q.set("limit", String(limit));
  const path = `/schools/${schoolId}/dashboards/principal/attendance-engagement/contributors?${q.toString()}`;
  return dashboardFetchJson<PrincipalAttEngContributorsResponse>(path, token);
}

export async function getCohortDashboard(
  schoolId: string,
  type: "grade" | "subject",
  id: string,
  token: string,
): Promise<CohortDashboardResponse> {
  const segment = type === "grade" ? `grades/${encodeURIComponent(id)}` : `subjects/${id}`;
  return dashboardFetchJson<CohortDashboardResponse>(
    `/schools/${schoolId}/dashboards/cohorts/${segment}`,
    token,
  );
}

export async function getStudent360(
  schoolId: string,
  studentId: string,
  token: string,
): Promise<Student360DashboardResponse> {
  return dashboardFetchJson<Student360DashboardResponse>(
    `/schools/${schoolId}/dashboards/students/${studentId}`,
    token,
  );
}
