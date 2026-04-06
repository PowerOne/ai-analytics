import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateInterventionDto {
  @ApiPropertyOptional({
    description: "open | in_progress | resolved",
    example: "in_progress",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  status?: string;

  @ApiPropertyOptional({ description: "Free-form notes (updates append-friendly)" })
  @IsOptional()
  @IsString()
  @MaxLength(16000)
  notes?: string;

  @ApiPropertyOptional({
    description: "Structured recommendations (JSON); can be merged from AI",
    type: Object,
  })
  @IsOptional()
  @IsObject()
  recommendations?: Record<string, unknown>;
}
