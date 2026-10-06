/**
 * Returns the share of a buy represented by a unit quantity.
 * A zero or unavailable total is treated as 0%, avoiding misleading NaN values.
 */
export function getBuyShare(units: number, totalUnits: number): number {
  if (!Number.isFinite(units) || !Number.isFinite(totalUnits) || totalUnits <= 0) return 0;
  return Math.max(0, (units / totalUnits) * 100);
}

/** Formats a buy share consistently for dashboard display. */
export function formatBuyShare(units: number, totalUnits: number, digits = 1): string {
  return `${getBuyShare(units, totalUnits).toFixed(digits)}%`;
}
