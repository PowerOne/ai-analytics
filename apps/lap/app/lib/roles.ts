/** Mirrors Prisma `UserRole` from the Learning Analytics API. */
export type UserRole = "ADMIN" | "PRINCIPAL" | "TEACHER";

export const ROLE_DASHBOARD: Record<UserRole, string> = {
  ADMIN: "/admin/dashboard",
  PRINCIPAL: "/principal/dashboard",
  TEACHER: "/teacher",
};

export function dashboardPathForRole(role: UserRole): string {
  return ROLE_DASHBOARD[role];
}

const ROLE_PATH_PREFIX: Record<UserRole, string> = {
  ADMIN: "/admin",
  PRINCIPAL: "/principal",
  TEACHER: "/teacher",
};

/**
 * Returns true when `pathname` is under another role's dashboard segment
 * (e.g. TEACHER opening /admin).
 */
export function isRestrictedRolePath(pathname: string, role: UserRole): boolean {
  const entries = Object.entries(ROLE_PATH_PREFIX) as [UserRole, string][];
  for (const [r, prefix] of entries) {
    if (r === role) continue;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

/** True when this path can be opened by the role (post-login redirect safety). */
export function isAllowedAppPath(pathname: string, role: UserRole): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return false;
  return !isRestrictedRolePath(pathname, role);
}
