import type { AuthUser } from "./auth-types";
import { AuthError } from "./auth-types";
import { getApiBaseUrl } from "./api";
import { setStoredBearerToken } from "./auth-storage";
import {
  LOCAL_TOKEN_STORAGE_KEY,
  SESSION_COOKIE_NAME,
  isLocalStorageAuthStrategy,
} from "./auth-constants";
import { verifyAccessToken } from "./token";
import { dashboardPathForRole } from "./roles";

async function parseJsonMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (typeof data === "object" && data !== null && "message" in data) {
      const msg = (data as { message: unknown }).message;
      if (typeof msg === "string") return msg;
      if (Array.isArray(msg) && msg.every((x) => typeof x === "string")) {
        return msg.join(", ");
      }
    }
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

/**
 * Cookie-based login (default): calls the Next.js route which sets an HttpOnly session.
 * When NEXT_PUBLIC_AUTH_STRATEGY=localStorage, calls the API directly, persists the token
 * for redundancy, then establishes the HttpOnly session via /api/auth/session.
 */
export async function login(email: string, password: string): Promise<AuthUser> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    throw new AuthError("Email is required", 400);
  }

  if (isLocalStorageAuthStrategy()) {
    const origin = getApiBaseUrl();
    if (!origin) {
      throw new AuthError("NEXT_PUBLIC_API_URL is not configured", 500);
    }

    const res = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail, password }),
    });

    const text = await res.text();
    type LoginOk = { accessToken?: string; user?: AuthUser };
    let json: LoginOk | null = null;
    try {
      json = text ? (JSON.parse(text) as LoginOk) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const message =
        json && typeof json === "object" && "message" in json
          ? String((json as { message?: string }).message)
          : text || "Invalid credentials";
      throw new AuthError(message || "Invalid credentials", res.status);
    }

    if (!json?.accessToken || !json.user) {
      throw new AuthError("Invalid response from authentication service", 502);
    }

    setStoredBearerToken(json.accessToken);

    const sessionRes = await fetch(
      `${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/session`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessToken: json.accessToken }),
      },
    );

    if (!sessionRes.ok) {
      setStoredBearerToken(null);
      throw new AuthError(await parseJsonMessage(sessionRes), sessionRes.status);
    }

    return json.user;
  }

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: trimmedEmail, password }),
  });

  if (!res.ok) {
    throw new AuthError(await parseJsonMessage(res), res.status);
  }

  const data = (await res.json()) as { user?: AuthUser };
  if (!data.user) {
    throw new AuthError("Invalid response from authentication service", 502);
  }

  return data.user;
}

export async function logout(): Promise<void> {
  setStoredBearerToken(null);
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (typeof window !== "undefined") {
    const headers = new Headers();
    const bearer =
      isLocalStorageAuthStrategy() && typeof localStorage !== "undefined"
        ? localStorage.getItem(LOCAL_TOKEN_STORAGE_KEY)
        : null;
    if (bearer) headers.set("authorization", `Bearer ${bearer}`);

    const res = await fetch(`${window.location.origin}/api/auth/me`, {
      credentials: "include",
      headers,
      cache: "no-store",
    });

    if (res.status === 401) return null;
    if (!res.ok) return null;
    return res.json() as Promise<AuthUser>;
  }

  const { cookies } = await import("next/headers");
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyAccessToken(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    schoolId: payload.schoolId,
    role: payload.role,
    teacherId: payload.teacherId,
  };
}

export function getPostLoginPath(user: AuthUser): string {
  return dashboardPathForRole(user.role);
}
