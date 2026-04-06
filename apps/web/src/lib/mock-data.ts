import type { ClassSummary, HeatmapCell, StudentAnalytics, StudentRow, TrendPoint } from "./types";

export const MOCK_CLASSES: ClassSummary[] = [
  {
    id: "class-1",
    name: "Algebra I — Period 3",
    sectionCode: "03",
    subject: { code: "MATH101", name: "Algebra I" },
    term: { label: "Fall 2025" },
  },
  {
    id: "class-2",
    name: "Biology — Period 2",
    sectionCode: "02",
    subject: { code: "BIO101", name: "Biology" },
    term: { label: "Fall 2025" },
  },
];

export const MOCK_STUDENTS_CLASS1: StudentRow[] = [
  {
    id: "stu-1",
    displayName: "Alex Rivera",
    gradeLevel: "9",
    riskScore: 72,
    riskLevel: "HIGH",
    engagementScore: 58,
  },
  {
    id: "stu-2",
    displayName: "Sam Chen",
    gradeLevel: "9",
    riskScore: 28,
    riskLevel: "LOW",
    engagementScore: 82,
  },
  {
    id: "stu-3",
    displayName: "Jordan Lee",
    gradeLevel: "9",
    riskScore: 48,
    riskLevel: "MEDIUM",
    engagementScore: 71,
  },
];

export const MOCK_HEATMAP: HeatmapCell[] = [
  { grade: "9", classLabel: "Algebra I P3", classId: "class-1", avgRisk: 62, studentCount: 28 },
  { grade: "9", classLabel: "Bio P2", classId: "class-2", avgRisk: 38, studentCount: 22 },
  { grade: "10", classLabel: "Geometry P1", classId: "class-3", avgRisk: 45, studentCount: 30 },
  { grade: "10", classLabel: "Chem P4", classId: "class-4", avgRisk: 55, studentCount: 26 },
];

export const MOCK_AT_RISK: StudentRow[] = [
  MOCK_STUDENTS_CLASS1[0],
  {
    id: "stu-x",
    displayName: "Casey Morgan",
    gradeLevel: "10",
    riskScore: 81,
    riskLevel: "HIGH",
    engagementScore: 42,
  },
];

export function mockStudentAnalytics(studentId: string): StudentAnalytics {
  const base: StudentAnalytics = {
    studentId,
    displayName: "Alex Rivera",
    performance: { avgScorePercent: 68, assessmentResultCount: 12 },
    attendance: { sessionsRecorded: 42, presentLikeSessions: 38, presentRate: 0.9 },
    engagement: { lmsEventCount: 156, avgEngagementScoreFromLms: 0.62 },
    ai: { riskScore: null, engagementScore: null, source: "Set by AI service when integrated" },
  };
  if (studentId === "stu-2") {
    return {
      ...base,
      displayName: "Sam Chen",
      performance: { avgScorePercent: 88, assessmentResultCount: 12 },
      attendance: { sessionsRecorded: 40, presentLikeSessions: 39, presentRate: 0.975 },
      engagement: { lmsEventCount: 210, avgEngagementScoreFromLms: 0.78 },
    };
  }
  return base;
}

export function mockTrends(_studentId: string, _classId: string): TrendPoint[] {
  return [
    { week: "W1", score: 72, attendance: 0.92, engagement: 65 },
    { week: "W2", score: 75, attendance: 0.88, engagement: 62 },
    { week: "W3", score: 70, attendance: 0.9, engagement: 58 },
    { week: "W4", score: 68, attendance: 0.91, engagement: 60 },
    { week: "W5", score: 74, attendance: 0.89, engagement: 64 },
  ];
}
