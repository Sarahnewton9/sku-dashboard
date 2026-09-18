export type SkuUpperData = {
  style?: string | null;
  colour?: string | null;
  leather?: string | null;
  colour2?: string | null;
  leather2?: string | null;
};

function normalizePart(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function displayColour(colour: string, leather: string): string {
  return colour.toUpperCase() === "CHOC" && leather.toUpperCase() === "VENICE"
    ? "CHOCOLATE"
    : colour;
}

function displayLeather(leather: string, style?: string | null): string {
  return leather.toUpperCase() === "KID" && style?.toUpperCase() !== "CAPRICE"
    ? "CAPRI"
    : leather;
}

/** Formats one ordered upper pair, for example "BLACK VINTAGE". */
export function formatSkuUpperPart(
  colour: string | null | undefined,
  leather: string | null | undefined,
  style?: string | null,
): string {
  const rawColour = normalizePart(colour);
  const rawLeather = normalizePart(leather);
  return [displayColour(rawColour, rawLeather), displayLeather(rawLeather, style)]
    .filter(Boolean)
    .join(" ");
}

/**
 * Formats a SKU's upper construction for exports.
 * A dual upper always keeps each colour + leather pair together in saved order:
 * "BLACK VINTAGE/BLACK SUEDE". The slash intentionally has no surrounding spaces.
 */
export function formatSkuExportLabel(sku: SkuUpperData): string {
  const primary = formatSkuUpperPart(sku.colour, sku.leather, sku.style);
  const secondary = formatSkuUpperPart(sku.colour2, sku.leather2, sku.style);
  return secondary ? `${primary}/${secondary}` : primary;
}

/** Returns both the standard combined export label and legacy split fields for any internal caller. */
export function getSkuExportFields(sku: SkuUpperData): {
  colour: string;
  leather: string;
  colourLeather: string;
  isDualUpper: boolean;
} {
  const primary = formatSkuUpperPart(sku.colour, sku.leather, sku.style);
  const secondary = formatSkuUpperPart(sku.colour2, sku.leather2, sku.style);
  const colourLeather = secondary ? `${primary}/${secondary}` : primary;
  return {
    colour: secondary ? colourLeather : displayColour(normalizePart(sku.colour), normalizePart(sku.leather)),
    leather: secondary ? "" : displayLeather(normalizePart(sku.leather), sku.style),
    colourLeather,
    isDualUpper: Boolean(secondary),
  };
}

/** Title-cases an export label while preserving the compact slash separator. */
export function toTitleCaseSkuExportLabel(label: string): string {
  return label
    .split("/")
    .map((upper) => upper
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" "))
    .join("/");
}
