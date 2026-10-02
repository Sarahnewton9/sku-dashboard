import { getSkuCompositeIdentity } from "./skuCompositeIdentity";
import { toTitleCaseSkuExportLabel } from "./skuExportLabel";

export type Ap21SkuColourIdentity = {
  style: string;
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
};

export type Ap21SkuColourDescriptionRow = Ap21SkuColourIdentity & {
  ap21ColourDescription: string;
};

/** Returns the stable, Upper-2-aware key for an AP21 SKU colour description. */
export function getAp21SkuColourDescriptionKey(sku: Ap21SkuColourIdentity): string {
  return getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2);
}

/** Builds a lookup from saved AP21-approved descriptions. */
export function buildAp21SkuColourDescriptionMap(
  rows: readonly Ap21SkuColourDescriptionRow[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const description = String(row.ap21ColourDescription ?? "").trim();
    if (description) map.set(getAp21SkuColourDescriptionKey(row), description);
  }
  return map;
}

/**
 * Uses the approved AP21 description for an exact physical SKU. A title-cased
 * development label is retained only as a safe fallback until a mapping exists.
 */
export function resolveAp21SkuColourDescription(
  sku: Ap21SkuColourIdentity,
  developmentLabel: string,
  descriptions: ReadonlyMap<string, string>,
): string {
  return descriptions.get(getAp21SkuColourDescriptionKey(sku))
    ?? toTitleCaseSkuExportLabel(developmentLabel);
}
