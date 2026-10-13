export type ColourLeatherUpperSearchEntry = {
  upper1Label: string;
  upper2Label?: string | null;
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function includesQuery(value: string | null | undefined, query: string): boolean {
  return normalize(value ?? "").includes(query);
}

/**
 * Matches a single physical SKU when the query appears in **either** Upper 1
 * or Upper 2. This gives the Colour/Leather library one practical material
 * lookup without requiring users to know which upper contains the material.
 */
export function matchesColourLeatherUpperSearch(
  sku: ColourLeatherUpperSearchEntry,
  query: string,
): boolean {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  return includesQuery(sku.upper1Label, normalizedQuery)
    || includesQuery(sku.upper2Label, normalizedQuery);
}
