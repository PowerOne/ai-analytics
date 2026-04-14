import { jwtVerify } from "jose";

import type { UserRole } from "./roles";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  schoolId: string;
  role: UserRole;
  teacherId: string | null;
};

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload | null> {
  const key = getJwtSecret();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    const role = payload.role as UserRole | undefined;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.schoolId !== "string" ||
      !role
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      schoolId: payload.schoolId,
      role,
      teacherId:
        typeof payload.teacherId === "string" ? payload.teacherId : null,
    };
  } catch {
    return null;
  }
}
