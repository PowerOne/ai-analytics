import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export class PrincipalAttEngContributorsQueryDto {
  @IsIn(["day", "week"])
  bucketType!: "day" | "week";

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  bucketKey!: string;

  @IsIn(["attendance", "engagement"])
  metric!: "attendance" | "engagement";

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return 50;
    const n = Number(value);
    return Number.isFinite(n) ? n : 50;
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit!: number;
}
