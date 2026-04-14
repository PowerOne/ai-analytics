import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/app/lib/auth-constants";
import {
  dashboardPathForRole,
  isRestrictedRolePath,
} from "@/app/lib/roles";
import { verifyAccessToken } from "@/app/lib/token";

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const payload = token ? await verifyAccessToken(token) : null;

  if (!payload) {
    if (isLoginPath(pathname)) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") {
      url.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(url);
  }

  const { role } = payload;

  if (isLoginPath(pathname) || pathname === "/") {
    const target = dashboardPathForRole(role);
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (isRestrictedRolePath(pathname, role)) {
    return NextResponse.redirect(
      new URL(dashboardPathForRole(role), request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
