/**
 * exportSpecSheet — generates an Excel file matching the factory spec sheet format exactly.
 *
 * Format reference (from MOMA-TONYBIANCODEVSUMMER2026.xls analysis):
 * - Font: Arial throughout
 * - Row 0: "Tony Bianco" Arial Bold 12pt | "Product Specification Report" Arial Regular 12pt
 * - Rows 2-6 (DATE/LAST/STYLE NAME/BRAND/SEASON): both label and value Arial Bold 8pt
 * - Row 8 (COMPONENTS + COLOUR headers): Arial Bold 8pt
 * - Component label rows (col A): Arial Regular 8pt, NOT bold
 * - Component value cells: Arial Regular 8pt, NOT bold
 * - No coloured backgrounds — pure white throughout
 * - Sections separated by blank spacer rows (not coloured section headers)
 * - Each colour occupies 2 columns (merged)
 * - Image in top-right area (rows 0-7, last colour columns)
 */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { getTemplateForCategory } from "@shared/specTemplates";

interface CustomRow {
  id: number;
  style: string;
  colour: string;
  section: string;
  title: string;
  value: string | null;
  sortOrder: number;
}

interface ExportSpecSheetParams {
  style: string;
  last: string;
  category: string;
  season?: string;
  colours: string[];           // raw colour keys (used as spec lookup keys)
  colourLabels?: string[];     // full display labels e.g. "BLACK NAPPA" — used as column headers
  specs: Record<string, Record<string, string>>; // colour → component → value
  hasBuckle?: boolean;
  dressShoeSubType?: "court" | "sling" | null;
  imageUrl?: string;
  customRows?: CustomRow[];    // user-defined extra rows per section
}

async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; extension: "jpeg" | "png" | "gif" } | null> {
  try {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxyUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const mimeType = blob.type || "image/jpeg";
    const ext: "jpeg" | "png" | "gif" = mimeType.includes("png")
      ? "png"
      : mimeType.includes("gif")
        ? "gif"
        : "jpeg";
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return { base64: btoa(binary), extension: ext };
  } catch {
    return null;
  }
}

// Arial font helpers
function arialBold12(): Partial<ExcelJS.Font> {
  return { name: "Arial", bold: true, size: 12 };
}
function arialRegular12(): Partial<ExcelJS.Font> {
  return { name: "Arial", bold: false, size: 12 };
}
function arialBold8(): Partial<ExcelJS.Font> {
  return { name: "Arial", bold: true, size: 8 };
}
function arialRegular8(): Partial<ExcelJS.Font> {
  return { name: "Arial", bold: false, size: 8 };
}

