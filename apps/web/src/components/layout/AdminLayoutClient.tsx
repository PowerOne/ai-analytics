"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RequireRole } from "@/components/auth/RequireRole";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/cn";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/risk", label: "Risk & heatmap" },
];

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <RequireRole allow={["ADMIN", "PRINCIPAL"]}>
      <div className="min-h-screen">
        <header className="border-b border-slate-800 bg-slate-900/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="font-semibold text-slate-100">
                Learning Analytics
              </Link>
              <nav className="flex gap-1">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm",
                      pathname === l.href
                        ? "bg-slate-800 text-sky-300"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>{user?.email}</span>
              <button
                type="button"
                onClick={() => logout()}
                className="rounded border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </div>
    </RequireRole>
  );
}
