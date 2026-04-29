"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/modern/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/modern/ui/dropdown-menu";
import { CircleUser, LogOut, Settings as SettingsIcon } from "lucide-react";

function titleFromPath(pathname: string) {
  if (pathname.startsWith("/school-overview")) return "School Overview";
  if (pathname.startsWith("/admin/risk")) return "Risk & Heatmap";
  if (pathname.startsWith("/cohort-dashboard")) return "Cohorts";
  if (pathname.startsWith("/student")) return "Students";
  if (pathname.startsWith("/principal-dashboard")) return "Intelligence";
  if (pathname.startsWith("/admin")) return "Settings";
  return "Dashboard";
}

export function ModernTopbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const title = titleFromPath(pathname);

  const initials = useMemo(() => {
    const email = user?.email ?? "";
    const parts = email.split("@")[0]?.split(".").filter(Boolean) ?? [];
    const a = parts[0]?.[0] ?? email[0] ?? "U";
    const b = parts[1]?.[0] ?? "";
    return `${a}${b}`.toUpperCase();
  }, [user?.email]);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/75 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60 lg:px-8">
      <div className="flex flex-col leading-tight">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Analytics-grade, responsive, dark-mode ready</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.email ?? "—"}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role ?? "—"}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="User menu">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {initials}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <CircleUser className="mr-2 h-4 w-4 text-slate-400" />
              <span className="truncate">{user?.email ?? "Unknown"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <SettingsIcon className="mr-2 h-4 w-4 text-slate-400" />
              Settings (via sidebar)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                logout();
              }}
            >
              <LogOut className="mr-2 h-4 w-4 text-slate-400" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
