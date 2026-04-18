import type { SchoolTrendSummary } from "@/lib/dashboard-types";
import { cn } from "@/lib/cn";

function signedClass(delta: number): string {
  if (!Number.isFinite(delta)) return "text-slate-500";
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-rose-400";
  return "text-slate-400";
}

export function NocTrendDelta({
  trends,
  onOpenDetail,
}: {
  trends: SchoolTrendSummary;
  onOpenDetail?: () => void;
}) {
  const rows: { label: string; value: number; suffix: string }[] = [
    { label: "Performance delta", value: trends.performanceDelta, suffix: "%" },
    { label: "Attendance delta", value: trends.attendanceDelta, suffix: "%" },
    { label: "Engagement delta", value: trends.engagementDelta, suffix: "%" },
  ];

  return (
    <div
      className={cn(
        "space-y-0 rounded-xl border border-slate-600/70 bg-slate-900/50 p-5 shadow-sm transition-[border-color,box-shadow] duration-200",
        onOpenDetail &&
          "cursor-pointer hover:border-sky-500/45 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500/50",
      )}
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        if (onOpenDetail && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      role={onOpenDetail ? "button" : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
    >
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={cn(
            "flex items-center justify-between py-3 text-sm",
            i > 0 && "border-t border-slate-800/80",
          )}
        >
          <span className="text-sm text-slate-500">{r.label}</span>
          <span className={cn("font-mono text-base font-semibold tabular-nums", signedClass(r.value))}>
            {Number.isFinite(r.value) ? `${r.value > 0 ? "+" : ""}${r.value.toFixed(1)}${r.suffix}` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
