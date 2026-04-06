export type UserRole = "ADMIN" | "PRINCIPAL" | "TEACHER";

export interface SessionUser {
  email: string;
  role: UserRole;
  schoolId: string;
  token: string;
  teacherId?: string;
}

export interface ClassSummary {
  id: string;
  name: string;
  sectionCode?: string | null;
  subject?: { code: string; name: string };
  term?: { label: string };
}

export interface StudentRow {
  id: string;
  displayName: string;
  gradeLevel?: string | null;
  riskScore: number | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  engagementScore: number | null;
}

export interface HeatmapCell {
  grade: string;
  classLabel: string;
  classId: string;
  avgRisk: number;
  studentCount: number;
}

export interface StudentAnalytics {
  studentId: string;
  displayName: string;
  performance: { avgScorePercent: number | null; assessmentResultCount: number };
  attendance: {
    sessionsRecorded: number;
    presentLikeSessions: number;
    presentRate: number | null;
  };
  engagement: { lmsEventCount: number; avgEngagementScoreFromLms: number | null };
  ai: { riskScore: number | null; engagementScore: number | null; source: string };
}

export interface TrendPoint {
  week: string;
  score: number;
  attendance: number;
  engagement: number;
}
