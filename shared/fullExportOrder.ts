export const FULL_EXPORT_REQUIRED_COLS = ["Last", "Style", "Colour", "Leather"] as const;

export function getSelectedFullExportColumns(
  allColumnKeys: readonly string[],
  selectedColumnKeys: ReadonlySet<string>,
): string[] {
  return allColumnKeys.filter((key) => selectedColumnKeys.has(key));
}

type FullExportSortRow = {
  Style?: unknown;
  Colour?: unknown;
  Leather?: unknown;
};

function compareText(a: unknown, b: unknown): number {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortFullExportRowsByStyle<T extends FullExportSortRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) =>
    compareText(a.Style, b.Style)
    || compareText(a.Colour, b.Colour)
    || compareText(a.Leather, b.Leather),
  );
}
