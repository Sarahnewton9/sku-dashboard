export const AU_RRP_LADDER = [
  99.95, 119.95, 129.95, 139.95, 149.95, 159.95, 169.95, 179.95,
  189.95, 199.95, 209.95, 219.95, 229.95, 239.95, 249.95, 259.95,
  269.95, 279.95, 289.95, 299.95, 319.95, 329.95, 349.95, 369.95,
  399.95, 429.95, 449.95, 499.95,
] as const;

/** The range-planning goal. Margins from 70% to 74.9% remain acceptable. */
export const DEFAULT_MARGIN_TARGET = 0.75;
export const MARGIN_TOLERANCE_FLOOR = 0.70;

export type MarginStatus = "on_target" | "within_tolerance" | "below_tolerance";

export function getMarginStatus(
  margin: number | null,
  targetMargin = DEFAULT_MARGIN_TARGET,
): MarginStatus | null {
  if (margin == null || !Number.isFinite(margin)) return null;
  if (margin < MARGIN_TOLERANCE_FLOOR - 0.0001) return "below_tolerance";
  if (margin < targetMargin - 0.0001) return "within_tolerance";
  return "on_target";
}

export function snapToAuRrpLadder(value: number): number {
  const ladderValue = AU_RRP_LADDER.find((price) => price >= value - 0.001);
  if (ladderValue != null) return ladderValue;
  return Math.ceil(value / 10) * 10 - 0.05;
}

/**
 * Recommends an AU GST-inclusive RRP from the Buy Plan's AUD landed cost and
 * desired gross margin. The result rounds up to an established retail point.
 */
export function getSuggestedAuRrp(landedCost: number, targetMargin: number): number | null {
  if (!Number.isFinite(landedCost) || landedCost <= 0 || !Number.isFinite(targetMargin) || targetMargin <= 0 || targetMargin >= 1) return null;
  return snapToAuRrpLadder((landedCost / (1 - targetMargin)) * 1.1);
}

/** Gross margin from an AUD landed cost and AU retail price excluding 10% GST. */
export function getAuGrossMargin(landedCost: number, rrpIncGst: number): number | null {
  if (!Number.isFinite(landedCost) || landedCost < 0 || !Number.isFinite(rrpIncGst) || rrpIncGst <= 0) return null;
  return 1 - landedCost / (rrpIncGst / 1.1);
}
