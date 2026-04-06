import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InterventionTriggerDto {
  @ApiProperty({ enum: ["risk", "attendance", "engagement"] })
  type!: "risk" | "attendance" | "engagement";

  @ApiPropertyOptional({ format: "uuid" })
  classId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  studentId?: string;

  @ApiProperty({ description: "Trigger-specific payload (scores, deltas, etc.)", type: Object })
  details!: Record<string, unknown>;
}
