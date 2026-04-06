import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { HeatmapCell } from "../../lms-heatmaps/dto/heatmap-cell.dto";
import { StudentAttentionSummary } from "../../weekly-reports/dto/student-attention-summary.dto";

export class ClassSnapshotBlockDto {
  @ApiProperty({ description: "ISO week start (Monday UTC)" })
  weekStartDate!: string;

  @ApiPropertyOptional({ nullable: true })
  performance?: number | null;

  @ApiPropertyOptional({ nullable: true })
  attendance?: number | null;

  @ApiPropertyOptional({ nullable: true })
  engagement?: number | null;

  @ApiPropertyOptional({ nullable: true })
  riskScore?: number | null;
}

export class ClassDashboardSummary {
  @ApiProperty({ format: "uuid" })
  classId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ type: ClassSnapshotBlockDto, nullable: true })
  thisWeek?: ClassSnapshotBlockDto | null;

  @ApiPropertyOptional({ type: ClassSnapshotBlockDto, nullable: true })
  lastWeek?: ClassSnapshotBlockDto | null;

  @ApiProperty({ description: "thisWeek.performance − lastWeek.performance" })
  performanceDelta!: number;

  @ApiProperty({ description: "thisWeek.attendance − lastWeek.attendance" })
  attendanceDelta!: number;

  @ApiProperty({ description: "thisWeek.engagement − lastWeek.engagement (LMS event totals)" })
  engagementDelta!: number;

  @ApiProperty({ description: "thisWeek.riskScore − lastWeek.riskScore" })
  riskDelta!: number;
}

export class TeacherHeatmapBlockDto {
  @ApiProperty({ type: [HeatmapCell] })
  daily!: HeatmapCell[];

  @ApiProperty({ type: [HeatmapCell] })
  weekly!: HeatmapCell[];
}

export class TeacherDashboardResponse {
  @ApiProperty({ format: "uuid" })
  teacherId!: string;

  @ApiProperty({ type: [ClassDashboardSummary] })
  classes!: ClassDashboardSummary[];

  @ApiProperty({ type: [StudentAttentionSummary] })
  attentionStudents!: StudentAttentionSummary[];

  @ApiProperty({ description: "Interventions created by this teacher since current Monday UTC" })
  interventionsThisWeek!: number;

  @ApiProperty({ type: TeacherHeatmapBlockDto })
  heatmap!: TeacherHeatmapBlockDto;

  @ApiPropertyOptional({ nullable: true })
  aiSummary?: string | null;
}
