"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import type { AuthUser } from "@/app/lib/auth-types";
import {
  isLocalStorageAuthStrategy,
  LOCAL_TOKEN_STORAGE_KEY,
} from "@/app/lib/auth-constants";
import {
  getNavSectionsForRole,
  roleDisplayName,
  roleWorkspaceLabel,
  type NavItem,
} from "@/app/lib/navigation";
import { cn } from "@/app/lib/utils";

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const common = "h-5 w-5 shrink-0";
  switch (name) {
    case "home":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      );
    case "users":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    case "layers":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      );
    case "interventions":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    default:
      return null;
  }
}

function sectionTitle(pathname: string, items: NavItem[]): string {
  let best = "Dashboard";
  let bestLen = -1;
  for (const item of items) {
    const match =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (match && item.href.length >= bestLen) {
      best = item.label;
      bestLen = item.href.length;
    }
  }
  return best;
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  if (isLocalStorageAuthStrategy()) {
    try {
      localStorage.removeItem(LOCAL_TOKEN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  window.location.assign("/login");
}

export type DashboardLayoutProps = {
  user: AuthUser;
  children: React.ReactNode;
};

export function DashboardLayout({ user, children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const navSections = useMemo(() => getNavSectionsForRole(user.role), [user.role]);
  const navItemsFlat = useMemo(
    () => navSections.flatMap((s) => s.items),
    [navSections],
  );
  const title = sectionTitle(pathname ?? "", navItemsFlat);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-zinc-100 px-5 dark:border-zinc-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            LA
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Learning Analytics</p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {roleDisplayName(user.role)}
            </p>
            <p className="truncate text-[11px] leading-tight text-zinc-400 dark:text-zinc-500">
              {roleWorkspaceLabel(user.role)}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-3" aria-label="Main">
          {navSections.map((section) => (
            <div key={section.heading}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {section.heading}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary dark:bg-primary/15 dark:text-indigo-300"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                      )}
                    >
                      <NavIcon name={item.icon} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Signed in as{" "}
            <span className="block truncate font-medium text-zinc-700 dark:text-zinc-300">
              {user.email}
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="lg:hidden"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              Monitor learning signals and act with confidence
            </p>
          </div>

          <div className="relative flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {user.role}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              aria-expanded={accountOpen}
              aria-haspopup="true"
              onClick={() => setAccountOpen((o) => !o)}
            >
              <span className="hidden max-w-[10rem] truncate sm:inline">{user.email}</span>
              <span className="sm:hidden">Account</span>
              <svg className="h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </Button>

            {accountOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setAccountOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                    <p className="truncate text-xs text-zinc-500">Signed in as</p>
                    <p className="truncate text-sm font-medium">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    onClick={() => {
                      setAccountOpen(false);
                      void signOut();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
