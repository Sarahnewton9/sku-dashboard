export type ParsedFobCostRow = {
  style: string;
  colour: string;
  leather: string;
  colour2: string;
  leather2: string;
  cost: number | null;
  sourceRow: number;
};

export type ParsedFobCostFile = {
  rows: ParsedFobCostRow[];
  format: "factory_list" | "fob_request";
  formatError?: string;
};

export function normaliseFobHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function normaliseFobText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function splitFactoryUpper(value: unknown): [string, string] | null {
  const parts = String(value ?? "")
    .split(/\s*\/\s*/)
    .map(normaliseFobText);
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null;
}

/**
 * Accepts common factory FOB representations, including numeric cells, US$34.50,
 * $USD40, USD 40 and US$ 1,234.50. Negative, blank and non-numeric values are
 * rejected rather than silently changing a stored factory cost.
 */
export function parseFobUsd(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const raw = String(value ?? "").trim();
  if (!raw || raw.includes("-")) return null;
  const numericToken = raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!numericToken) return null;
  const parsed = Number(numericToken[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function findColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.includes(header));
}

function findFobColumn(headers: string[]): number {
  const exactNames = [
    "FOB USD",
    "USD FOB",
    "FOB",
    "FACTORY COST USD",
    "USD FACTORY COST",
    "FACTORY FOB",
    "FOB COST",
    "COST USD",
    "USD COST",
    "USD",
    "US",
    "COST",
    "UNIT PRICE",
  ];
  const exact = findColumn(headers, exactNames);
  if (exact >= 0) return exact;
  return headers.findIndex((header) => header.includes("FOB") || header.includes("USD"));
}

/**
 * Parses both the SKU Dash FOB request (`LAST / Style / Colour / FOB`) and the
 * detailed factory list (`LAST / STYLE / COLOUR / LEATHER / $USD`). The caller
 * resolves these rows against the active range before importing anything.
 */
export function parseFobCostGrid(grid: unknown[][]): ParsedFobCostFile {
  const headerRowIndex = grid.findIndex((row) => (
    Array.isArray(row) && row.some((cell) => normaliseFobHeader(cell) === "STYLE")
  ));
  if (headerRowIndex < 0) {
    return {
      rows: [],
      format: "fob_request",
      formatError: "Could not find a STYLE header in the first worksheet.",
    };
  }

  const headers = (grid[headerRowIndex] ?? []).map(normaliseFobHeader);
  const styleColumn = findColumn(headers, ["STYLE", "STYLE NAME", "MODEL"]);
  const colourColumn = findColumn(headers, ["UPPER 1 COLOUR", "COLOUR", "COLOR", "COLOURWAY", "COLORWAY"]);
  const leatherColumn = findColumn(headers, ["UPPER 1 LEATHER", "LEATHER", "MATERIAL", "MATERIALS", "UPPER", "REMARKS"]);
  const colour2Column = findColumn(headers, ["UPPER 2 COLOUR", "COLOUR 2", "COLOR 2"]);
  const leather2Column = findColumn(headers, ["UPPER 2 LEATHER", "LEATHER 2", "MATERIAL 2"]);
  const costColumn = findFobColumn(headers);
  if (styleColumn < 0 || colourColumn < 0 || costColumn < 0) {
    return {
      rows: [],
      format: "fob_request",
      formatError: "Use the SKU Dash request file, or provide STYLE, COLOUR and an FOB / USD cost column.",
    };
  }

  const format: ParsedFobCostFile["format"] = leatherColumn >= 0 ? "factory_list" : "fob_request";
  const rows: ParsedFobCostRow[] = [];
  for (let index = headerRowIndex + 1; index < grid.length; index += 1) {
    const row = grid[index] ?? [];
    const style = normaliseFobText(row[styleColumn]);
    const sourceColour = normaliseFobText(row[colourColumn]);
    const sourceLeather = leatherColumn >= 0 ? normaliseFobText(row[leatherColumn]) : "";
    const combinedColours = leatherColumn >= 0 ? splitFactoryUpper(row[colourColumn]) : null;
    const combinedLeathers = leatherColumn >= 0 ? splitFactoryUpper(row[leatherColumn]) : null;
    const colour = combinedColours?.[0] ?? sourceColour;
    const leather = combinedLeathers?.[0] ?? sourceLeather;
    const colour2 = combinedColours && combinedLeathers ? combinedColours[1] : (colour2Column >= 0 ? normaliseFobText(row[colour2Column]) : "");
    const leather2 = combinedColours && combinedLeathers ? combinedLeathers[1] : (leather2Column >= 0 ? normaliseFobText(row[leather2Column]) : "");
    if (!style && !colour) continue;
    rows.push({
      style,
      colour,
      leather,
      colour2,
      leather2,
      cost: parseFobUsd(row[costColumn]),
      sourceRow: index + 1,
    });
  }
  return { rows, format };
}
