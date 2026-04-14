export type Student360HeatmapCell = {
  date: string;
  count: number;
  eventTypes: Record<string, number>;
};

export type Student360TrendPoint = {
  date: string;
  value: number;
};

export type Student360Payload = {
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
  scoreTimeline: Student360TrendPoint[];
  attendanceTimeline: Student360TrendPoint[];
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
  heatmap: { daily: Student360HeatmapCell[]; weekly: Student360HeatmapCell[] };
  aiSummary?: string | null;
};
