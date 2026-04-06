"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SessionUser, UserRole } from "@/lib/types";

const STORAGE_KEY = "la_session";

interface AuthContextValue {
  user: SessionUser | null;
  ready: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  isLeadership: boolean;
  isTeacher: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

function makeMockSession(role: UserRole): SessionUser {
  const schoolId = "00000000-0000-4000-8000-000000000001";
  return {
    email:
      role === "TEACHER" ? "teacher@demo.school" : "admin@demo.school",
    role,
    schoolId,
    token: "mock-jwt-token",
    teacherId: role === "TEACHER" ? "teacher-1" : undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(loadSession());
    setReady(true);
  }, []);

  const login = useCallback((role: UserRole) => {
    const session = makeMockSession(role);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login,
      logout,
      isLeadership: user?.role === "ADMIN" || user?.role === "PRINCIPAL",
      isTeacher: user?.role === "TEACHER",
    }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
