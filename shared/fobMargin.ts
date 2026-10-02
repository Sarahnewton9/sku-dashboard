export const FOB_MARGIN_ASSUMPTIONS = {
  /** Summer 26 planning conversion basis: 1 AUD = US$0.70. */
  usdToAud: 0.70,
  /** Standard freight allowance applied per pair after currency conversion. */
  freightAud: 1.25,
  targetMargin: 0.75,
  toleranceFloor: 0.70,
} as const;

const AU_RRP_LADDER = [
  99.95, 119.95, 129.95, 139.95, 149.95, 159.95, 169.95, 179.95,
  189.95, 199.95, 209.95, 219.95, 229.95, 239.95, 249.95, 259.95,
  269.95, 279.95, 289.95, 299.95, 319.95, 329.95, 349.95, 369.95,
  399.95, 429.95, 449.95, 499.95,
] as const;

export type MarginStatus = "on_target" | "within_tolerance" | "below_tolerance";

/** Converts SKU Dash factory FOB (USD) to a planning landed cost in AUD. */
export function getEstimatedLandedCostAud(fobUsd: number): number | null {
  if (!Number.isFinite(fobUsd) || fobUsd <= 0) return null;
  return fobUsd / FOB_MARGIN_ASSUMPTIONS.usdToAud + FOB_MARGIN_ASSUMPTIONS.freightAud;
}

/** Gross margin on an AU RRP inclusive of GST, using the planning landed-cost conversion. */
export function getAuGrossMarginFromFob(fobUsd: number, rrpIncGst: number): number | null {
  const landedCost = getEstimatedLandedCostAud(fobUsd);
  if (landedCost == null || !Number.isFinite(rrpIncGst) || rrpIncGst <= 0) return null;
  return 1 - landedCost / (rrpIncGst / 1.1);
}

/** Returns the next established AU retail point that meets the requested gross margin. */
export function getSuggestedAuRrpFromFob(
  fobUsd: number,
  targetMargin = FOB_MARGIN_ASSUMPTIONS.targetMargin,
): number | null {
  const landedCost = getEstimatedLandedCostAud(fobUsd);
  if (landedCost == null || !Number.isFinite(targetMargin) || targetMargin <= 0 || targetMargin >= 1) return null;
  const requiredRrp = (landedCost / (1 - targetMargin)) * 1.1;
  const ladderValue = AU_RRP_LADDER.find((price) => price >= requiredRrp - 0.001);
  return ladderValue ?? Math.ceil(requiredRrp / 10) * 10 - 0.05;
}

export function getMarginStatus(margin: number | null): MarginStatus | null {
  if (margin == null || !Number.isFinite(margin)) return null;
  if (margin < FOB_MARGIN_ASSUMPTIONS.toleranceFloor - 0.0001) return "below_tolerance";
  if (margin < FOB_MARGIN_ASSUMPTIONS.targetMargin - 0.0001) return "within_tolerance";
  return "on_target";
}
