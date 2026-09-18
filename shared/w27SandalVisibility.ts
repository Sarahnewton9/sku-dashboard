export type W27SandalCategory = "FLAT SANDAL" | "CASUAL SANDAL";

const FLAT_SANDAL_STYLES = new Set(["KIMBA", "KALI"]);

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Applies the W27 sandal classification supplied for range planning.
 * Kimba and Kali are Flat Sandals; every other style in the legacy Sandal
 * category is a Casual Sandal. Explicit custom Flat/Casual Sandal categories
 * are honoured as well.
 */
export function getW27SandalCategory(
  style: string | null | undefined,
  category: string | null | undefined,
): W27SandalCategory | null {
  const normalizedStyle = normalize(style);
  const normalizedCategory = normalize(category);

  if (FLAT_SANDAL_STYLES.has(normalizedStyle) || normalizedCategory === "FLAT SANDAL") {
    return "FLAT SANDAL";
  }
  if (normalizedCategory === "CASUAL SANDAL" || normalizedCategory === "SANDAL") {
    return "CASUAL SANDAL";
  }
  return null;
}

/**
 * W27 will not develop Flat Sandals or Casual Sandals. This is a reversible
 * display/range exclusion, not a cancellation or a data deletion.
 */
export function isHiddenFromW27WorkingRange(
  season: string | null | undefined,
  style: string | null | undefined,
  category: string | null | undefined,
): boolean {
  return normalize(season) === "W27" && getW27SandalCategory(style, category) !== null;
}
