export type ColourLeatherUpperSearchEntry = {
  upper1Label: string;
  upper2Label?: string | null;
};

export type ColourLeatherUpperSearchFilters = {
  upper1Query?: string;
  upper2Query?: string;
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function includesQuery(value: string | null | undefined, query: string): boolean {
  return normalize(value ?? "").includes(query);
}

/**
 * Matches one physical SKU's ordered uppers. A compact Upper 1/Upper 2 lookup
 * in the first field is also accepted. This is intentionally SKU-level, so a
 * primary upper and secondary upper can never be matched across different SKUs.
 */
export function matchesColourLeatherUpperSearch(
  sku: ColourLeatherUpperSearchEntry,
  filters: ColourLeatherUpperSearchFilters,
): boolean {
  const upper1Query = normalize(filters.upper1Query ?? "");
  const upper2Query = normalize(filters.upper2Query ?? "");
  if (!upper1Query && !upper2Query) return true;

  const [compactUpper1, ...compactUpper2Parts] = upper1Query.split("/");
  const compactUpper2 = normalize(compactUpper2Parts.join("/"));
  const primaryQuery = normalize(compactUpper1);

  return (!primaryQuery || includesQuery(sku.upper1Label, primaryQuery))
    && (!compactUpper2 || includesQuery(sku.upper2Label, compactUpper2))
    && (!upper2Query || includesQuery(sku.upper2Label, upper2Query));
}
