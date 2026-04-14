/**
 * Backend origin for server-side fetches (login, proxy).
 * Prefer API_URL (server-only); fall back to NEXT_PUBLIC_API_URL for local dev.
 */
export function getServerApiOrigin(): string {
  const raw = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";
  return raw.replace(/\/$/, "");
}
