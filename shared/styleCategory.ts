export type StyleCategoryResolutionInput = {
  baseCategory: string | null | undefined;
  last?: string | null;
  subCategory?: string | null;
  trendFlag?: string | null;
  trends?: string | string[] | null;
};

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizeTrendValues(value: StyleCategoryResolutionInput["trends"]): string[] {
  if (Array.isArray(value)) return value.map(normalize).filter(Boolean);
  if (!value) return [];

  const raw = String(value).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((entry) => normalize(String(entry))).filter(Boolean);
  } catch {
    // Legacy values may be a plain single trend rather than JSON.
  }
  return [normalize(raw)].filter(Boolean);
}

/**
 * Resolves the operational category used by range views and Buy Sheet exports.
 * An explicit sub-category is authoritative. Trend labels are descriptive and
 * only collapse genuine Ballet Flat / Loafer base categories into Casual Flat;
 * labels such as Toe Cap, Mesh or Slingback must never reclassify a Dress Shoe.
 * Every style on the MADDI last is a Dress Shoe, including legacy records that
 * still carry obsolete Ballet or Casual Flat metadata.
 */
export function resolveStyleCategory({
  baseCategory,
  last,
  subCategory,
  trendFlag,
  trends,
}: StyleCategoryResolutionInput): string {
  if (normalize(last) === "MADDI") return "DRESS SHOE";

  const explicitCategory = normalize(subCategory);
  if (explicitCategory) return explicitCategory;

  const base = normalize(baseCategory);
  const tags = new Set([...normalizeTrendValues(trends), normalize(trendFlag)].filter(Boolean));
  const hasFlatTrend = tags.has("BALLET") || tags.has("LOAFER");
  const isFlatBase = base === "BALLET FLAT" || base === "LOAFER" || base === "CASUAL FLAT";

  return hasFlatTrend && isFlatBase ? "CASUAL FLAT" : base;
}
