import { ApiProperty } from "@nestjs/swagger";
import { CohortSummaryResponse } from "./cohort-summary.dto";

/** Subject cohort (keyed by subject UUID). */
export class SubjectCohortResponse extends CohortSummaryResponse {
  @ApiProperty({ description: "Subject id (UUID)" })
  declare id: string;
}
