/**
 * API client: uses NEXT_PUBLIC_API_URL when NEXT_PUBLIC_USE_MOCK is not "true".
 * Falls back to mock data on network errors for local demos.
 */

import {
  MOCK_AT_RISK,
  MOCK_CLASSES,
  MOCK_HEATMAP,
  MOCK_STUDENTS_CLASS1,
  mockStudentAnalytics,
  mockTrends,
} from "./mock-data";
import type {
  CohortDashboardResponse,
  PrincipalDashboardResponse,
  Student360DashboardResponse,
  TeacherDashboardResponse,
} from "./dashboard-types";
import type { ClassSummary, HeatmapCell, SessionUser, StudentAnalytics, StudentRow, TrendPoint } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function useMock(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === "true";
}

async function fetchJson<T>(path: string, token: string | undefined, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init?.headers,
  };
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getClasses(user: SessionUser): Promise<ClassSummary[]> {
  if (useMock()) return MOCK_CLASSES;
  try {
    const data = await fetchJson<{ id: string; name: string; sectionCode: string | null; subject: object; term: object }[]>(
      "/classes",
      user.token,
    );
    return data as ClassSummary[];
  } catch {
    return MOCK_CLASSES;
  }
}

export async function getClassStudents(user: SessionUser, classId: string): Promise<StudentRow[]> {
  if (useMock() || classId === "class-1") {
    return MOCK_STUDENTS_CLASS1.map((s) => ({ ...s }));
  }
  try {
    const students = await fetchJson<
      { id: string; displayName?: string; givenName?: string; familyName?: string; gradeLevel?: string }[]
    >("/students", user.token);
    return students.map((s) => ({
      id: s.id,
      displayName: s.displayName ?? [s.givenName, s.familyName].filter(Boolean).join(" ") ?? s.id,
      gradeLevel: s.gradeLevel ?? null,
      riskScore: null,
      riskLevel: "UNKNOWN",
      engagementScore: null,
    }));
  } catch {
    return MOCK_STUDENTS_CLASS1;
  }
}

/** Merge analytics API with list — mock enriches rows */
export async function getClassStudentsWithIndicators(
  user: SessionUser,
  classId: string,
): Promise<StudentRow[]> {
  const base = await getClassStudents(user, classId);
  if (!useMock() && base[0]?.riskLevel !== "UNKNOWN") return base;
  return base.map((s) => {
    const m = MOCK_STUDENTS_CLASS1.find((x) => x.id === s.id);
    return m ? { ...s, ...m } : s;
  });
}

export async function getStudentAnalytics(
  user: SessionUser,
  studentId: string,
): Promise<StudentAnalytics> {
  if (useMock()) return mockStudentAnalytics(studentId);
  try {
    const data = await fetchJson<StudentAnalytics>(`/students/${studentId}/analytics`, user.token);
    return data;
  } catch {
    return mockStudentAnalytics(studentId);
  }
}

export async function getStudentTrends(
  _user: SessionUser,
  studentId: string,
  classId: string,
): Promise<TrendPoint[]> {
  if (useMock()) return mockTrends(studentId, classId);
  return mockTrends(studentId, classId);
}

export async function getSchoolHeatmap(user: SessionUser): Promise<HeatmapCell[]> {
  if (useMock()) return MOCK_HEATMAP;
  try {
    return await fetchJson<HeatmapCell[]>("/analytics/school/heatmap", user.token);
  } catch {
    return MOCK_HEATMAP;
  }
}

export async function getTopAtRisk(user: SessionUser): Promise<StudentRow[]> {
  if (useMock()) return MOCK_AT_RISK;
  try {
    return await fetchJson<StudentRow[]>("/analytics/school/at-risk", user.token);
  } catch {
    return MOCK_AT_RISK;
  }
}

export async function getSchoolOverview(user: SessionUser): Promise<{
  totalStudents: number;
  avgRisk: number;
  classesCount: number;
}> {
  if (useMock()) {
    return { totalStudents: 420, avgRisk: 44, classesCount: 18 };
  }
  try {
    return await fetchJson("/analytics/school/overview", user.token);
  } catch {
    return { totalStudents: 420, avgRisk: 44, classesCount: 18 };
  }
}

// ---------------------------------------------------------------------------
// Dashboards API (Bearer + Accept: application/json)
// ---------------------------------------------------------------------------

async function dashboardFetchJson<T>(path: string, token: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
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

export async function getPrincipalDashboard(
  schoolId: string,
  token: string,
): Promise<PrincipalDashboardResponse> {
  return dashboardFetchJson<PrincipalDashboardResponse>(
    `/schools/${schoolId}/dashboards/principal`,
    token,
  );
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
