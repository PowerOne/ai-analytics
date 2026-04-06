/**
 * Optional hook for scheduled weekly report generation (e.g. @nestjs/schedule).
 * Inject {@link WeeklyReportsService} and call {@link WeeklyReportsService.generateWeeklyReport}
 * with a principal JWT when wiring cron jobs.
 */
export class WeeklyReportsProcessor {}
