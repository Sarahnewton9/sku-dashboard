/**
 * exportSpecSheet — generates an Excel file matching the factory spec sheet format,
 * including the style image embedded in the header area.
 *
 * Uses ExcelJS for image support (SheetJS 0.18 does not support images).
 */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { getTemplateForCategory, SECTION_LABELS } from "@shared/specTemplates";

interface ExportSpecSheetParams {
  style: string;
  last: string;
  category: string;
  season?: string;
  colours: string[];
  specs: Record<string, Record<string, string>>; // colour → component → value
  hasBuckle?: boolean;
  dressShoeSubType?: "court" | "sling" | null;
  imageUrl?: string; // CDN URL for the style image
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; extension: "jpeg" | "png" | "gif" } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const mimeType = blob.type || "image/jpeg";
    const ext: "jpeg" | "png" | "gif" = mimeType.includes("png") ? "png" : mimeType.includes("gif") ? "gif" : "jpeg";
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);
    return { base64, extension: ext };
  } catch {
    return null;
  }
}

export async function exportSpecSheet(params: ExportSpecSheetParams) {
  const {
    style, last, category, season = "SS26", colours, specs,
    hasBuckle = false, dressShoeSubType = null, imageUrl,
  } = params;

  const template = getTemplateForCategory(category, { hasBuckle, dressShoeSubType });
  const today = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Tony Bianco SKU Dashboard";
  wb.created = new Date();

  const ws = wb.addWorksheet("Sheet1");

  // ── Column widths ──────────────────────────────────────────────────────────
  ws.getColumn(1).width = 36;
  for (let i = 0; i < colours.length; i++) {
    ws.getColumn(i + 2).width = 28;
  }

  // ── Helper: style a cell ───────────────────────────────────────────────────
  function styleHeader(cell: ExcelJS.Cell) {
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0E8" } };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD0C8B8" } },
    };
  }

  function styleLabel(cell: ExcelJS.Cell) {
    cell.font = { bold: true, size: 9, color: { argb: "FF666666" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9F7F4" } };
  }

  function styleValue(cell: ExcelJS.Cell) {
    cell.font = { size: 9 };
    cell.alignment = { wrapText: true, vertical: "middle" };
  }

  function styleSectionHeader(cell: ExcelJS.Cell) {
    cell.font = { bold: true, size: 8, color: { argb: "FF888888" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0EDE8" } };
  }

  // ── Image row (row 1) ──────────────────────────────────────────────────────
  // Reserve rows 1–6 for the header block; image will be anchored to row 1
  const IMAGE_ROWS = 6; // rows reserved for the header block
  const IMAGE_COL_SPAN = colours.length + 1;

  // Fetch image if available
  let imageId: number | null = null;
  if (imageUrl) {
    const imgData = await fetchImageAsBase64(imageUrl);
    if (imgData) {
      imageId = wb.addImage({
        base64: imgData.base64,
        extension: imgData.extension,
      });
    }
  }

  // ── Header rows ────────────────────────────────────────────────────────────
  // Row 1: Tony Bianco title
  const r1 = ws.addRow(["Tony Bianco — Product Specification Report"]);
  ws.mergeCells(1, 1, 1, IMAGE_COL_SPAN);
  const r1c1 = ws.getCell(1, 1);
  r1c1.font = { bold: true, size: 13, color: { argb: "FF1A1A1A" } };
  r1c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0E8" } };
  r1c1.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 28;

  // Row 2: DATE
  const r2 = ws.addRow(["DATE:", today]);
  styleHeader(ws.getCell(2, 1));
  styleHeader(ws.getCell(2, 2));
  ws.getRow(2).height = 18;

  // Row 3: LAST
  ws.addRow(["LAST:", last]);
  styleHeader(ws.getCell(3, 1));
  styleHeader(ws.getCell(3, 2));
  ws.getRow(3).height = 18;

  // Row 4: STYLE NAME
  ws.addRow(["STYLE NAME:", style]);
  styleHeader(ws.getCell(4, 1));
  styleHeader(ws.getCell(4, 2));
  ws.getRow(4).height = 18;

  // Row 5: BRAND
  ws.addRow(["BRAND:", "Tony Bianco"]);
  styleHeader(ws.getCell(5, 1));
  styleHeader(ws.getCell(5, 2));
  ws.getRow(5).height = 18;

  // Row 6: SEASON
  ws.addRow(["SEASON:", season]);
  styleHeader(ws.getCell(6, 1));
  styleHeader(ws.getCell(6, 2));
  ws.getRow(6).height = 18;

  // ── Embed image (anchored to top-right of header block) ───────────────────
  if (imageId !== null && colours.length > 0) {
    // Place image in the last column of the header block
    const imgCol = colours.length + 1; // 1-indexed
    ws.addImage(imageId, {
      tl: { col: imgCol - 0.9, row: 0.1, nativeCol: 0, nativeRow: 0, nativeColOff: 0, nativeRowOff: 0 },
      br: { col: imgCol + 0.9, row: IMAGE_ROWS - 0.1, nativeCol: 0, nativeRow: 0, nativeColOff: 0, nativeRowOff: 0 },
      editAs: "oneCell",
    } as unknown as ExcelJS.ImageRange);
    // Widen the last colour column a bit to accommodate the image
    ws.getColumn(imgCol + 1).width = 32;
  }

  // ── Column headers row ─────────────────────────────────────────────────────
  const colHeaderRow = ws.addRow(["COMPONENTS", ...colours.map((_, i) => `COLOUR ${i + 1}`)]);
  colHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2C2825" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  colHeaderRow.height = 20;

  // ── Colour name row ────────────────────────────────────────────────────────
  const colourNameRow = ws.addRow(["", ...colours]);
  colourNameRow.eachCell((cell, colNumber) => {
    if (colNumber > 1) {
      cell.font = { bold: true, size: 9 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E2D8" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });
  colourNameRow.height = 18;

  // ── Component rows ─────────────────────────────────────────────────────────
  // Group by section
  const sections = template.reduce<Record<string, typeof template>>((acc, comp) => {
    if (!acc[comp.section]) acc[comp.section] = [];
    acc[comp.section].push(comp);
    return acc;
  }, {});

  let rowIdx = ws.rowCount + 1;
  for (const [sectionKey, components] of Object.entries(sections)) {
    // Section header row
    const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey;
    const sectionRow = ws.addRow([sectionLabel.toUpperCase()]);
    ws.mergeCells(rowIdx, 1, rowIdx, IMAGE_COL_SPAN);
    styleSectionHeader(ws.getCell(rowIdx, 1));
    sectionRow.height = 16;
    rowIdx++;

    for (const comp of components) {
      const values = colours.map((colour) => specs[colour]?.[comp.key] ?? "");
      const dataRow = ws.addRow([comp.label, ...values]);
      styleLabel(ws.getCell(rowIdx, 1));
      for (let c = 2; c <= colours.length + 1; c++) {
        styleValue(ws.getCell(rowIdx, c));
        ws.getCell(rowIdx, c).border = {
          bottom: { style: "hair", color: { argb: "FFE0D8CC" } },
          right: { style: "hair", color: { argb: "FFE0D8CC" } },
        };
      }
      dataRow.height = 20;
      rowIdx++;
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
