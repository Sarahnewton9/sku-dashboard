/**
 * Factory-facing filename used for all Specs workbook downloads in the W27
 * development cycle.
 */
export function getSpecExportFilename(style: string): string {
  return `${style.trim().toUpperCase()}- TONY BIANCO DEV WINTER 2027.xlsx`;
}
