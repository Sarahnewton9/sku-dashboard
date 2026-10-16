export type BuySheetExportColumnOptions = {
  includeCosts?: boolean;
  hasUsa?: boolean;
  hasNyc?: boolean;
  hasLa?: boolean;
};

/**
 * The literal US$ text must be quoted. An unquoted `US$` is read by common
 * Excel parsers as a date/time token and can make an otherwise valid workbook
 * appear blank or corrupt when opened.
 */
export const BUY_SHEET_FOB_USD_NUMBER_FORMAT = '"US$"#,##0.00';

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
