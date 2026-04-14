import { SESSION_COOKIE_NAME } from "./auth-constants";

const WEEK_SECONDS = 60 * 60 * 24 * 7;

export function sessionCookieOptions(maxAgeSeconds = WEEK_SECONDS) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export { SESSION_COOKIE_NAME };
