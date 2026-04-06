/**
 * Optional hook for batch / scheduled runs (e.g. @nestjs/schedule cron).
 * When ready, register a provider that injects {@link InterventionsService} and
 * calls {@link InterventionsService.autoCheck} with an admin/principal JWT.
 */
export class InterventionsProcessor {}
