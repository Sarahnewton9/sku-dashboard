export type SpecsSearchableStyle = {
  style: string;
  last: string;
  category: string;
  /** Display labels for active physical SKU columns. */
  colourLabels: readonly string[];
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/**
 * Match the Specs library by style, last, category, or the physical SKU's
 * Upper 1 colour/leather. Upper 2 is intentionally not searched here: a
 * query such as "PETAL NAPPA" should find styles whose Upper 1 is Petal
 * Nappa, not a style that only uses it as a secondary upper.
 */
export function matchesSpecsStyleSearch(style: SpecsSearchableStyle, query: string): boolean {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  const upperOneLabels = style.colourLabels.map((label) => label.split("/")[0] ?? label);
  return [style.style, style.last, style.category, ...upperOneLabels]
    .some((value) => normalize(value).includes(normalizedQuery));
}
