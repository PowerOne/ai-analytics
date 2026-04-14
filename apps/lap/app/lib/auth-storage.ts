import {
  LOCAL_TOKEN_STORAGE_KEY,
  isLocalStorageAuthStrategy,
} from "./auth-constants";

export function getStoredBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  if (!isLocalStorageAuthStrategy()) return null;
  return localStorage.getItem(LOCAL_TOKEN_STORAGE_KEY);
}

export function setStoredBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (!isLocalStorageAuthStrategy()) return;
  if (token) localStorage.setItem(LOCAL_TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(LOCAL_TOKEN_STORAGE_KEY);
}
