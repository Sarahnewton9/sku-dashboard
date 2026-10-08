import { formatSkuExportLabel } from "./skuExportLabel";

export type FobCostRequestCandidate = {
  /** True when this physical SKU is new in the active season. */
  isNewSeasonSku: boolean;
  /** SKU Dash sample status for this physical SKU. */
  sampleStatus?: string | null;
  /** Actual imported factory FOB, in USD. */
  currentFobUsd?: number | null;
};

export type FobRequestSku = {
  style: string;
  colour: string;
  leather?: string | null;
  colour2?: string | null;
  leather2?: string | null;
};

export type FobRequestExportCandidate = FobRequestSku & {
  last?: string | null;
};

export type FobRequestExportRow = {
  "LAST": string;
  "STYLE": string;
  "COLOUR": string;
  "FOB COST": string;
};

function normaliseRequestValue(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * A factory FOB request is deliberately a rolling operational list. It includes
 * only received samples from new-season SKUs and drops each SKU as soon as a
 * positive FOB is imported. This includes a new colourway on an existing style.
 */
export function isFobCostRequestEligible(candidate: FobCostRequestCandidate): boolean {
  if (!candidate.isNewSeasonSku) return false;
  const sampleStatus = String(candidate.sampleStatus ?? "").trim().toLowerCase();
  if (sampleStatus !== "received" && sampleStatus !== "fitting_sample") return false;
  const fob = Number(candidate.currentFobUsd);
  return !Number.isFinite(fob) || fob <= 0;
}

/** Matches the all-caps Colour wording used in the factory's FOB workbook. */
export function formatFobRequestColour(sku: FobRequestSku): string {
  return formatSkuExportLabel(sku).toUpperCase();
}

/**
 * Produces the concise factory template in a predictable style-first order.
 * The physical Upper 1 / Upper 2 identity is deliberately retained in COLOUR.
 */
export function buildFobRequestExportRows(candidates: FobRequestExportCandidate[]): FobRequestExportRow[] {
  return candidates
    .map((sku) => ({
      "LAST": normaliseRequestValue(sku.last),
      "STYLE": normaliseRequestValue(sku.style),
      "COLOUR": formatFobRequestColour(sku),
      "FOB COST": "",
    }))
    .sort((left, right) => (
      left.STYLE.localeCompare(right.STYLE, undefined, { sensitivity: "base" })
      || left.LAST.localeCompare(right.LAST, undefined, { sensitivity: "base" })
      || left.COLOUR.localeCompare(right.COLOUR, undefined, { sensitivity: "base" })
    ));
}

function widthFor(values: string[], minimum: number, maximum: number, padding: number): number {
  const longest = Math.max(...values.map((value) => String(value ?? "").length));
  return Math.max(minimum, Math.min(maximum, longest + padding));
}

function wrappedLines(value: string, width: number): number {
  const explicitLines = String(value ?? "").split(/\r?\n/);
  return explicitLines.reduce((total, line) => total + Math.max(1, Math.ceil(line.length / width)), 0);
}

/**
 * Uses Excel character widths (`wch`) rather than the unsupported raw `width`
 * property. Long labels wrap and their rows expand, so the factory does not
 * need to manually stretch columns or row heights.
 */
export function getFobRequestExportLayout(rows: FobRequestExportRow[]): {
  columnWidths: [number, number, number, number];
  rowHeights: number[];
} {
  const columnWidths: [number, number, number, number] = [
    widthFor(["LAST", ...rows.map((row) => row.LAST)], 16, 34, 3),
    widthFor(["STYLE", ...rows.map((row) => row.STYLE)], 15, 34, 3),
    widthFor(["COLOUR", ...rows.map((row) => row.COLOUR)], 32, 70, 4),
    16,
  ];

  return {
    columnWidths,
    rowHeights: rows.map((row) => {
      const lines = Math.max(
        wrappedLines(row.LAST, columnWidths[0]),
        wrappedLines(row.STYLE, columnWidths[1]),
        wrappedLines(row.COLOUR, columnWidths[2]),
      );
      return Math.max(22, lines * 18);
    }),
  };
}

/** Uses the Australia/Sydney business date, independent of browser locale. */
export function getFobCostRequestFilename(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `FOB COST NEEDED ${day}.${month}.xlsx`;
}

/**
 * Resolves the four-column factory template (LAST, STYLE, COLOUR, FOB COST) back to
 * a full SKU identity. This keeps Upper 1 / Upper 2 detail safe inside SKU Dash
 * without exposing it in the factory request.
 */
export function resolveFobRequestSku(
  knownSkus: FobRequestSku[],
  style: string,
  colourLabel: string,
): FobRequestSku | null {
  const expectedStyle = normaliseRequestValue(style);
  const expectedColour = normaliseRequestValue(colourLabel);
  const matches = knownSkus.filter((sku) => (
    normaliseRequestValue(sku.style) === expectedStyle
    && normaliseRequestValue(formatFobRequestColour(sku)) === expectedColour
  ));
  return matches.length === 1 ? matches[0] : null;
}
