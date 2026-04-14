/** HttpOnly session cookie (JWT access token). */
export const SESSION_COOKIE_NAME = "lap_session";

/** Fallback: bearer token in localStorage when NEXT_PUBLIC_AUTH_STRATEGY=localStorage */
export const LOCAL_TOKEN_STORAGE_KEY = "lap_access_token";

export function isLocalStorageAuthStrategy(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_STRATEGY === "localStorage";
}
