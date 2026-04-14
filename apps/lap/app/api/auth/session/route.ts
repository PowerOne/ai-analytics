import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { AuthUser } from "@/app/lib/auth-types";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/app/lib/session-cookie";
import { verifyAccessToken } from "@/app/lib/token";

type Body = { accessToken?: string };

/**
 * Establishes an HttpOnly session cookie from a bearer token (e.g. after
 * direct API login with localStorage fallback).
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const accessToken = body.accessToken?.trim();
  if (!accessToken) {
    return NextResponse.json({ message: "accessToken is required" }, { status: 400 });
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload) {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }

  cookies().set(SESSION_COOKIE_NAME, accessToken, sessionCookieOptions());

  const user: AuthUser = {
    id: payload.sub,
    email: payload.email,
    schoolId: payload.schoolId,
    role: payload.role,
    teacherId: payload.teacherId,
  };

  return NextResponse.json({ user });
}
