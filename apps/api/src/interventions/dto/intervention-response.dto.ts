import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InterventionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ format: "uuid" })
  schoolId!: string;

  @ApiProperty({ format: "uuid" })
  teacherId!: string;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  classId!: string | null;

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  studentId!: string | null;

  @ApiProperty()
  triggerType!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Structured recommendations (JSON) from AI or manual edits",
    type: Object,
  })
  recommendations!: unknown | null;

  @ApiProperty({ example: "open" })
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
