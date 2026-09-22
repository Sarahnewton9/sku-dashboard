/** Formats handbag range identifiers consistently without changing database keys. */
export function formatHandbagDisplayLabel(value: string | null | undefined, fallback = "—"): string {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : fallback;
}
