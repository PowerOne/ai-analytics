import { cn } from "@/lib/cn";

const accentClass: Record<"slate" | "green" | "yellow" | "red", string> = {
  slate: "border-slate-600/90 bg-slate-900/70 bg-gradient-to-br from-slate-900/90 to-slate-950/80",
  green:
    "border-emerald-600/50 bg-emerald-950/50 bg-gradient-to-br from-emerald-950/60 to-slate-950/70",
  yellow:
    "border-amber-600/50 bg-amber-950/45 bg-gradient-to-br from-amber-950/55 to-slate-950/70",
  red: "border-rose-600/50 bg-rose-950/45 bg-gradient-to-br from-rose-950/55 to-slate-950/70",
};

export function NocTile({
  title,
  value,
  subtitle,
  accent = "slate",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: keyof typeof accentClass;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 shadow-sm transition-shadow duration-200",
        accentClass[accent],
        "hover:border-sky-500/35 hover:shadow-md",
      )}
    >
      <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="mt-3 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-50">
        {value}
      </div>
      {subtitle ? <div className="mt-2 text-sm text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

/** Maps weighted average risk (0–100 or 0–1) to tile accent. */
export function avgRiskAccent(avgRisk: number): "green" | "yellow" | "red" {
  const x = avgRisk <= 1.0001 ? avgRisk : avgRisk / 100;
  if (x < 0.33) return "green";
  if (x < 0.66) return "yellow";
  return "red";
}
