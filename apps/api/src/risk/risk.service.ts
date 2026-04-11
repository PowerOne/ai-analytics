import { Injectable } from "@nestjs/common";
import { AnalyticsService } from "../analytics/analytics.service";
import type { JwtPayload } from "../common/types/jwt-payload";
import type { ClassRiskResponse } from "./dto/class-risk.dto";
import type { StudentRiskResponse } from "./dto/student-risk.dto";
import { RiskLevel } from "./dto/risk-level.enum";

import { RiskEngineService } from "./risk-engine.service";
import { RiskInput, RiskOutput } from "./risk-engine.types";

const WEIGHT_ENGAGEMENT = 0.4;
const WEIGHT_ATTENDANCE = 0.3;
const WEIGHT_PERFORMANCE = 0.3;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Whole-number score in [0, 100]. */
function toScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(clamp(n, 0, 100));
}

/**
 * Inverse of engagement: higher LMS engagement → lower risk.
 * Supports 0–1 scale (typical) or 0–5 style from spec `100 - score * 20`.
 */
export function engagementRiskFromScore(engagementScore: number): number {
  if (!Number.isFinite(engagementScore) || engagementScore < 0) return 0;
  if (engagementScore <= 1) {
    return toScore((1 - clamp(engagementScore, 0, 1)) * 100);
  }
  return toScore(100 - engagementScore * 20);
}

/** Class: performance risk from average percent score (0–100). */
export function classPerformanceRisk(averageScore: number): number {
  if (!Number.isFinite(averageScore)) return 0;
  return toScore(100 - clamp(averageScore, 0, 100));
}

/** Class: attendance risk from rate in [0, 1]. */
export function classAttendanceRisk(attendanceRate: number): number {
  if (!Number.isFinite(attendanceRate)) return 0;
  return toScore((1 - clamp(attendanceRate, 0, 1)) * 100);
}

function averageTrendValues(values: { value: number }[]): number {
  if (!values.length) return 0;
  const sum = values.reduce((s, p) => s + (Number.isFinite(p.value) ? p.value : 0), 0);
  return sum / values.length;
}

/** Student: performance risk from mean daily score (0–100 scale). */
export function studentPerformanceRiskFromTimeline(avgScorePercent: number): number {
  if (!Number.isFinite(avgScorePercent) || avgScorePercent <= 0) return 0;
  return toScore(100 - clamp(avgScorePercent, 0, 100));
}

/** Student: attendance risk from mean daily attendance rate (0–1 per day). */
export function studentAttendanceRiskFromTimeline(avgAttendanceRate: number): number {
  if (!Number.isFinite(avgAttendanceRate)) return 0;
  return toScore((1 - clamp(avgAttendanceRate, 0, 1)) * 100);
}

export function weightedOverall(
  engagement: number,
  attendance: number,
  performance: number,
): number {
  return toScore(
    WEIGHT_ENGAGEMENT * engagement +
      WEIGHT_ATTENDANCE * attendance +
      WEIGHT_PERFORMANCE * performance,
  );
}

export function riskLevelFromOverall(overall: number): RiskLevel {
  if (!Number.isFinite(overall)) return RiskLevel.LOW;
  if (overall < 33) return RiskLevel.LOW;
  if (overall <= 66) return RiskLevel.MEDIUM;
  return RiskLevel.HIGH;
}

@Injectable()
export class RiskService {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly riskEngine: RiskEngineService,
  ) {}

  /** NEW: Risk Engine wrapper */
  getStudentRiskEngine(input: RiskInput): RiskOutput {
    return this.riskEngine.computeRisk(input);
  }

  /** NEW: Class-level risk aggregation using the Risk Engine */
  getClassRiskEngine(students: RiskInput[]) {
    if (!students.length) {
      return {
        classRisk: 0,
        distribution: { low: 0, medium: 0, high: 0 },
        studentRisks: [],
      };
    }

    const studentRisks = students.map((s) => {
      const result = this.riskEngine.computeRisk(s);
      return {
        studentId: s.studentId,
        compositeRisk: result.compositeRisk,
        category: result.category,
        reasons: result.reasons,
      };
    });

    const total = studentRisks.reduce((sum, r) => sum + r.compositeRisk, 0);
    const classRisk = Math.round(total / studentRisks.length);

    const distribution = {
      low: studentRisks.filter((r) => r.category === "low").length,
      medium: studentRisks.filter((r) => r.category === "medium").length,
      high: studentRisks.filter((r) => r.category === "high").length,
    };

    return {
      classRisk,
      distribution,
      studentRisks,
    };
  }

  async getClassRisk(
    _schoolId: string,
    classId: string,
    user: JwtPayload,
  ): Promise<ClassRiskResponse> {
    const a = await this.analytics.getClassAnalytics(classId, user);

    const engagement = engagementRiskFromScore(a.engagementScore ?? 0);
    const attendance = classAttendanceRisk(a.attendanceRate ?? 0);
    const performance = classPerformanceRisk(a.averageScore ?? 0);

    const overall = weightedOverall(engagement, attendance, performance);

    return {
      engagement,
      attendance,
      performance,
      overall,
      level: riskLevelFromOverall(overall),
    };
  }

  async getStudentRisk(
    _schoolId: string,
    studentId: string,
    user: JwtPayload,
  ): Promise<StudentRiskResponse> {
    const a = await this.analytics.getStudentAnalytics(studentId, user);

    const engagement = engagementRiskFromScore(a.engagementScore ?? 0);

    const avgAtt = averageTrendValues(a.attendanceTimeline ?? []);
    const attendance = studentAttendanceRiskFromTimeline(avgAtt);

    const avgScore = averageTrendValues(a.scoreTimeline ?? []);
    const performance = studentPerformanceRiskFromTimeline(avgScore);

    const overall = weightedOverall(engagement, attendance, performance);

    return {
      engagement,
      attendance,
      performance,
      overall,
      level: riskLevelFromOverall(overall),
    };
  }
}
