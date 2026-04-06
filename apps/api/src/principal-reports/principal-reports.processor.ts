import { Injectable } from "@nestjs/common";

/**
 * Optional hook for scheduled principal report generation (e.g. weekly email digest).
 * When @nestjs/schedule is available, inject PrincipalReportsService and call
 * getPrincipalReport from a @Cron handler.
 */
@Injectable()
export class PrincipalReportsProcessor {}
