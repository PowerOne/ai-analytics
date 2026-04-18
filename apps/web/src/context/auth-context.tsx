"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { LA_UNAUTHORIZED_EVENT } from "@/lib/auth-events";
import { getPublicApiBase } from "@/lib/api-base";
import type { SessionUser, UserRole } from "@/lib/types";

const STORAGE_KEY = "la_session";

type StoredSession = {
  id: string;
  email: string;
  role: UserRole;
  schoolId: string;
  token: string;
  teacherId?: string | null;
};

interface AuthContextValue {
  user: SessionUser | null;
  ready: boolean;
  loginWithCredentials: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  isLeadership: boolean;
  isTeacher: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeRole(role: string): UserRole {
  const r = String(role).toUpperCase();
  if (r === "ADMIN" || r === "PRINCIPAL" || r === "TEACHER") return r;
  throw new Error(`Role "${role}" is not supported for this application.`);
}

function loadSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed.email || !parsed.role || !parsed.schoolId || !parsed.id) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      role: normalizeRole(parsed.role as string),
      schoolId: parsed.schoolId,
      token: parsed.token,
      teacherId: parsed.teacherId ?? undefined,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setUser(loadSession());
    setReady(true);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setUser(null);
      router.replace("/login");
    };
    window.addEventListener(LA_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(LA_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    router.replace("/login");
  }, [router]);

  const loginWithCredentials = useCallback(async (email: string, password: string): Promise<SessionUser> => {
    const base = getPublicApiBase();
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { message: text };
    }
    if (!res.ok) {
      const err = body as { message?: string | string[]; error?: string };
      const msg = Array.isArray(err.message)
        ? err.message.join(", ")
        : (err.message ?? err.error ?? (text || `Login failed (${res.status})`));
      throw new Error(msg);
    }
    const data = body as {
      accessToken: string;
      user: { id: string; email: string; schoolId: string; role: string; teacherId: string | null };
    };
    const session: SessionUser = {
      id: data.user.id,
      email: data.user.email,
      schoolId: data.user.schoolId,
      role: normalizeRole(data.user.role),
      token: data.accessToken,
      teacherId: data.user.teacherId ?? undefined,
    };
    const stored: StoredSession = {
      id: session.id,
      email: session.email,
      role: session.role,
      schoolId: session.schoolId,
      token: session.token,
      teacherId: session.teacherId ?? null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setUser(session);
    return session;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      loginWithCredentials,
      logout,
      isLeadership: user?.role === "ADMIN" || user?.role === "PRINCIPAL",
      isTeacher: user?.role === "TEACHER",
    }),
    [user, ready, loginWithCredentials, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
