function getSnapshotValue(row: any, field: string): number {
  return row?.[field] ?? 0;
}

/** Snapshot-based stability: raw week-over-week deltas (inverted risk: lower is better). */
export function computeSnapshotStability(t: any, l: any): number {
  const perfDelta = getSnapshotValue(t, "performance") - getSnapshotValue(l, "performance");
  const attDelta = getSnapshotValue(t, "attendance") - getSnapshotValue(l, "attendance");
  const engDelta = getSnapshotValue(t, "engagement") - getSnapshotValue(l, "engagement");
  const riskDelta = getSnapshotValue(l, "riskScore") - getSnapshotValue(t, "riskScore");

  // riskDelta is inverted because lower risk is better

  return perfDelta + attDelta + engDelta + riskDelta;
}
