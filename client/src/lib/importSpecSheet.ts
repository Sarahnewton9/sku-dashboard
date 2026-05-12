/**
 * importSpecSheet — parses a Tony Bianco factory spec sheet Excel file (.xls/.xlsx)
 * and returns structured data ready to save to the DB.
 *
 * Supported formats:
 *   Standard TB format:
 *     Row 0: Tony Bianco header
 *     Row 2: DATE:
 *     Row 3: LAST:
 *     Row 4: STYLE NAME:
 *     Row 5: BRAND:
 *     Row 6: SEASON:
 *     Row 8: COMPONENTS | COLOUR 1 | COLOUR 2 | ...  (header)
 *     Row 9: (empty or sub-header)
 *     Row 10+: COMPONENT_LABEL | value1 | value2 | ...
 *
 *   Alternate format (no COLOUR N headers, just colour names directly):
 *     Any row with "COMPONENTS" in col 0 is the header row.
 *     Colour names may be in the header row directly, or in the UPPER 1 row.
 *
 * Colour names are derived from the UPPER 1 row values (first component row).
 * Component labels are fuzzy-matched to internal component keys.
 */

import * as XLSX from "xlsx";
import { COMPONENT_LABEL_TO_KEY } from "@shared/specTemplates";

export interface ParsedSpecSheet {
  styleName: string;
  last: string;
  season: string;
  /** colour name → component key → value */
  colourSpecs: Record<string, Record<string, string>>;
  /** columns that had no colour name (skipped) */
  skippedCols: number;
  /** component labels that could not be matched to a key */
  unmatchedComponents: string[];
  /** raw colour names as detected from the sheet (for preview) */
  detectedColours: string[];
}

/**
 * Normalise a string for fuzzy matching: uppercase, strip punctuation/spaces.
 */
function normalise(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Map a component label from the spec sheet to an internal component key.
 * Uses exact match first, then normalised match, then partial match.
 */
function matchComponentKey(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  // Direct lookup from shared map
  const direct = COMPONENT_LABEL_TO_KEY[trimmed.toUpperCase()];
  if (direct) return direct;

  // Normalised lookup
  const normLabel = normalise(trimmed);
  for (const [mapLabel, key] of Object.entries(COMPONENT_LABEL_TO_KEY)) {
    if (normalise(mapLabel) === normLabel) return key;
  }

  // Partial match — if the label contains a known key label as a substring
  for (const [mapLabel, key] of Object.entries(COMPONENT_LABEL_TO_KEY)) {
    if (normLabel.includes(normalise(mapLabel)) || normalise(mapLabel).includes(normLabel)) {
      return key;
    }
  }

  return null;
}

/**
 * Safely convert a cell value to a trimmed string.
 * Handles numbers, booleans, dates, and null/undefined.
 */
function cellStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  return String(val).trim();
}

