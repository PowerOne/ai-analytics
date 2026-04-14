import { Spinner } from "@/app/components/ui/spinner";

/**
 * Default loading UI for dashboard routes (`loading.tsx`).
 * Keeps layout stable and works on small viewports.
 */
export function DashboardPageLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 py-16">
      <Spinner size="lg" label="Loading page" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
    </div>
  );
}
