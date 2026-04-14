import { getStoredBearerToken } from "./auth-storage";

export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "";
  return raw.replace(/\/$/, "");
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type ApiErrorSubscriber = (error: ApiError) => void;

const apiErrorSubscribers = new Set<ApiErrorSubscriber>();

/** Subscribe to failed API responses (after JSON parse). 401 is not emitted (session redirect handles it). */
export function subscribeApiErrors(fn: ApiErrorSubscriber): () => void {
  apiErrorSubscribers.add(fn);
  return () => {
    apiErrorSubscribers.delete(fn);
  };
}

function emitApiError(error: ApiError) {
  apiErrorSubscribers.forEach((fn) => {
    try {
      fn(error);
    } catch {
      /* ignore subscriber failures */
    }
  });
}

function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    window.location.assign("/login");
  }
}

function joinBackendPath(path: string): string {
  const normalized = path.replace(/^\//, "");
  return `/api/backend/${normalized}`;
}

async function parseErrorBody(res: Response): Promise<string> {
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) {
    try {
      const json: unknown = await res.json();
      if (
        typeof json === "object" &&
        json !== null &&
        "message" in json &&
        typeof (json as { message: unknown }).message === "string"
      ) {
        return (json as { message: string }).message;
      }
      if (Array.isArray((json as { message?: unknown }).message)) {
        return String((json as { message: unknown[] }).message[0]);
      }
    } catch {
      /* fall through */
    }
  }
  const text = await res.text().catch(() => "");
  return text || res.statusText;
}

async function request<T>(
  method: string,
  path: string,
  init?: { body?: unknown; headers?: HeadersInit },
): Promise<T> {
  const url = joinBackendPath(path);
  const bearer = getStoredBearerToken();

  const headers = new Headers(init?.headers);
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  if (
    method !== "GET" &&
    method !== "HEAD" &&
    !headers.has("content-type")
  ) {
    headers.set("content-type", "application/json");
  }

  const hasBody =
    init?.body !== undefined && method !== "GET" && method !== "HEAD";

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body: hasBody
      ? typeof init.body === "string"
        ? init.body
        : JSON.stringify(init.body)
      : undefined,
    cache: "no-store",
  });

  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const message = await parseErrorBody(res);
    const err = new ApiError(res.status, message);
    emitApiError(err);
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const ct = res.headers.get("content-type");
  if (!ct?.includes("application/json")) {
    return (await res.text()) as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, headers?: HeadersInit) =>
    request<T>("GET", path, { headers }),

  post: <T>(path: string, body?: unknown, headers?: HeadersInit) =>
    request<T>("POST", path, { body, headers }),

  put: <T>(path: string, body?: unknown, headers?: HeadersInit) =>
    request<T>("PUT", path, { body, headers }),

  patch: <T>(path: string, body?: unknown, headers?: HeadersInit) =>
    request<T>("PATCH", path, { body, headers }),

  delete: <T>(path: string, body?: unknown, headers?: HeadersInit) =>
    request<T>("DELETE", path, { body, headers }),
};
