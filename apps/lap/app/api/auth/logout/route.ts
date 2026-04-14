import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/app/lib/session-cookie";

export async function POST() {
  cookies().delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
