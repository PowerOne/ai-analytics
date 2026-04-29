"use client";

import { ModernSidebar } from "@/components/modern/ModernSidebar";
import { ModernTopbar } from "@/components/modern/ModernTopbar";

export function ModernAppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        <ModernSidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <ModernTopbar />
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
