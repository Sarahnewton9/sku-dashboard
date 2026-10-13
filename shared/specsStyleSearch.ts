export type SpecsSearchableStyle = {
  style: string;
  last: string;
  category: string;
  /** Display labels for active physical SKU columns. */
  colourLabels: readonly string[];
};

export type SpecsStyleSearchFilters = {
  /** Searches the style library and the physical SKU's Upper 1. */
  query?: string;
  /** Restricts the search to an Upper 2 on the same physical SKU. */
  upper2Query?: string;
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function getUpperParts(label: string): { upper1: string; upper2: string } {
  const [upper1 = "", ...upper2Parts] = label.split("/");
  return { upper1, upper2: upper2Parts.join("/") };
}

function includesQuery(value: string, query: string): boolean {
  return normalize(value).includes(query);
}

/**
 * Searches the Specs library by style/last/category or a physical SKU's ordered
 * uppers. When both Upper 1 and Upper 2 filters are supplied, they must match
 * the **same SKU label** — not two independent colourways on the same style.
 */
export function matchesSpecsStyleSearchFilters(
  style: SpecsSearchableStyle,
  filters: SpecsStyleSearchFilters,
): boolean {
  const query = normalize(filters.query ?? "");
  const upper2Query = normalize(filters.upper2Query ?? "");
  if (!query && !upper2Query) return true;

  const labels = style.colourLabels.map((label) => ({ label, ...getUpperParts(label) }));
  const [compoundUpper1, ...compoundUpper2Parts] = query.split("/");
  const compoundUpper2 = compoundUpper2Parts.join("/");
  const isCompoundSkuQuery = Boolean(compoundUpper2);
  const matchesLibrary = query
    ? [style.style, style.last, style.category].some((value) => includesQuery(value, query))
    : false;

  let candidates = labels;
  if (query) {
    candidates = isCompoundSkuQuery
      ? labels.filter(({ upper1, upper2 }) => includesQuery(upper1, compoundUpper1) && includesQuery(upper2, compoundUpper2))
      : matchesLibrary
        ? labels
        : labels.filter(({ upper1 }) => includesQuery(upper1, query));
  }

  return upper2Query
    ? candidates.some(({ upper2 }) => includesQuery(upper2, upper2Query))
    : candidates.length > 0;
}

/**
 * Match the Specs library by style, last, category, or the physical SKU's
 * Upper 1 colour/leather. This preserves the original one-search-field
 * behaviour; the Specs library also exposes an optional Upper 2 filter.
 */
export function matchesSpecsStyleSearch(style: SpecsSearchableStyle, query: string): boolean {
  return matchesSpecsStyleSearchFilters(style, { query });
}
