import type { StudentRow } from "@/lib/types";
import { cn } from "@/lib/cn";

export function RiskBadge({ level }: { level: StudentRow["riskLevel"] }) {
  const styles = {
    LOW: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    MEDIUM: "bg-amber-500/20 text-amber-200 border-amber-500/40",
    HIGH: "bg-red-500/20 text-red-300 border-red-500/40",
    UNKNOWN: "bg-slate-500/20 text-slate-400 border-slate-500/40",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        styles[level],
      )}
    >
      {level}
    </span>
  );
}
