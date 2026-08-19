export type MarkdownSkuRecord = {
  styleCode: string;
  colour: string;
  status: string;
};

/**
 * Build the canonical set of SKU keys excluded from dashboard range data.
 * Records are global to the range, so the same list applies to SS26 and W27.
 */
export function buildMarkdownSkuSet(records: readonly MarkdownSkuRecord[]): Set<string> {
  const set = new Set<string>();

  for (const record of records) {
    if (record.status === "restored") continue;

    const style = record.styleCode.trim().toUpperCase();
    const colourLeather = record.colour.trim().toUpperCase();
    if (!style || !colourLeather) continue;

    set.add(`${style}|${colourLeather}`);

    // Website labels can include a secondary material after a slash, while the
    // range uses the primary colour/leather combination. Keep both forms so an
    // entry such as BLACK VINTAGE/SHEARLING hides BLACK VINTAGE as intended.
    const primaryColourLeather = colourLeather.split("/")[0].trim();
    if (primaryColourLeather) set.add(`${style}|${primaryColourLeather}`);
  }

  return set;
}

/** Return true when a dashboard SKU should be hidden as a markdown. */
export function isMarkdownSku(
  markdownSkuSet: ReadonlySet<string>,
  style: string,
  colour: string,
  leather: string | null | undefined,
): boolean {
  const key = `${style.trim().toUpperCase()}|${[colour, leather].filter(Boolean).join(" ").trim().toUpperCase()}`;
  return markdownSkuSet.has(key);
}
