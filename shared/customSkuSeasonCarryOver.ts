/**
 * Returns the carry-over target for a custom SKU added to a source season.
 * SS26 custom colourways are part of the W27 run-on range and must be stored
 * as existing W27 SKUs. W27-originated colourways do not cascade anywhere.
 */
export function getCustomSkuCarryOverSeason(season: string | null | undefined): "W27" | null {
  return String(season ?? "").trim().toUpperCase() === "SS26" ? "W27" : null;
}
