import { ApiProperty } from "@nestjs/swagger";
import { CohortSummaryResponse } from "./cohort-summary.dto";

/** Grade cohort (keyed by student gradeLevel, e.g. "9", "10"). */
export class GradeCohortResponse extends CohortSummaryResponse {
  @ApiProperty({ description: "Same as id — normalized grade level key" })
  declare id: string;
}
