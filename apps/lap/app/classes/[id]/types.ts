export type Class360TrendPoint = { date: string; value: number };

export type Class360WeeklySnapshot = {
  weekStartDate: string;
  performance: number | null;
  attendance: number | null;
  engagement: number | null;
  riskScore: number | null;
  riskComposite: number | null;
  riskCategory: string | null;
} | null;

export type Class360Payload = {
  classInfo: {
    id: string;
    name: string;
    sectionCode: string | null;
    room: string | null;
  };
  teacher: { id: string; name: string; email: string | null } | null;
  subject: { id: string; code: string; name: string };
  term: { id: string; label: string; startsOn: string; endsOn: string };
  students: {
    id: string;
    displayName: string;
    gradeLevel: string | null;
    riskScore: number | null;
  }[];
  studentCount: number;
  averageScore: number;
  submissionRate: number;
  scoreTrend: Class360TrendPoint[];
  riskSummary: {
    liveOverall: number;
    liveLevel: string;
    liveEngagementRisk: number;
    liveAttendanceRisk: number;
    livePerformanceRisk: number;
    averageEngineRisk: number;
    studentsLow: number;
    studentsMedium: number;
    studentsHigh: number;
    snapshotThisWeek: Class360WeeklySnapshot;
    snapshotLastWeek: Class360WeeklySnapshot;
    deltas: {
      performance: number;
      attendance: number;
      engagement: number;
      risk: number;
      riskComposite: number;
    };
  };
  attendanceSummary: {
    currentRate: number;
    snapshotThisWeek: number | null;
    snapshotLastWeek: number | null;
    delta: number;
  };
  engagementSummary: {
    currentScore: number;
    snapshotThisWeek: number | null;
    snapshotLastWeek: number | null;
    delta: number;
  };
};
