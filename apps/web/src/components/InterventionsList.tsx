"use client";

export interface InterventionListItem {
  id: string;
  title: string;
  status: string;
  subtitle?: string;
}

export function InterventionsList({
  title = "Interventions & alerts",
  items,
  emptyMessage = "No items to show.",
}: {
  title?: string;
  items: InterventionListItem[];
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-100">{item.title}</span>
                <StatusPill status={item.status} />
              </div>
              {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const open = s === "open" || s === "new";
  const resolved = s === "resolved" || s === "done";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        resolved
          ? "bg-emerald-500/20 text-emerald-300"
          : open
            ? "bg-amber-500/20 text-amber-200"
            : "bg-sky-500/20 text-sky-200"
      }`}
    >
      {status}
    </span>
  );
}
