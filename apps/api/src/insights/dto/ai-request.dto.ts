import { ApiProperty } from "@nestjs/swagger";

/** Payload sent to the AI microservice `POST /generate-insights`. */
export class AIInsightsRequest {
  @ApiProperty({ enum: ["class", "student"], description: "Which analytics shape is included" })
  type!: "class" | "student";

  @ApiProperty({
    description: "Structured analytics from AnalyticsService (class or student bundle)",
  })
  analytics!: Record<string, unknown>;

  @ApiProperty({
    description: "Tenant and entity identifiers",
    example: { schoolId: "uuid", classId: "uuid" },
  })
  metadata!: Record<string, unknown>;
}
