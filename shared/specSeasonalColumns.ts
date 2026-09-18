import {
  buildSpecColourKeyLookup,
  getSpecSkuIdentity,
  normalizeSpecColourPart,
  type SpecColourSku,
} from "./specColourKey";

export type SeasonalSpecSku = SpecColourSku & {
  is_new?: boolean;
  isNew?: boolean;
};

/**
 * Returns the live Specs column keys for new seasonal SKU rows, grouped by style.
 * Keys use the same duplicate-colour rule as the Specs grid, so a new SUEDE
 * colour remains distinct from an existing NAPPA colour of the same name.
 */
export function buildNewSpecColourColumns(
  skus: readonly SeasonalSpecSku[],
): Record<string, string[]> {
  const keyBySku = buildSpecColourKeyLookup(skus);
  const result: Record<string, string[]> = {};

  for (const sku of skus) {
    if (!(sku.is_new ?? sku.isNew ?? false)) continue;
    const style = normalizeSpecColourPart(sku.style);
    const colour = normalizeSpecColourPart(sku.colour);
    const leather = normalizeSpecColourPart(sku.leather);
    if (!style || !colour) continue;

    const key = keyBySku.get(getSpecSkuIdentity(style, colour, leather)) ?? colour;
    const columns = result[style] ?? [];
    if (!columns.includes(key)) columns.push(key);
    result[style] = columns;
  }

  return result;
}
