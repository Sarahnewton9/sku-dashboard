export type FobCostRequestCandidate = {
  /** True only when the entire active style is a new-season style. */
  isNewSeasonStyle: boolean;
  /** SKU Dash sample status for this physical SKU. */
  sampleStatus?: string | null;
  /** Actual imported factory FOB, in USD. */
  currentFobUsd?: number | null;
};

/**
 * A factory FOB request is deliberately a rolling operational list. It includes
 * only received samples from styles that are entirely new this season and drops
 * each SKU as soon as a positive FOB is imported.
 */
export function isFobCostRequestEligible(candidate: FobCostRequestCandidate): boolean {
  if (!candidate.isNewSeasonStyle) return false;
  if (String(candidate.sampleStatus ?? "").trim().toLowerCase() !== "received") return false;
  const fob = Number(candidate.currentFobUsd);
  return !Number.isFinite(fob) || fob <= 0;
}
