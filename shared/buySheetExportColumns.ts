export type BuySheetExportColumnOptions = {
  includeCosts?: boolean;
  hasUsa?: boolean;
  hasNyc?: boolean;
  hasLa?: boolean;
};

/**
 * Keeps the normal Buy Sheet compact while allowing a deliberate cost-inclusive
 * export. Buy share is a dashboard analysis measure and is intentionally not
 * part of either spreadsheet layout.
 */
export function getBuySheetExportHeaders({
  includeCosts = false,
  hasUsa = false,
  hasNyc = false,
  hasLa = false,
}: BuySheetExportColumnOptions = {}): string[] {
  const headers = [
    "CATEGORY",
    "LAST",
    "SIZE 11",
    "STYLE",
    "COLOUR",
    "AP21 SKU COLOUR",
  ];

  if (includeCosts) headers.push("FOB (USD)");
  headers.push("AU QTY");
  if (hasUsa) headers.push("USA QTY");
  if (hasNyc) headers.push("NYC QTY");
  if (hasLa) headers.push("LA QTY");
  headers.push("TOTAL QTY");
  return headers;
}
