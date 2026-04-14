import { headers } from "next/headers";

/**
 * Server-only fetch to the Next.js BFF (`/api/backend/*`) with the incoming
 * request cookies so the upstream API receives the same session as the browser.
 */
export async function fetchFromBackend<T>(
  path: string,
): Promise<
  { success: true; data: T } | { success: false; status: number; body: string }
> {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    return { success: false, status: 500, body: "Missing Host header" };
  }
  const proto = h.get("x-forwarded-proto") ?? "http";
  const normalized = path.replace(/^\//, "");
  const url = `${proto}://${host}/api/backend/${normalized}`;

  const res = await fetch(url, {
    headers: {
      cookie: h.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    return { success: false, status: res.status, body: body || res.statusText };
  }

  const data = (await res.json()) as T;
  return { success: true, data };
}
