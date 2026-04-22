/**
 * exportSpecSheet — generates an Excel file matching the factory spec sheet format.
 *
 * Layout:
 *   Row 1: Tony Bianco | Product Specification Report | ... | Page 1 of 1
 *   Row 2: DATE: | <date>
 *   Row 3: LAST: | <last>
 *   Row 4: STYLE NAME: | <style>
 *   Row 5: BRAND: | Tony Bianco
 *   Row 6: SEASON: | <season>
 *   Row 7: COMPONENTS | COLOUR 1 | COLOUR 2 | ...
 *   Row 8+: <component label> | <value per colour>
 */

import * as XLSX from "xlsx";
import { getTemplateForCategory } from "@shared/specTemplates";

interface ExportSpecSheetParams {
  style: string;
  last: string;
  category: string;
  season?: string;
  colours: string[];
  specs: Record<string, Record<string, string>>; // colour → component → value
  hasBuckle?: boolean;
  dressShoeSubType?: "court" | "sling" | null;
}

export function exportSpecSheet(params: ExportSpecSheetParams) {
  const {
    style, last, category, season = "SS26", colours, specs,
    hasBuckle = false, dressShoeSubType = null,
  } = params;

  const template = getTemplateForCategory(category, { hasBuckle, dressShoeSubType });
  const today = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });

  // Build rows
  const rows: (string | number | null)[][] = [];

  // Header rows
  rows.push(["Tony Bianco", "Product Specification Report", "", "", "", "", `Page 1 of 1  Printed: ${today}`, "", "", ""]);
  rows.push(["DATE:", today, ...Array(colours.length - 1).fill("")]);
  rows.push(["LAST:", last, ...Array(colours.length - 1).fill("")]);
  rows.push(["STYLE NAME:", style, ...Array(colours.length - 1).fill("")]);
  rows.push(["BRAND:", "Tony Bianco", ...Array(colours.length - 1).fill("")]);
  rows.push(["SEASON:", season, ...Array(colours.length - 1).fill("")]);

  // Column headers: COMPONENTS | COLOUR 1 | COLOUR 2 | ...
  rows.push(["COMPONENTS", ...colours.map((_, i) => `COLOUR ${i + 1}`)]);

  // Colour name row (actual colour names)
  rows.push(["", ...colours]);

  // Component rows
  for (const comp of template) {
    const row: (string | null)[] = [comp.label.toUpperCase()];
    for (const colour of colours) {
      row.push(specs[colour]?.[comp.key] ?? "");
    }
    rows.push(row);
  }

  // Build worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  const colWidths = [{ wch: 36 }, ...colours.map(() => ({ wch: 28 }))];
  ws["!cols"] = colWidths;

  // Style header rows (bold)
  const headerRows = [0, 1, 2, 3, 4, 5, 6, 7];
  for (const r of headerRows) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true } };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const filename = `${style.toUpperCase()}-TONYBIANCO-${season.replace(/\s+/g, "")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
