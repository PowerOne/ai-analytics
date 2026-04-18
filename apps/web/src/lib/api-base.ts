/**
 * API root (includes `/api`, no trailing slash).
 * - Browser / client: `NEXT_PUBLIC_API_URL` (inlined at build).
 * - Server inside Docker: set `API_INTERNAL_URL` (e.g. `http://api:3001/api`) so SSR/fetch does not use
 *   `localhost`, which points at the web container itself.
 */
export function getApiBase(): string {
  if (typeof window === "undefined") {
    const internal = process.env.API_INTERNAL_URL?.trim();
    if (internal) {
      return internal.replace(/\/$/, "");
    }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
}

/** Same as {@link getApiBase}; kept for call sites that expect a "public" name. */
export function getPublicApiBase(): string {
  return getApiBase();
}