export async function exportSpecSheet(params: ExportSpecSheetParams) {
  const {
    style,
    last,
    category,
    season = "SS26",
    colours,
    colourLabels,
    specs,
    hasBuckle = false,
    dressShoeSubType = null,
    imageUrl,
    customRows = [],
  } = params;

  // Build a lookup: section -> sorted custom rows (colour-agnostic — use first colour's value or any)
  // Custom rows are per-section, and value is stored per colour. We'll show all unique titles
  // and for each colour column look up the value for that colour (or the "" default).
  const customRowsBySection: Record<string, Array<{ title: string; valuesByColour: Record<string, string> }>> = {};
  for (const cr of customRows) {
    if (!customRowsBySection[cr.section]) customRowsBySection[cr.section] = [];
    const existing = customRowsBySection[cr.section].find((r) => r.title === cr.title);
    if (existing) {
      existing.valuesByColour[cr.colour] = cr.value ?? "";
    } else {
      customRowsBySection[cr.section].push({
        title: cr.title,
        valuesByColour: { [cr.colour]: cr.value ?? "" },
      });
    }
  }

  const template = getTemplateForCategory(category, { hasBuckle, dressShoeSubType });
  const today = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Tony Bianco SKU Dashboard";
  wb.created = new Date();
  const ws = wb.addWorksheet("Sheet1");

  // ── Column widths ──────────────────────────────────────────────────────────
  // Col A: component labels (~28 chars)
  ws.getColumn(1).width = 30;
  // Each colour occupies 2 columns (merged), each ~18 chars
  const totalColCols = colours.length * 2;
  for (let i = 2; i <= 1 + totalColCols; i++) {
    ws.getColumn(i).width = 18;
  }

  // ── Fetch image ────────────────────────────────────────────────────────────
  let imageId: number | null = null;
  if (imageUrl) {
    const imgData = await fetchImageAsBase64(imageUrl);
    if (imgData) {
      imageId = wb.addImage({ base64: imgData.base64, extension: imgData.extension });
    }
  }

  // Helper: get the ExcelJS column letter for a 1-based col index
  // We use numeric addressing throughout so no need for letters.

  // Total columns used: 1 (label) + colours.length * 2 (merged pairs)
  const lastDataCol = 1 + colours.length * 2;

  // ── Row 1: Tony Bianco | Product Specification Report ─────────────────────
  // Col A: "Tony Bianco" bold 12pt
  // Col B: "Product Specification Report" regular 12pt
  // Image will sit in the right portion of the header block (rows 1-8)
  ws.getRow(1).height = 22;
  const r1 = ws.getRow(1);
  const r1c1 = ws.getCell(1, 1);
  r1c1.value = "Tony Bianco";
  r1c1.font = arialBold12();

  // Merge cols 2-4 for "Product Specification Report"
  ws.mergeCells(1, 2, 1, Math.min(4, lastDataCol));
  const r1c2 = ws.getCell(1, 2);
  r1c2.value = "Product Specification Report";
  r1c2.font = arialRegular12();

  // ── Row 2: blank spacer ────────────────────────────────────────────────────
  ws.getRow(2).height = 6;

  // ── Rows 3-7: DATE / LAST / STYLE NAME / BRAND / SEASON ───────────────────
  const headerRows: [string, string][] = [
    ["DATE:", today],
    ["LAST:", last.toUpperCase()],
    ["STYLE NAME:", style.toUpperCase()],
    ["BRAND:", "Tony Bianco"],
    ["SEASON:", season],
  ];

  for (let i = 0; i < headerRows.length; i++) {
    const excelRow = 3 + i; // rows 3-7
    ws.getRow(excelRow).height = 14;
    const [label, value] = headerRows[i];

    const labelCell = ws.getCell(excelRow, 1);
    labelCell.value = label;
    labelCell.font = arialBold8();

    // Merge cols 2-4 for the value
    ws.mergeCells(excelRow, 2, excelRow, Math.min(4, lastDataCol));
    const valueCell = ws.getCell(excelRow, 2);
    valueCell.value = value;
    valueCell.font = arialBold8();
  }

  // ── Row 8: blank spacer ────────────────────────────────────────────────────
  ws.getRow(8).height = 6;

  // ── Embed image at exactly 5 cm × 5 cm in top-right of header ───────────────
  // ExcelJS uses EMU (English Metric Units): 1 cm = 360000 EMU
  // We anchor at the top-right corner of the sheet (col A row 1 = tl {col:0, row:0})
  // and use ext to fix the size to exactly 5 cm × 5 cm.
  if (imageId !== null) {
    const fiveCmEmu = 5 * 360000; // 1800000 EMU = 5 cm
    // Anchor top-left of image at the start of the last colour column pair
    const imgAnchorCol = Math.max(1, lastDataCol - 1); // 0-based col index
    ws.addImage(imageId, {
      tl: { col: imgAnchorCol, row: 0 },
      ext: { width: fiveCmEmu, height: fiveCmEmu },
      editAs: "oneCell",
    } as unknown as ExcelJS.ImageRange);
  }

  // ── Row 9: COMPONENTS + COLOUR headers ────────────────────────────────────
  ws.getRow(9).height = 16;
  const compHeaderCell = ws.getCell(9, 1);
  compHeaderCell.value = "COMPONENTS";
  compHeaderCell.font = arialBold8();

  for (let i = 0; i < colours.length; i++) {
    const colStart = 2 + i * 2;
    const colEnd = colStart + 1;
    ws.mergeCells(9, colStart, 9, colEnd);
    const cell = ws.getCell(9, colStart);
    // Use full colour+leather label if provided, otherwise fall back to raw colour name
    cell.value = (colourLabels?.[i] ?? colours[i]).toUpperCase();
    cell.font = arialBold8();
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }

  // ── Row 10: blank (part of merged COMPONENTS header in original) ───────────
  ws.getRow(10).height = 6;

  // ── Component rows ─────────────────────────────────────────────────────────
  // Group by section; sections are separated by a blank spacer row
  const sectionMap: Record<string, typeof template> = {};
  for (const comp of template) {
    if (!sectionMap[comp.section]) sectionMap[comp.section] = [];
    sectionMap[comp.section].push(comp);
  }

  let currentExcelRow = 11;
  const sectionEntries = Object.entries(sectionMap);

  for (let si = 0; si < sectionEntries.length; si++) {
    const [, components] = sectionEntries[si];

    for (const comp of components) {
      const values = colours.map((colour) => specs[colour]?.[comp.key] ?? "");

      ws.getRow(currentExcelRow).height = 14;

      // Col A: component label — Arial Regular 8pt
      const labelCell = ws.getCell(currentExcelRow, 1);
      labelCell.value = comp.label.toUpperCase();
      labelCell.font = arialRegular8();
      labelCell.alignment = { vertical: "middle" };

      // Colour value cells — merged pairs, Arial Regular 8pt
      for (let ci = 0; ci < colours.length; ci++) {
        const colStart = 2 + ci * 2;
        const colEnd = colStart + 1;
        ws.mergeCells(currentExcelRow, colStart, currentExcelRow, colEnd);
        const valueCell = ws.getCell(currentExcelRow, colStart);
        valueCell.value = values[ci] || "";
        valueCell.font = arialRegular8();
        valueCell.alignment = { vertical: "middle", wrapText: true };
      }

      currentExcelRow++;
    }

    // Append custom rows for this section (after standard rows, before spacer)
    const sectionName = sectionEntries[si][0];
    const sectionCustomRows = customRowsBySection[sectionName] ?? [];
    for (const cr of sectionCustomRows) {
      ws.getRow(currentExcelRow).height = 14;

      const labelCell = ws.getCell(currentExcelRow, 1);
      labelCell.value = cr.title.toUpperCase();
      labelCell.font = arialRegular8();
      labelCell.alignment = { vertical: "middle" };

      for (let ci = 0; ci < colours.length; ci++) {
        const colStart = 2 + ci * 2;
        const colEnd = colStart + 1;
        ws.mergeCells(currentExcelRow, colStart, currentExcelRow, colEnd);
        const valueCell = ws.getCell(currentExcelRow, colStart);
        valueCell.value = cr.valuesByColour[colours[ci]] ?? "";
        valueCell.font = arialRegular8();
        valueCell.alignment = { vertical: "middle", wrapText: true };
      }

      currentExcelRow++;
    }

    // Blank spacer row between sections (not after the last section)
    if (si < sectionEntries.length - 1) {
      ws.getRow(currentExcelRow).height = 8;
      currentExcelRow++;
    }
  }

  // ── Generate and download ──────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `${style.toUpperCase()}-TONYBIANCO-${season.replace(/\s+/g, "")}.xlsx`;
  saveAs(blob, filename);
}
