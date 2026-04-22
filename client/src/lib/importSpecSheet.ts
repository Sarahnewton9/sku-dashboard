/**
 * importSpecSheet — parses a Tony Bianco factory spec sheet Excel file (.xls/.xlsx)
 * and returns structured data ready to save to the DB.
 *
 * Format:
 *   Row 0: Tony Bianco header
 *   Row 2: DATE:
 *   Row 3: LAST:
 *   Row 4: STYLE NAME:
 *   Row 5: BRAND:
 *   Row 6: SEASON:
 *   Row 8: COMPONENTS | COLOUR 1 | COLOUR 2 | ...  (header)
 *   Row 9: (empty or sub-header)
 *   Row 10+: COMPONENT_LABEL | value1 | value2 | ...
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
}

/**
 * Normalise a string for fuzzy matching: uppercase, strip punctuation/spaces.
 */
function normalise(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Map a component label from the spec sheet to an internal component key.
 * Uses exact match first, then normalised match.
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

export async function parseSpecSheetFile(file: File): Promise<ParsedSpecSheet> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];

  // ── Extract header metadata ────────────────────────────────────────────────
  let styleName = "";
  let last = "";
  let season = "";

  for (const row of raw) {
    const label = String(row[0] ?? "").trim().toUpperCase();
    const value = String(row[1] ?? "").trim();
    if (label === "STYLE NAME:") styleName = value;
    else if (label === "LAST:") last = value;
    else if (label === "SEASON:") season = value;
  }

  // ── Find the COMPONENTS header row ────────────────────────────────────────
  let componentsRowIdx = -1;
  for (let i = 0; i < raw.length; i++) {
    if (String(raw[i][0] ?? "").trim().toUpperCase() === "COMPONENTS") {
      componentsRowIdx = i;
      break;
    }
  }

  if (componentsRowIdx === -1) {
    throw new Error("Could not find COMPONENTS header row in the spec sheet.");
  }

  // ── Identify colour columns ────────────────────────────────────────────────
  // The COMPONENTS row has "COLOUR 1", "COLOUR 2" etc. in the data columns.
  // Actual colour names come from the UPPER 1 row (first non-empty component row).
  const headerRow = raw[componentsRowIdx];
  const colourColIndices: number[] = [];
  for (let c = 1; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "").trim().toUpperCase();
    if (h.startsWith("COLOUR")) {
      colourColIndices.push(c);
    }
  }

  // Find UPPER 1 row to get actual colour names
  let upper1RowIdx = -1;
  for (let i = componentsRowIdx + 1; i < raw.length; i++) {
    const label = String(raw[i][0] ?? "").trim().toUpperCase();
    if (label === "UPPER 1" || label === "UPPER1") {
      upper1RowIdx = i;
      break;
    }
  }

  // Build colour name map: colIndex → colour name
  const colourNames: Record<number, string> = {};
  let skippedCols = 0;
  if (upper1RowIdx !== -1) {
    for (const colIdx of colourColIndices) {
      const name = String(raw[upper1RowIdx][colIdx] ?? "").trim();
      if (name) {
        colourNames[colIdx] = name;
      } else {
        skippedCols++;
      }
    }
  } else {
    // Fallback: use COLOUR 1, COLOUR 2 etc. as names
    for (const colIdx of colourColIndices) {
      colourNames[colIdx] = String(headerRow[colIdx] ?? "").trim();
    }
  }

  // ── Parse component rows ───────────────────────────────────────────────────
  const colourSpecs: Record<string, Record<string, string>> = {};
  for (const name of Object.values(colourNames)) {
    colourSpecs[name] = {};
  }

  const unmatchedComponents: string[] = [];

  for (let i = componentsRowIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const label = String(row[0] ?? "").trim();
    if (!label) continue;

    const key = matchComponentKey(label);
    if (!key) {
      if (label.length > 1 && !label.startsWith("*")) {
        unmatchedComponents.push(label);
      }
      continue;
    }

    for (const [colIdx, colourName] of Object.entries(colourNames)) {
      const value = String(row[Number(colIdx)] ?? "").trim();
      if (value) {
        colourSpecs[colourName][key] = value;
      }
    }
  }

  return { styleName, last, season, colourSpecs, skippedCols, unmatchedComponents };
}
