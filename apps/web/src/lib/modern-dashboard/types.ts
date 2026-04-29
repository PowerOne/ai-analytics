export type ModernApiError = {
  status: number;
  message: string;
};

export type ModernKpis = {
  totalStudents: number | null;
  avgRiskIndex: number | null; // 0..100 (preferred) or 0..1 (handled by formatter)
  totalClasses: number | null;
  attendanceRate: number | null; // 0..1 or 0..100 (handled by formatter)
  engagementScore: number | null; // 0..100 (or 0..1)
  assessmentScore: number | null; // 0..100 (or 0..1)
};

export type RiskTrendPoint = {
  weekLabel: string; // e.g. "W-5", "Mar 04"
  avgRisk: number;
};

export type RiskDistributionRow = {
  band: "Low" | "Medium" | "High" | "Unknown";
  count: number;
};

export type CohortComparisonRow = {
  cohort: string;
  riskAvg: number | null;
  attendance: number | null;
  engagement: number | null;
};

export type SubjectPerformanceRadarRow = {
  subject: string;
  assessment: number | null;
  engagement: number | null;
  attendance: number | null;
};

export type AttendanceHeatmapCell = {
  day: string; // Mon..Sun
  hour: string; // "08", "09", ...
  value: number; // 0..1 or 0..100
};

export type EngagementTrendPoint = {
  weekLabel: string;
  engagement: number;
};

export type AtRiskStudentRow = {
  id: string;
  name: string;
  grade?: string | null;
  riskIndex: number | null;
  attendanceRate: number | null;
  engagementScore: number | null;
  lastIntervention?: string | null;
};

export type CohortSummaryRow = {
  cohort: string;
  students: number | null;
  avgRiskIndex: number | null;
  attendanceRate: number | null;
  engagementScore: number | null;
  assessmentScore: number | null;
};

export type InterventionAlertRow = {
  id: string;
  severity: "Low" | "Medium" | "High";
  title: string;
  description: string;
  cohort?: string | null;
  createdAt?: string | null;
};

/**
 * Raw endpoint payloads are intentionally typed as unknown-ish to avoid contract drift.
 * We normalize for UI with resilient mapping functions in api.ts.
 */
export type SchoolDashboardResponse = Record<string, unknown>;
export type SchoolIntelligenceResponse = Record<string, unknown>;
export type SchoolRiskResponse = Record<string, unknown>;
export type SchoolHeatmapResponse = Record<string, unknown>;

export type SchoolOverviewViewModel = {
  kpis: ModernKpis;
  riskTrend: RiskTrendPoint[];
  riskDistribution: RiskDistributionRow[];
  cohortComparison: CohortComparisonRow[];
  subjectRadar: SubjectPerformanceRadarRow[];
  attendanceHeatmap: AttendanceHeatmapCell[];
  engagementTrend: EngagementTrendPoint[];
  topAtRiskStudents: AtRiskStudentRow[];
  cohortSummary: CohortSummaryRow[];
  interventionAlerts: InterventionAlertRow[];
};
