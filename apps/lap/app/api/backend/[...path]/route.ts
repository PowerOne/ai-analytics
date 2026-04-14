import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/app/lib/session-cookie";
import { getServerApiOrigin } from "@/app/lib/server-api-url";

export const runtime = "nodejs";

function bearerFromRequest(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function proxy(
  request: NextRequest,
  pathSegments: string[],
  method: string,
) {
  const backend = getServerApiOrigin();
  if (!backend) {
    return NextResponse.json(
      { message: "API_URL or NEXT_PUBLIC_API_URL is not configured" },
      { status: 500 },
    );
  }

  const path = pathSegments.join("/");
  if (!path) {
    return NextResponse.json({ message: "Path is required" }, { status: 400 });
  }

  const bearer = bearerFromRequest(request);
  const cookieToken = cookies().get(SESSION_COOKIE_NAME)?.value;
  const token = bearer ?? cookieToken;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const target = new URL(`${backend}/api/${path}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const incomingCt = request.headers.get("content-type");
  if (incomingCt) headers.set("content-type", incomingCt);
  headers.set("authorization", `Bearer ${token}`);

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 0) {
      init.body = buf;
    }
  }

  const upstream = await fetch(target, init);

  const responseHeaders = new Headers(upstream.headers);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteCtx = { params: { path: string[] } };

export async function GET(request: NextRequest, { params }: RouteCtx) {
  return proxy(request, params.path, "GET");
}

export async function POST(request: NextRequest, { params }: RouteCtx) {
  return proxy(request, params.path, "POST");
}

export async function PUT(request: NextRequest, { params }: RouteCtx) {
  return proxy(request, params.path, "PUT");
}

export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  return proxy(request, params.path, "PATCH");
}

export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  return proxy(request, params.path, "DELETE");
}
