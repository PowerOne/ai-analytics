import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/app/lib/session-cookie";
import { getServerApiOrigin } from "@/app/lib/server-api-url";

export async function POST(request: Request) {
  const origin = getServerApiOrigin();
  if (!origin) {
    return NextResponse.json(
      { message: "API_URL or NEXT_PUBLIC_API_URL is not configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const upstream = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text || "Login failed" };
  }

  if (!upstream.ok) {
    const message =
      typeof json === "object" &&
      json !== null &&
      "message" in json &&
      typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : "Invalid credentials";
    return NextResponse.json({ message }, { status: upstream.status });
  }

  const data = json as {
    accessToken?: string;
    user?: unknown;
  };

  if (!data.accessToken) {
    return NextResponse.json(
      { message: "Invalid response from authentication service" },
      { status: 502 },
    );
  }

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, data.accessToken, sessionCookieOptions());

  return NextResponse.json({ user: data.user });
}
