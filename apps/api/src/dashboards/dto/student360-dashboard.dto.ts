import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TrendPoint } from "../../analytics/dto/common.dto";
import { HeatmapCell } from "../../lms-heatmaps/dto/heatmap-cell.dto";

export class Student360IdentityDto {
  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  givenName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  familyName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  gradeLevel!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;
}

export class Student360ClassDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  subjectName!: string;

  @ApiProperty()
  subjectCode!: string;

  @ApiPropertyOptional({ nullable: true })
  sectionCode!: string | null;

  @ApiProperty()
  termLabel!: string;
}

export class Student360TeacherDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  subject!: string | null;
}

export class Student360AssessmentDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  assessmentId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  scorePercent!: number | null;

  @ApiPropertyOptional({ nullable: true })
  submittedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  className!: string | null;
}

export class Student360CurrentBlockDto {
  @ApiProperty({ description: "Current mean performance (0–100) from analytics" })
  performance!: number;

  @ApiProperty({ description: "Current mean attendance rate (0–1) from analytics" })
  attendance!: number;

  @ApiProperty({ description: "Current LMS engagement score from analytics" })
  engagement!: number;

  @ApiProperty({ description: "Weighted overall risk (0–100)" })
  riskScore!: number;

  @ApiProperty({ description: "LOW | MEDIUM | HIGH" })
  riskTier!: string;
}

export class Student360HeatmapBlockDto {
  @ApiProperty({ type: [HeatmapCell] })
  daily!: HeatmapCell[];

  @ApiProperty({ type: [HeatmapCell] })
  weekly!: HeatmapCell[];
}

export class Student360RiskEngineBlockDto {
  @ApiProperty()
  compositeRisk!: number;

  @ApiProperty({ enum: ["low", "medium", "high"] })
  category!: "low" | "medium" | "high";

  @ApiProperty({ type: [String] })
  reasons!: string[];
}

export class Student360RiskEngineHistoryDto {
  @ApiPropertyOptional({ nullable: true })
  composite!: number | null;

  @ApiPropertyOptional({ nullable: true })
  category!: string | null;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiPropertyOptional({ nullable: true })
  stability!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  deltas!: Record<string, unknown> | null;
}

export class Student360DashboardResponse {
  @ApiProperty({ format: "uuid" })
  studentId!: string;

  @ApiProperty({ type: Student360IdentityDto })
  identity!: Student360IdentityDto;

  @ApiProperty({ type: [Student360ClassDto] })
  classes!: Student360ClassDto[];

  @ApiProperty({ type: [Student360TeacherDto] })
  teachers!: Student360TeacherDto[];

  @ApiProperty({ type: [Student360AssessmentDto] })
  assessments!: Student360AssessmentDto[];

  @ApiProperty({ type: [TrendPoint], description: "Daily average assessment score %" })
  scoreTimeline!: TrendPoint[];

  @ApiProperty({
    type: [TrendPoint],
    description: "Daily attendance rate (0–1 present-like / sessions)",
  })
  attendanceTimeline!: TrendPoint[];

  @ApiProperty({ description: "Share of assessments with a submission timestamp (0–1)" })
  submissionRate!: number;

  @ApiProperty()
  performanceDelta!: number;

  @ApiProperty()
  attendanceDelta!: number;

  @ApiProperty()
  engagementDelta!: number;

  @ApiProperty()
  riskDelta!: number;

  @ApiProperty({ description: "thisWeek.riskComposite − lastWeek.riskComposite (Risk Engine)" })
  riskCompositeDelta!: number;

  @ApiProperty({ type: Student360CurrentBlockDto })
  current!: Student360CurrentBlockDto;

  @ApiProperty({ type: Student360RiskEngineBlockDto })
  riskEngine!: Student360RiskEngineBlockDto;

  @ApiProperty({ type: Student360RiskEngineHistoryDto })
  riskEngineHistory!: Student360RiskEngineHistoryDto;

  @ApiProperty({ description: "Open + resolved interventions touching this student (count)" })
  interventionCount!: number;

  @ApiProperty({ description: "AI-generated intervention suggestions" })
  interventions!: unknown[];

  @ApiProperty({ type: Student360HeatmapBlockDto })
  heatmap!: Student360HeatmapBlockDto;

  @ApiPropertyOptional({ nullable: true })
  aiSummary?: string | null;
}
