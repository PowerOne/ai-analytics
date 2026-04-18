import type { HeatmapCell } from "@/lib/types";
import { cn } from "@/lib/cn";

function cellColor(avgRisk: number): string {
  const x = avgRisk <= 1.0001 ? avgRisk * 100 : avgRisk;
  if (x < 33) return "bg-emerald-500 shadow-inner";
  if (x < 66) return "bg-amber-500 shadow-inner";
  return "bg-rose-600 shadow-inner";
}

export function NocHeatmapGrid({
  cells,
  onCellClick,
}: {
  cells: HeatmapCell[];
  onCellClick?: (cell: HeatmapCell) => void;
}) {
  if (cells.length === 0) {
    return <p className="text-sm text-slate-500">No cohort snapshot rows.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {cells.map((c) => (
          <button
            key={`${c.classId}-${c.grade}`}
            type="button"
            title={`${c.classLabel} · risk ${Number.isFinite(c.avgRisk) ? c.avgRisk.toFixed(1) : "—"}`}
            onClick={() => onCellClick?.(c)}
            className={cn(
              "aspect-square min-h-[2rem] rounded-sm border border-slate-950/80 ring-1 ring-black/20",
              cellColor(c.avgRisk),
              onCellClick &&
                "cursor-pointer outline-none hover:ring-2 hover:ring-sky-400/70 focus-visible:ring-2 focus-visible:ring-sky-400/80",
            )}
          />
        ))}
      </div>
      <p className="text-center text-sm font-medium text-slate-500">Cohort Risk Heatmap</p>
    </div>
  );
}
