export const HANDBAG_SEASONALITY_OPTIONS = [
  "Core / Carry Over",
  "SS26",
  "W27",
] as const;

export type HandbagSeasonality = (typeof HANDBAG_SEASONALITY_OPTIONS)[number];

type HandbagSeasonalitySource = {
  seasonality?: string | null;
  section?: string | null;
};

/**
 * Uses the new handbag-only seasonality first, retains the legacy linesheet
 * section for current range data, then falls back to the parent style value.
 */
export function getHandbagSeasonality(
  sku: HandbagSeasonalitySource | null | undefined,
  parentSeasonality?: string | null,
): string {
  return sku?.seasonality?.trim()
    || sku?.section?.trim()
    || parentSeasonality?.trim()
    || "Unassigned";
}

export function normalizeHandbagSeasonality(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
