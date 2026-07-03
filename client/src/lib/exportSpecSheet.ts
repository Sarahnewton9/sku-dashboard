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
 *
 * Row order and deleted rows:
 * - If rowKeys is provided, the export respects the saved on-screen order.
 * - Template rows whose key is absent from rowKeys were deleted by the user and are omitted.
 * - Custom rows are included in the order they appear in rowKeys (c:<id> entries).
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
  /** Saved row order from spec_row_order.rowKeys — used to preserve on-screen order and omit deleted rows */
  rowKeys?: string[] | null;
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
// A4 landscape: label col 36 + 7 × 20 = 176 char-units. Wider columns so values aren't cramped.
const LABEL_COL_WIDTH = 36;
const COLOUR_COL_WIDTH = 20;
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
    rowKeys,
  } = params;

  // Build custom rows lookup: repId → {title, section, valuesByColour}
  // Per-colour rows share the same title but have different ids. We group them by title,
  // using the LOWEST id as the representative (canonical) id so rowKeys lookups work.
  // Sort by id ascending first so the lowest id is always picked as representative.
  const sortedCustomRows = [...customRows].sort((a, b) => a.id - b.id);
  const customRowById = new Map<number, { title: string; section: string; valuesByColour: Record<string, string> }>();
  // Also build a title → repId map for fallback lookups when rowKeys has stale ids
  const titleToRepId = new Map<string, number>();
  for (const cr of sortedCustomRows) {
    const existingRepId = titleToRepId.get(cr.title);
    if (existingRepId === undefined) {
      // First row for this title (lowest id) — use its id as the representative
      titleToRepId.set(cr.title, cr.id);
      customRowById.set(cr.id, { title: cr.title, section: cr.section, valuesByColour: { [cr.colour]: cr.value ?? "" } });
    } else {
      // Subsequent per-colour row — merge into the representative's valuesByColour
      customRowById.get(existingRepId)!.valuesByColour[cr.colour] = cr.value ?? "";
    }
  }

  const template = getTemplateForCategory(category, { hasBuckle, dressShoeSubType, style });
  const today = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });

  // ── Build ordered component rows ──────────────────────────────────────────
  // type for a single renderable row
  type CompRow = { label: string; key: string | null; isSpacer: boolean };

  let componentRows: CompRow[];

  if (rowKeys && rowKeys.length > 0) {
    // Respect the saved on-screen order.
    // Template keys absent from rowKeys were deleted by the user — omit them.
    // Custom rows are included in the order they appear in rowKeys.
    const templateMap = new Map(template.map((c) => [`t:${c.key}`, c]));

    // Build the ordered list from rowKeys, skipping deleted entries
    const orderedRows: CompRow[] = [];
    let prevSection: string | null = null;

    // Build a set of deleted keys (both template and custom) to prevent re-appending them
    const exportDeletedKeys = new Set<string>();
    for (const key of rowKeys) {
      if (key.startsWith("deleted:")) exportDeletedKeys.add(key.slice("deleted:".length));
    }

    for (const key of rowKeys) {
      if (key.startsWith("deleted:")) continue;

      if (key.startsWith("t:")) {
        const comp = templateMap.get(key);
        if (!comp) continue; // unknown key, skip
        // Insert a spacer when the section changes
        if (prevSection !== null && comp.section !== prevSection) {
          orderedRows.push({ label: "", key: null, isSpacer: true });
        }
        orderedRows.push({ label: comp.label.toUpperCase(), key: comp.key, isSpacer: false });
        prevSection = comp.section;
      } else if (key.startsWith("c:")) {
        const id = parseInt(key.slice(2), 10);
        let cr = customRowById.get(id);
        let repId = id;
        if (!cr) {
          // Stale id: after __all__ explosion the old id was deleted and new per-colour ids
          // were assigned. The rowKeys entry still has the old id. We can't match by id,
          // so skip it — the fallback (no-rowKeys path) will include all custom rows.
          // To avoid duplicates, we simply skip stale ids here and rely on the fact that
          // the client-side upsertForColourMutation updates rowKeys after explosion.
          continue;
        }
        // Insert a spacer when the section changes
        if (prevSection !== null && cr.section !== prevSection) {
          orderedRows.push({ label: "", key: null, isSpacer: true });
        }
        orderedRows.push({ label: cr.title.toUpperCase(), key: `__custom__${repId}`, isSpacer: false });
        prevSection = cr.section;
      }
    }

    // Append any custom row groups that weren't placed by rowKeys.
    // This handles stale ids (after __all__ explosion) where the old c:{id} in rowKeys
    // no longer exists in the DB. We track which repIds were placed and append the rest.
    // IMPORTANT: skip rows that are marked as deleted (deleted:c:{id} in rowKeys).
    const placedRepIds = new Set(
      orderedRows
        .filter((r) => r.key?.startsWith("__custom__"))
        .map((r) => parseInt(r.key!.slice("__custom__".length), 10))
    );
    for (const [repId, cr] of Array.from(customRowById)) {
      const rowKey = `c:${repId}`;
      if (!placedRepIds.has(repId) && !exportDeletedKeys.has(rowKey)) {
        orderedRows.push({ label: cr.title.toUpperCase(), key: `__custom__${repId}`, isSpacer: false });
      }
    }

    // NOTE: Template rows absent from rowKeys were deleted by the user — do NOT re-add them.
    // (Custom rows not in rowKeys are treated as newly added and appended above.)

    componentRows = orderedRows;
  } else {
    // No saved order — fall back to default template order + custom rows grouped by section
    const customRowsBySection: Record<string, Array<{ id: number; title: string; valuesByColour: Record<string, string> }>> = {};
    for (const [id, cr] of Array.from(customRowById)) {
      if (!customRowsBySection[cr.section]) customRowsBySection[cr.section] = [];
      customRowsBySection[cr.section].push({ id, title: cr.title, valuesByColour: cr.valuesByColour });
    }

    const sectionMap: Record<string, typeof template> = {};
    for (const comp of template) {
      if (!sectionMap[comp.section]) sectionMap[comp.section] = [];
      sectionMap[comp.section].push(comp);
    }
    const sectionEntries = Object.entries(sectionMap);

    componentRows = [];
    for (let si = 0; si < sectionEntries.length; si++) {
      const [sectionName, components] = sectionEntries[si];
      for (const comp of components) {
        componentRows.push({ label: comp.label.toUpperCase(), key: comp.key, isSpacer: false });
      }
      for (const cr of (customRowsBySection[sectionName] ?? [])) {
        componentRows.push({ label: cr.title.toUpperCase(), key: `__custom__${cr.id}`, isSpacer: false });
      }
      if (si < sectionEntries.length - 1) {
        componentRows.push({ label: "", key: null, isSpacer: true });
      }
    }
  }

  // Helper to get value for a component row + colour.
  // For custom rows, the DB stores values keyed by the raw compound colour key (e.g. "GOLD" or "BLUSH").
  // The export passes the colourLabel (e.g. "GOLD NAPPA" or "BLUSH NUBUCK") as `colour`.
  // We try multiple fallbacks to handle:
  //   1. Values stored under the full compound key (e.g. "BLUSH NUBUCK") — current behaviour
  //   2. Values stored under the rawColour (same as colour for most styles)
  //   3. Values stored under the short colour name (first word only, e.g. "BLUSH" from "BLUSH NUBUCK")
  //      — this handles legacy values entered when the style had a single leather per colour,
  //        before additional leathers were added and the colour key changed to "COLOUR LEATHER".
  //   4. __all__ shared value
  function getValue(row: CompRow, colour: string, rawColour?: string): string {
    if (row.isSpacer || !row.key) return "";
    if (row.key.startsWith("__custom__")) {
      const idStr = row.key.replace("__custom__", "");
      const id = parseInt(idStr, 10);
      if (!isNaN(id)) {
        const cr = customRowById.get(id);
        if (cr) {
          // Try colourLabel first
          const byLabel = cr.valuesByColour[colour];
          if (byLabel !== undefined && byLabel !== "") return byLabel;
          // Try rawColour (may differ from label)
          if (rawColour && rawColour !== colour) {
            const byRaw = cr.valuesByColour[rawColour];
            if (byRaw !== undefined && byRaw !== "") return byRaw;
          }
          // Try short colour name (first word) — handles legacy values stored before leather suffix was added
          const shortColour = colour.split(" ")[0];
          if (shortColour && shortColour !== colour) {
            const byShort = cr.valuesByColour[shortColour];
            if (byShort !== undefined && byShort !== "") return byShort;
          }
          if (rawColour) {
            const shortRaw = rawColour.split(" ")[0];
            if (shortRaw && shortRaw !== shortColour && shortRaw !== rawColour) {
              const byShortRaw = cr.valuesByColour[shortRaw];
              if (byShortRaw !== undefined && byShortRaw !== "") return byShortRaw;
            }
          }
          // Fall back to __all__ shared value (empty string is valid — return it)
          return cr.valuesByColour["__all__"] ?? "";
        }
      }
      return "";
    }
    return specs[colour]?.[row.key] ?? "";
  }

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
        // Use the full label (e.g. "BLACK CAPRI") as the spec lookup key to match how values are stored.
        // Also pass the raw compound key (e.g. "GOLD") as a fallback for custom rows which store
        // values keyed by the raw colour, not the label.
        const colourKey = block.labels[ci] ?? block.colours[ci];
        const rawColour = block.colours[ci];
        valueCell.value = getValue(row, colourKey, rawColour);
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
