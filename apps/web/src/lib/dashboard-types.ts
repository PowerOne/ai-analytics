/** Types aligned with NestJS dashboards API responses */

export interface LmsHeatmapCell {
  date: string;
  count: number;
  eventTypes: Record<string, number>;
}

export interface StudentAttentionSummary {
  studentId: string;
  name: string;
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  interventionsThisWeek: number;
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
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  current: {
    performance: number;
    attendance: number;
    engagement: number;
    riskScore: number;
    riskTier: string;
  };
  interventions: number;
  heatmap: { daily: LmsHeatmapCell[]; weekly: LmsHeatmapCell[] };
  aiSummary?: string | null;
}
