/**
 * exportSpecSheet — generates an Excel file matching the ROXIE factory spec sheet format.
 *
 * Format (matching ROXIE-TONYBIANCODEVSUMMER2026.xls exactly):
 * - A4 Landscape
 * - 7 colours per block; if >7 colours, a second block starts below the first on the same sheet
 * - Font: Arial throughout
 * - Row 1: "Tony Bianco" bold 12pt | "Product Specification Report" regular 12pt
 * - Row 2: blank spacer
 * - Rows 3-7: DATE / LAST / STYLE NAME / BRAND / SEASON (Arial Bold 8pt)
 * - Row 8: blank spacer
 * - Row 9: COMPONENTS + "COLOUR 1" … "COLOUR 7" headers (Arial Bold 8pt, grey fill)
 * - Row 10: blank (colour labels row — empty in ROXIE, but we use it for colour names)
 * - Row 11+: component rows, blank spacer rows between groups
 * - After last component row: second block header (COMPONENTS / COLOUR 8…14) if needed
 * - Single column per colour (not merged pairs)
 * - Image in top-right area (rows 1-8)
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
  colours: string[];
  colourLabels?: string[];
  specs: Record<string, Record<string, string>>;
  hasBuckle?: boolean;
  dressShoeSubType?: "court" | "sling" | null;
  imageUrl?: string;
  customRows?: CustomRow[];
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

function arialBold12(): Partial<ExcelJS.Font> { return { name: "Arial", bold: true, size: 12 }; }
function arialRegular12(): Partial<ExcelJS.Font> { return { name: "Arial", bold: false, size: 12 }; }
function arialBold8(): Partial<ExcelJS.Font> { return { name: "Arial", bold: true, size: 8 }; }
function arialRegular8(): Partial<ExcelJS.Font> { return { name: "Arial", bold: false, size: 8 }; }

const COLOURS_PER_BLOCK = 7;
// A4 landscape ~113 char-units wide. Label col 30 + 7 × 12 = 114. Fits perfectly.
const LABEL_COL_WIDTH = 30;
const COLOUR_COL_WIDTH = 12;
const GREY_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };

export async function exportSpecSheet(params: ExportSpecSheetParams) {
  const {
    style,
    last,
    category,
    season = "DEV SUMMER 2026",
    colours,
    colourLabels,
    specs,
    hasBuckle = false,
    dressShoeSubType = null,
    imageUrl,
    customRows = [],
  } = params;

  // Build custom rows lookup: section → [{title, valuesByColour}]
  const customRowsBySection: Record<string, Array<{ title: string; valuesByColour: Record<string, string> }>> = {};
  for (const cr of customRows) {
    if (!customRowsBySection[cr.section]) customRowsBySection[cr.section] = [];
    const existing = customRowsBySection[cr.section].find((r) => r.title === cr.title);
    if (existing) {
      existing.valuesByColour[cr.colour] = cr.value ?? "";
    } else {
      customRowsBySection[cr.section].push({ title: cr.title, valuesByColour: { [cr.colour]: cr.value ?? "" } });
    }
  }

  const template = getTemplateForCategory(category, { hasBuckle, dressShoeSubType, style });
  const today = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });

  // Split colours into blocks of 7
  const blocks: Array<{ colours: string[]; labels: string[]; offset: number }> = [];
  for (let i = 0; i < Math.max(1, colours.length); i += COLOURS_PER_BLOCK) {
    blocks.push({
      colours: colours.slice(i, i + COLOURS_PER_BLOCK),
      labels: (colourLabels ?? colours).slice(i, i + COLOURS_PER_BLOCK),
      offset: i,
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Tony Bianco SKU Dashboard";
  wb.created = new Date();

  // Fetch image once
  let imageId: number | null = null;
  if (imageUrl) {
    const imgData = await fetchImageAsBase64(imageUrl);
    if (imgData) imageId = wb.addImage({ base64: imgData.base64, extension: imgData.extension });
  }

  // Build component rows list (template + custom rows per section, interleaved)
  // We'll write them in section order with blank spacers between sections
  const sectionMap: Record<string, typeof template> = {};
  for (const comp of template) {
    if (!sectionMap[comp.section]) sectionMap[comp.section] = [];
    sectionMap[comp.section].push(comp);
  }
  const sectionEntries = Object.entries(sectionMap);

  // Build a flat ordered list of component rows to render
  type CompRow = { label: string; key: string | null; isSpacer: boolean };
  const componentRows: CompRow[] = [];
  for (let si = 0; si < sectionEntries.length; si++) {
    const [sectionName, components] = sectionEntries[si];
    for (const comp of components) {
      componentRows.push({ label: comp.label.toUpperCase(), key: comp.key, isSpacer: false });
    }
    // Custom rows for this section
    for (const cr of (customRowsBySection[sectionName] ?? [])) {
      componentRows.push({ label: cr.title.toUpperCase(), key: `__custom__${cr.title}`, isSpacer: false });
    }
    // Blank spacer between sections (not after last)
    if (si < sectionEntries.length - 1) {
      componentRows.push({ label: "", key: null, isSpacer: true });
    }
  }

  // Helper to get value for a component row + colour
  function getValue(row: CompRow, colour: string): string {
    if (row.isSpacer || !row.key) return "";
    if (row.key.startsWith("__custom__")) {
      const title = row.key.replace("__custom__", "");
      for (const sectionRows of Object.values(customRowsBySection)) {
        const found = sectionRows.find((r) => r.title === title);
        if (found) return found.valuesByColour[colour] ?? found.valuesByColour["__all__"] ?? "";
      }
      return "";
    }
    return specs[colour]?.[row.key] ?? "";
  }

  // One worksheet — all blocks stacked vertically
  const ws = wb.addWorksheet("Sheet1");

  // Page setup: A4 landscape, fit to 1 page wide
  ws.pageSetup.paperSize = 9;
  ws.pageSetup.orientation = "landscape";
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };

  // Column widths: col 1 = label, cols 2-8 = 7 colour columns
  ws.getColumn(1).width = LABEL_COL_WIDTH;
  for (let c = 2; c <= 1 + COLOURS_PER_BLOCK; c++) {
    ws.getColumn(c).width = COLOUR_COL_WIDTH;
  }

  let currentRow = 1;

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    const isFirstBlock = blockIdx === 0;

    if (isFirstBlock) {
      // ── Row 1: Tony Bianco | Product Specification Report ─────────────────
      ws.getRow(currentRow).height = 22;
      const r1c1 = ws.getCell(currentRow, 1);
      r1c1.value = "Tony Bianco";
      r1c1.font = arialBold12();
      ws.mergeCells(currentRow, 2, currentRow, Math.min(5, 1 + COLOURS_PER_BLOCK));
      const r1c2 = ws.getCell(currentRow, 2);
      r1c2.value = "Product Specification Report";
      r1c2.font = arialRegular12();
      currentRow++;

      // ── Row 2: blank ──────────────────────────────────────────────────────
      ws.getRow(currentRow).height = 6;
      currentRow++;

      // ── Rows 3-7: metadata ────────────────────────────────────────────────
      const headerRows: [string, string][] = [
        ["DATE:", today],
        ["LAST:", last.toUpperCase()],
        ["STYLE NAME:", style.toUpperCase()],
        ["BRAND:", "Tony Bianco"],
        ["SEASON:", season],
      ];
      for (const [label, value] of headerRows) {
        ws.getRow(currentRow).height = 14;
        const lc = ws.getCell(currentRow, 1);
        lc.value = label;
        lc.font = arialBold8();
        ws.mergeCells(currentRow, 2, currentRow, Math.min(4, 1 + COLOURS_PER_BLOCK));
        const vc = ws.getCell(currentRow, 2);
        vc.value = value;
        vc.font = arialBold8();
        currentRow++;
      }

      // ── Row 8: blank ──────────────────────────────────────────────────────
      ws.getRow(currentRow).height = 6;
      currentRow++;

      // ── Image in top-right (rows 1-8) ─────────────────────────────────────
      if (imageId !== null) {
        const sizePx = 130;
        ws.addImage(imageId, {
          tl: { col: COLOURS_PER_BLOCK, row: 0 },
          ext: { width: sizePx, height: sizePx },
          editAs: "oneCell",
        } as unknown as ExcelJS.ImageRange);
      }
    } else {
      // Between blocks: 2 blank spacer rows
      ws.getRow(currentRow).height = 8;
      currentRow++;
      ws.getRow(currentRow).height = 8;
      currentRow++;
    }

    // ── COMPONENTS header row ──────────────────────────────────────────────
    ws.getRow(currentRow).height = 16;
    const compCell = ws.getCell(currentRow, 1);
    compCell.value = "COMPONENTS";
    compCell.font = arialBold8();
    compCell.fill = GREY_FILL;
    for (let ci = 0; ci < block.colours.length; ci++) {
      const cell = ws.getCell(currentRow, 2 + ci);
      cell.value = `COLOUR ${block.offset + ci + 1}`;
      cell.font = arialBold8();
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = GREY_FILL;
    }
    // Fill empty colour slots with grey
    for (let ci = block.colours.length; ci < COLOURS_PER_BLOCK; ci++) {
      ws.getCell(currentRow, 2 + ci).fill = GREY_FILL;
    }
    currentRow++;

    // ── Colour labels row ──────────────────────────────────────────────────
    ws.getRow(currentRow).height = 16;
    ws.getCell(currentRow, 1).fill = GREY_FILL;
    for (let ci = 0; ci < block.colours.length; ci++) {
      const cell = ws.getCell(currentRow, 2 + ci);
      cell.value = block.labels[ci].toUpperCase();
      cell.font = arialBold8();
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = GREY_FILL;
    }
    for (let ci = block.colours.length; ci < COLOURS_PER_BLOCK; ci++) {
      ws.getCell(currentRow, 2 + ci).fill = GREY_FILL;
    }
    currentRow++;

    // ── Component rows ─────────────────────────────────────────────────────
    for (const row of componentRows) {
      if (row.isSpacer) {
        ws.getRow(currentRow).height = 6;
        currentRow++;
        continue;
      }

      ws.getRow(currentRow).height = 28;

      const labelCell = ws.getCell(currentRow, 1);
      labelCell.value = row.label;
      labelCell.font = arialRegular8();
      labelCell.alignment = { vertical: "top", wrapText: true };
      labelCell.border = { bottom: { style: "thin", color: { argb: "FFE0E0E0" } } };

      for (let ci = 0; ci < block.colours.length; ci++) {
        const valueCell = ws.getCell(currentRow, 2 + ci);
        valueCell.value = getValue(row, block.colours[ci]);
        valueCell.font = arialRegular8();
        valueCell.alignment = { vertical: "top", wrapText: true };
        valueCell.border = {
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
        };
      }

      currentRow++;
    }
  }

  // ── Generate and download ──────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `${style.toUpperCase()} - TONY BIANCO ${season}.xlsx`;
  saveAs(blob, filename);
}
