import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/app/lib/session-cookie";
import { verifyAccessToken } from "@/app/lib/token";
import type { AuthUser } from "@/app/lib/auth-types";

function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function GET(request: Request) {
  const fromHeader = bearerFromRequest(request);
  const fromCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const token = fromHeader ?? fromCookie;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user: AuthUser = {
    id: payload.sub,
    email: payload.email,
    schoolId: payload.schoolId,
    role: payload.role,
    teacherId: payload.teacherId,
  };

  return NextResponse.json(user);
}
