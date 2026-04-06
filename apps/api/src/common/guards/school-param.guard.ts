import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { JwtPayload } from "../types/jwt-payload";

/**
 * Use on routes that include `schoolId` in path or query (e.g. `/schools/:schoolId/...`).
 * Ensures the authenticated user's tenant matches the requested school.
 * Routes that rely only on JWT `schoolId` (no param) do not need this guard.
 */
@Injectable()
export class SchoolParamGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: JwtPayload;
      params?: Record<string, string>;
      query?: Record<string, string>;
    }>();
    const user = req.user;
    if (!user) return false;
    const fromParams = req.params?.schoolId;
    const fromQuery = typeof req.query?.schoolId === "string" ? req.query.schoolId : undefined;
    const requested = fromParams ?? fromQuery;
    if (!requested) return true;
    if (requested !== user.schoolId) {
      throw new ForbiddenException("Cannot access another school's data");
    }
    return true;
  }
}
