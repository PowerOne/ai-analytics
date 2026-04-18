import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PrincipalAttEngWindowDto {
  @ApiProperty({ description: "Inclusive range start (UTC date YYYY-MM-DD)" })
  from!: string;

  @ApiProperty({ description: "Inclusive range end (UTC date YYYY-MM-DD)" })
  to!: string;
}

export class PrincipalAttEngDayBucketDto {
  @ApiProperty({ description: "Bucket date (UTC YYYY-MM-DD)" })
  date!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Share of present-like sessions (present/late/excused); null if no sessions",
  })
  attendanceRate!: number | null;

  @ApiProperty({ description: "Total attendance_records rows in bucket" })
  attendanceSessions!: number;

  @ApiPropertyOptional({
    nullable: true,
    description: "Average lms_activity_events.engagement_score when non-null; null if none",
  })
  engagementAvg!: number | null;

  @ApiProperty({ description: "Total LMS events in bucket" })
  engagementEventCount!: number;
}

export class PrincipalAttEngWeekBucketDto {
  @ApiProperty({ description: "ISO week Monday (UTC YYYY-MM-DD)" })
  weekStart!: string;

  @ApiPropertyOptional({ nullable: true })
  attendanceRate!: number | null;

  @ApiProperty()
  attendanceSessions!: number;

  @ApiPropertyOptional({ nullable: true })
  engagementAvg!: number | null;

  @ApiProperty()
  engagementEventCount!: number;
}

export class PrincipalAttEngSnapshotPointDto {
  @ApiProperty()
  weekStart!: string;

  @ApiPropertyOptional({ nullable: true })
  attendance!: number | null;

  @ApiPropertyOptional({ nullable: true })
  engagement!: number | null;
}

export class PrincipalAttEngSnapshotDto {
  @ApiProperty({ description: "True if any weekly_school_snapshots row exists for the school in range" })
  available!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: "User-facing message when snapshot series is empty (e.g. no weekly_school_snapshots)",
  })
  message!: string | null;

  @ApiPropertyOptional({ type: [PrincipalAttEngSnapshotPointDto] })
  points?: PrincipalAttEngSnapshotPointDto[];
}

export class PrincipalAttendanceEngagementHeatmapBlockDto {
  @ApiProperty({ type: PrincipalAttEngWindowDto })
  window!: PrincipalAttEngWindowDto;

  @ApiProperty({ type: [PrincipalAttEngDayBucketDto] })
  daily!: PrincipalAttEngDayBucketDto[];

  @ApiProperty({ type: [PrincipalAttEngWeekBucketDto] })
  weekly!: PrincipalAttEngWeekBucketDto[];

  @ApiProperty({ type: PrincipalAttEngSnapshotDto })
  snapshot!: PrincipalAttEngSnapshotDto;
}

export class PrincipalAttEngContributorStudentDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  displayName!: string | null;
}

export class PrincipalAttEngContributorClassDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class PrincipalAttEngContributorsResponseDto {
  @ApiProperty({ enum: ["attendance", "engagement"] })
  metric!: "attendance" | "engagement";

  @ApiProperty({ enum: ["day", "week"] })
  bucketType!: "day" | "week";

  @ApiProperty({ description: "YYYY-MM-DD (day) or week-start Monday YYYY-MM-DD" })
  bucketKey!: string;

  @ApiProperty({ type: [PrincipalAttEngContributorStudentDto] })
  students!: PrincipalAttEngContributorStudentDto[];

  @ApiProperty({ type: [PrincipalAttEngContributorClassDto] })
  classes!: PrincipalAttEngContributorClassDto[];
}
