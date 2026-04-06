import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateInterventionDto {
  @ApiProperty({ format: "uuid", description: "Owning teacher for this intervention" })
  @IsUUID()
  teacherId!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiProperty({ example: "manual_concern" })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  triggerType!: string;

  @ApiProperty({ description: "Human-readable description of the situation" })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  description!: string;
}
