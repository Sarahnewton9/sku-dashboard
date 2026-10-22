export type LastOptionRow =
  | string
  | { lastName?: string | null; last?: string | null };

function normaliseLastName(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function readLastName(row: LastOptionRow): string {
  if (typeof row === "string") return row;
  return row.lastName ?? row.last ?? "";
}

/**
 * Builds the Last selector used by By Style from every live source of truth.
 * A last can be an established carry-over and therefore exist only on a
 * seasonal style record, rather than in the new-last registry.
 */
export function buildStyleLastOptions(input: {
  canonicalLasts: readonly string[];
  staticStyleLasts: readonly string[];
  customLasts: readonly LastOptionRow[];
  seasonalStyleLasts: readonly LastOptionRow[];
}): string[] {
  const values = new Set<string>();
  const add = (value: string | null | undefined) => {
    const normalised = normaliseLastName(value);
    if (normalised) values.add(normalised);
  };

  for (const last of input.canonicalLasts) add(last);
  for (const last of input.staticStyleLasts) add(last);
  for (const row of input.customLasts) add(readLastName(row));
  for (const row of input.seasonalStyleLasts) add(readLastName(row));

  return Array.from(values).sort((left, right) => left.localeCompare(right));
}
