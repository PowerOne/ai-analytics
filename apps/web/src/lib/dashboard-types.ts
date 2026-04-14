/** Types aligned with NestJS dashboards API responses */

export interface LmsHeatmapCell {
  date: string;
  count: number;
  eventTypes: Record<string, number>;
}

export interface AnalyticsTrendPoint {
  date: string;
  value: number;
}

export interface StudentAttentionSummary {
  studentId: string;
  name: string;
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  interventionsThisWeek: number;
  stability: number;
  riskEngineDelta: number;
  interventions: unknown[];
}

export interface ClassDashboardSummary {
  classId: string;
  name: string;
  thisWeek?: {
    weekStartDate: string;
    performance?: number | null;
    attendance?: number | null;
    engagement?: number | null;
    riskScore?: number | null;
  } | null;
  lastWeek?: {
    weekStartDate: string;
    performance?: number | null;
    attendance?: number | null;
    engagement?: number | null;
    riskScore?: number | null;
  } | null;
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  riskCompositeDelta: number;
}

export interface TeacherDashboardResponse {
  teacherId: string;
  classes: ClassDashboardSummary[];
  attentionStudents: StudentAttentionSummary[];
  interventionsThisWeek: number;
  heatmap: { daily: LmsHeatmapCell[]; weekly: LmsHeatmapCell[] };
  aiSummary?: string | null;
}

export interface SchoolTrendSummary {
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  highRiskNew: number;
  riskCompositeDelta: number;
}

export interface PrincipalCohortRow {
  cohortType: "GRADE" | "SUBJECT";
  cohortId: string;
  name: string;
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  risk: { low: number; medium: number; high: number; average: number };
  interventions: number;
}

export interface PrincipalDashboardResponse {
  schoolId: string;
  schoolTrends: SchoolTrendSummary;
  cohorts: PrincipalCohortRow[];
  interventions: { created: number; resolved: number; resolutionRate: number };
  heatmap: { daily: LmsHeatmapCell[]; weekly: LmsHeatmapCell[] };
  aiSummary?: string | null;
  schoolInterventions: unknown[];
}

export interface CohortDashboardResponse {
  cohortType: "GRADE" | "SUBJECT";
  cohortId: string;
  name: string;
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  risk: { low: number; medium: number; high: number; average: number };
  interventions: number;
  heatmap: { daily: LmsHeatmapCell[]; weekly: LmsHeatmapCell[] };
  aiSummary?: string | null;
}

export interface Student360DashboardResponse {
  studentId: string;
  identity: {
    displayName: string;
    givenName: string | null;
    familyName: string | null;
    gradeLevel: string | null;
    email: string | null;
  };
  classes: {
    id: string;
    name: string;
    subjectName: string;
    subjectCode: string;
    sectionCode: string | null;
    termLabel: string;
  }[];
  teachers: { id: string; name: string; email: string | null; subject: string | null }[];
  assessments: {
    id: string;
    assessmentId: string;
    title: string;
    scorePercent: number | null;
    submittedAt: string | null;
    className: string | null;
  }[];
  scoreTimeline: AnalyticsTrendPoint[];
  attendanceTimeline: AnalyticsTrendPoint[];
  submissionRate: number;
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  riskCompositeDelta: number;
  current: {
    performance: number;
    attendance: number;
    engagement: number;
    riskScore: number;
    riskTier: string;
  };
  riskEngine: {
    compositeRisk: number;
    category: "low" | "medium" | "high";
    reasons: string[];
  };
  riskEngineHistory: {
    composite: number | null;
    category: string | null;
    reasons: string[];
    stability: number | null;
    deltas: Record<string, unknown> | null;
  };
  interventionCount: number;
  interventions: unknown[];
  heatmap: { daily: LmsHeatmapCell[]; weekly: LmsHeatmapCell[] };
  aiSummary?: string | null;
}