export async function parseSpecSheetFile(file: File): Promise<ParsedSpecSheet> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Use raw: false to get formatted values, header: 1 for 2D array
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  // ── Extract header metadata ────────────────────────────────────────────────
  let styleName = "";
  let last = "";
  let season = "";

  for (const row of raw) {
    const label = cellStr(row[0]).toUpperCase();
    const value = cellStr(row[1]);
    if (label === "STYLE NAME:" || label === "STYLE NAME") styleName = value;
    else if (label === "LAST:" || label === "LAST") last = value;
    else if (label === "SEASON:" || label === "SEASON") season = value;
  }

  // ── Find the COMPONENTS header row ────────────────────────────────────────
  // Look for a row where col 0 is "COMPONENTS" (case-insensitive)
  let componentsRowIdx = -1;
  for (let i = 0; i < raw.length; i++) {
    const cellVal = cellStr(raw[i][0]).toUpperCase().trim();
    if (cellVal === "COMPONENTS") {
      componentsRowIdx = i;
      break;
    }
  }

  if (componentsRowIdx === -1) {
    // Fallback: look for a row that has multiple non-empty cells in columns 1+
    // and the first cell looks like a header (contains "COMPONENT" or "MATERIAL")
    for (let i = 0; i < Math.min(raw.length, 20); i++) {
      const row = raw[i];
      const firstCell = cellStr(row[0]).toUpperCase();
      if (firstCell.includes("COMPONENT") || firstCell.includes("MATERIAL") || firstCell.includes("UPPER")) {
        const nonEmpty = row.slice(1).filter((c) => cellStr(c).length > 0);
        if (nonEmpty.length >= 1) {
          componentsRowIdx = i;
          break;
        }
      }
    }
  }

  if (componentsRowIdx === -1) {
    throw new Error(
      "Could not find the COMPONENTS header row. Please ensure the file is a Tony Bianco spec sheet."
    );
  }

  // ── Identify colour columns ────────────────────────────────────────────────
  const headerRow = raw[componentsRowIdx];

  // Strategy 1: look for "COLOUR 1", "COLOUR 2" etc. in the header row
  const colourColIndices: number[] = [];
  for (let c = 1; c < headerRow.length; c++) {
    const h = cellStr(headerRow[c]).toUpperCase().trim();
    if (h.startsWith("COLOUR") || h.startsWith("COLOR")) {
      colourColIndices.push(c);
    }
  }

  // Strategy 2: if no COLOUR N headers, treat all non-empty columns as colour columns
  // (some factories use colour names directly in the header row)
  const usingDirectColourHeaders = colourColIndices.length === 0;
  if (usingDirectColourHeaders) {
    for (let c = 1; c < headerRow.length; c++) {
      const h = cellStr(headerRow[c]).trim();
      if (h.length > 0) {
        colourColIndices.push(c);
      }
    }
  }

  // ── Find colour names ──────────────────────────────────────────────────────
  // Primary: look for UPPER 1 row to get actual colour names
  // (even when headers say "COLOUR 1", the actual colour name is in the UPPER 1 row)
  let upper1RowIdx = -1;
  for (let i = componentsRowIdx + 1; i < raw.length; i++) {
    const label = cellStr(raw[i][0]).toUpperCase().trim();
    if (label === "UPPER 1" || label === "UPPER1" || label === "UPPER") {
      upper1RowIdx = i;
      break;
    }
  }

  const colourNames: Record<number, string> = {};
  let skippedCols = 0;

  if (usingDirectColourHeaders) {
    // Colour names are directly in the header row
    for (const colIdx of colourColIndices) {
      const name = cellStr(headerRow[colIdx]).trim();
      if (name && name.toUpperCase() !== "COMPONENTS") {
        colourNames[colIdx] = name;
      } else {
        skippedCols++;
      }
    }
  } else if (upper1RowIdx !== -1) {
    // Use UPPER 1 row for colour names
    for (const colIdx of colourColIndices) {
      const name = cellStr(raw[upper1RowIdx][colIdx]).trim();
      if (name) {
        colourNames[colIdx] = name;
      } else {
        // Fallback to header row label (e.g. "COLOUR 1")
        const headerLabel = cellStr(headerRow[colIdx]).trim();
        if (headerLabel) {
          colourNames[colIdx] = headerLabel;
        } else {
          skippedCols++;
        }
      }
    }
  } else {
    // No UPPER 1 row — use header row labels as colour names
    for (const colIdx of colourColIndices) {
      const name = cellStr(headerRow[colIdx]).trim();
      if (name) {
        colourNames[colIdx] = name;
      } else {
        skippedCols++;
      }
    }
  }

  // ── Parse component rows ───────────────────────────────────────────────────
  const colourSpecs: Record<string, Record<string, string>> = {};
  for (const name of Object.values(colourNames)) {
    colourSpecs[name] = {};
  }

  const unmatchedComponents: string[] = [];
  const seenUnmatched = new Set<string>();

  for (let i = componentsRowIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const label = cellStr(row[0]).trim();
    if (!label) continue;

    // Skip rows that look like section headers (all-caps, no values in data cols)
    const isAllCaps = label === label.toUpperCase() && /^[A-Z\s/&]+$/.test(label);
    const hasAnyValue = colourColIndices.some((c) => cellStr(row[c]).trim().length > 0);
    if (isAllCaps && !hasAnyValue && label.length > 2) continue;

    const key = matchComponentKey(label);
    if (!key) {
      // Track unmatched labels (but skip obvious non-data rows)
      if (
        label.length > 1 &&
        !label.startsWith("*") &&
        !label.startsWith("NOTE") &&
        !label.startsWith("//") &&
        !seenUnmatched.has(label)
      ) {
        unmatchedComponents.push(label);
        seenUnmatched.add(label);
      }
      continue;
    }

    for (const [colIdx, colourName] of Object.entries(colourNames)) {
      const value = cellStr(row[Number(colIdx)]).trim();
      if (value) {
        colourSpecs[colourName][key] = value;
      }
    }
  }

  const detectedColours = Object.values(colourNames);

  return { styleName, last, season, colourSpecs, skippedCols, unmatchedComponents, detectedColours };
}
