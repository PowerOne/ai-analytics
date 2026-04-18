import Link from "next/link";
import { cn } from "@/lib/cn";

export function NocInterventionCard({
  cohortInterventionTotal,
  createdThisWeek,
  resolvedThisWeek,
  schoolSuggestionsCount,
  interventionsHref,
  onCardClick,
}: {
  cohortInterventionTotal: number;
  createdThisWeek: number;
  resolvedThisWeek: number;
  schoolSuggestionsCount: number;
  interventionsHref: string;
  onCardClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-600/70 bg-slate-900/50 bg-gradient-to-br from-slate-900/60 to-amber-950/20 shadow-sm transition-[border-color,box-shadow] duration-200",
        onCardClick && "cursor-pointer hover:border-sky-500/40 hover:shadow-md",
      )}
      onClick={onCardClick}
      role={onCardClick ? "button" : undefined}
    >
      <div className="border-b border-slate-800/90 px-5 py-4">
        <h3 className="text-xl font-semibold tracking-tight text-slate-100">Interventions</h3>
        <p className="mt-1 text-sm text-slate-500">Snapshot totals and weekly activity</p>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <div className="text-sm text-slate-500">Total (cohort snapshot)</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-slate-50">{cohortInterventionTotal}</div>
        </div>
        <div>
          <div className="text-sm text-slate-500">AI suggestions</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-slate-50">{schoolSuggestionsCount}</div>
        </div>
        <div>
          <div className="text-sm text-slate-500">Created this week</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-sky-300">{createdThisWeek}</div>
        </div>
        <div>
          <div className="text-sm text-slate-500">Resolved this week</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">{resolvedThisWeek}</div>
        </div>
      </div>
      <div className="border-t border-slate-800/90 bg-slate-950/40 px-5 py-4">
        <Link
          href={interventionsHref}
          className="inline-block text-sm font-medium text-sky-400 hover:text-sky-300 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View interventions on Principal Dashboard →
        </Link>
      </div>
    </div>
  );
}
