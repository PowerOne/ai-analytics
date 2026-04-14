export type PrincipalHeatmapCell = {
  date: string;
  count: number;
  eventTypes: Record<string, number>;
};

export type PrincipalSchoolTrends = {
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  highRiskNew: number;
  riskCompositeDelta: number;
};

export type PrincipalCohortRow = {
  cohortType: "GRADE" | "SUBJECT";
  cohortId: string;
  name: string;
  performanceDelta: number;
  attendanceDelta: number;
  engagementDelta: number;
  riskDelta: number;
  risk: { low: number; medium: number; high: number; average: number };
  interventions: number;
};

export type PrincipalInterventionsBlock = {
  created: number;
  resolved: number;
  resolutionRate: number;
};

export type PrincipalDashboardPayload = {
  schoolId: string;
  schoolTrends: PrincipalSchoolTrends;
  cohorts: PrincipalCohortRow[];
  interventions: PrincipalInterventionsBlock;
  heatmap: { daily: PrincipalHeatmapCell[]; weekly: PrincipalHeatmapCell[] };
  aiSummary?: string | null;
  schoolInterventions: unknown[];
};
