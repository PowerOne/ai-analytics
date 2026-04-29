"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Brain, GraduationCap, LayoutDashboard, Settings, ShieldAlert, Users } from "lucide-react";

const NAV = [
  { href: "/school-overview", label: "School Overview", icon: LayoutDashboard },
  { href: "/admin/risk", label: "Risk & Heatmap", icon: ShieldAlert },
  { href: "/cohort-dashboard", label: "Cohorts", icon: Users },
  { href: "/student", label: "Students", icon: GraduationCap },
  { href: "/principal-dashboard", label: "Intelligence", icon: Brain },
  { href: "/admin", label: "Settings", icon: Settings },
] as const;

export function ModernSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60 lg:flex">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-600 text-white">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Learning Analytics</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Modern Dashboard</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ||
            (item.href === "/school-overview" && pathname.startsWith("/school-overview"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sky-600/10 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-sky-600 dark:text-sky-300" : "text-slate-400")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Vercel-friendly • App Router • Dark mode
      </div>
    </aside>
  );
}
