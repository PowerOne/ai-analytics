"use client";

import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const NAV: { href: string; label: string; roles: UserRole[] }[] = [
  { href: "/teacher-dashboard", label: "Teacher Dashboard", roles: ["TEACHER", "ADMIN", "PRINCIPAL"] },
  { href: "/principal-dashboard", label: "Principal Dashboard", roles: ["ADMIN", "PRINCIPAL"] },
  { href: "/cohort-dashboard", label: "Cohort Dashboard", roles: ["ADMIN", "PRINCIPAL"] },
  { href: "/student", label: "Student 360", roles: ["TEACHER", "ADMIN", "PRINCIPAL"] },
];

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "Learning Analytics";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside className="flex w-56 flex-col border-r border-slate-800 bg-slate-900/80">
        <div className="border-b border-slate-800 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Dashboards</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map((item) => {
            if (!item.roles.includes(user.role)) return null;
            const active =
              pathname === item.href ||
              (item.href !== "/student" && pathname.startsWith(`${item.href}/`)) ||
              (item.href === "/student" && pathname.startsWith("/student"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-sky-600/30 text-sky-100" : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-6 py-3">
          <h1 className="text-lg font-semibold text-slate-100">{SCHOOL_NAME}</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-sky-200">
              {user.role}
            </span>
            <span className="max-w-[200px] truncate text-slate-400">{user.email}</span>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
