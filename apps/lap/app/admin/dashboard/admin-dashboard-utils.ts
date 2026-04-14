import type { DashboardIntervention, DashboardStudent } from "./types";

export function normalizeGradeLabel(gradeLevel: string | null | undefined): string {
  const g = (gradeLevel ?? "").trim();
  return g.length ? g : "Unassigned";
}

export function buildGradeBars(students: DashboardStudent[]) {
  const map = new Map<string, number>();
  for (const s of students) {
    const key = normalizeGradeLabel(s.gradeLevel);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([grade, count]) => ({ grade, count }));
}

export function buildInterventionTrend(interventions: DashboardIntervention[], days = 14) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  const counts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    counts.set(d.toISOString().slice(0, 10), 0);
  }

  const startMs = start.getTime();
  const endExclusive = end.getTime() + 86_400_000;

  for (const inv of interventions) {
    const t = new Date(inv.createdAt).getTime();
    if (t < startMs || t >= endExclusive) continue;
    const key = new Date(inv.createdAt).toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

export function buildStatusSlices(interventions: DashboardIntervention[]) {
  const map = new Map<string, number>();
  for (const inv of interventions) {
    const s = inv.status || "unknown";
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

export function formatShortDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
