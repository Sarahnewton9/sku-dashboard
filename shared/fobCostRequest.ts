export type FobCostRequestCandidate = {
  /** True when this physical SKU is new in the active season. */
  isNewSeasonSku: boolean;
  /** SKU Dash sample status for this physical SKU. */
  sampleStatus?: string | null;
  /** Actual imported factory FOB, in USD. */
  currentFobUsd?: number | null;
};

/**
 * A factory FOB request is deliberately a rolling operational list. It includes
 * only received samples from new-season SKUs and drops each SKU as soon as a
 * positive FOB is imported. This includes a new colourway on an existing style.
 */
export function isFobCostRequestEligible(candidate: FobCostRequestCandidate): boolean {
  if (!candidate.isNewSeasonSku) return false;
  const sampleStatus = String(candidate.sampleStatus ?? "").trim().toLowerCase();
  if (sampleStatus !== "received" && sampleStatus !== "fitting_sample") return false;
  const fob = Number(candidate.currentFobUsd);
  return !Number.isFinite(fob) || fob <= 0;
}
