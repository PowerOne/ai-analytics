import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TrendPoint } from "../../analytics/dto/common.dto";

export class Class360ClassInfoDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  sectionCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  room!: string | null;
}

export class Class360TeacherDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;
}

export class Class360SubjectDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class Class360TermDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ description: "ISO date YYYY-MM-DD" })
  startsOn!: string;

  @ApiProperty({ description: "ISO date YYYY-MM-DD" })
  endsOn!: string;
}

export class Class360StudentRowDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  gradeLevel!: string | null;

  @ApiPropertyOptional({ nullable: true })
  riskScore!: number | null;
}

export class Class360SnapshotBlockDto {
  @ApiProperty()
  weekStartDate!: string;

  @ApiPropertyOptional({ nullable: true })
  performance!: number | null;

  @ApiPropertyOptional({ nullable: true })
  attendance!: number | null;

  @ApiPropertyOptional({ nullable: true })
  engagement!: number | null;

  @ApiPropertyOptional({ nullable: true })
  riskScore!: number | null;

  @ApiPropertyOptional({ nullable: true })
  riskComposite!: number | null;

  @ApiPropertyOptional({ nullable: true })
  riskCategory!: string | null;
}

export class Class360RiskDeltasDto {
  @ApiProperty()
  performance!: number;

  @ApiProperty()
  attendance!: number;

  @ApiProperty()
  engagement!: number;

  @ApiProperty()
  risk!: number;

  @ApiProperty()
  riskComposite!: number;
}

export class Class360RiskSummaryDto {
  @ApiProperty({ description: "Live weighted risk from class analytics (0–100)" })
  liveOverall!: number;

  @ApiProperty({ description: "LOW | MEDIUM | HIGH" })
  liveLevel!: string;

  @ApiProperty()
  liveEngagementRisk!: number;

  @ApiProperty()
  liveAttendanceRisk!: number;

  @ApiProperty()
  livePerformanceRisk!: number;

  @ApiProperty({ description: "Mean composite risk from risk engine over enrolled students" })
  averageEngineRisk!: number;

  @ApiProperty()
  studentsLow!: number;

  @ApiProperty()
  studentsMedium!: number;

  @ApiProperty()
  studentsHigh!: number;

  @ApiPropertyOptional({ type: Class360SnapshotBlockDto, nullable: true })
  snapshotThisWeek!: Class360SnapshotBlockDto | null;

  @ApiPropertyOptional({ type: Class360SnapshotBlockDto, nullable: true })
  snapshotLastWeek!: Class360SnapshotBlockDto | null;

  @ApiProperty({ type: Class360RiskDeltasDto })
  deltas!: Class360RiskDeltasDto;
}

export class Class360AttendanceSummaryDto {
  @ApiProperty({ description: "Present-like share from analytics (0–1)" })
  currentRate!: number;

  @ApiPropertyOptional({ nullable: true })
  snapshotThisWeek!: number | null;

  @ApiPropertyOptional({ nullable: true })
  snapshotLastWeek!: number | null;

  @ApiProperty({ description: "thisWeek.attendance − lastWeek.attendance (snapshot)" })
  delta!: number;
}

export class Class360EngagementSummaryDto {
  @ApiProperty({ description: "Mean LMS engagement from analytics" })
  currentScore!: number;

  @ApiPropertyOptional({ nullable: true })
  snapshotThisWeek!: number | null;

  @ApiPropertyOptional({ nullable: true })
  snapshotLastWeek!: number | null;

  @ApiProperty({ description: "thisWeek.engagement − lastWeek.engagement (snapshot)" })
  delta!: number;
}

export class Class360DashboardResponse {
  @ApiProperty({ type: Class360ClassInfoDto })
  classInfo!: Class360ClassInfoDto;

  @ApiPropertyOptional({ type: Class360TeacherDto, nullable: true })
  teacher!: Class360TeacherDto | null;

  @ApiProperty({ type: Class360SubjectDto })
  subject!: Class360SubjectDto;

  @ApiProperty({ type: Class360TermDto })
  term!: Class360TermDto;

  @ApiProperty({ type: [Class360StudentRowDto] })
  students!: Class360StudentRowDto[];

  @ApiProperty()
  studentCount!: number;

  @ApiProperty({ description: "Mean assessment % from analytics" })
  averageScore!: number;

  @ApiProperty({ description: "Submission rate from analytics (0–1)" })
  submissionRate!: number;

  @ApiProperty({ type: [TrendPoint] })
  scoreTrend!: TrendPoint[];

  @ApiProperty({ type: Class360RiskSummaryDto })
  riskSummary!: Class360RiskSummaryDto;

  @ApiProperty({ type: Class360AttendanceSummaryDto })
  attendanceSummary!: Class360AttendanceSummaryDto;

  @ApiProperty({ type: Class360EngagementSummaryDto })
  engagementSummary!: Class360EngagementSummaryDto;
}
