import { buildSpecColourKeyLookup, getSpecSkuIdentity } from "./specColourKey";

export type SkuColumnRow = {
  style: string;
  colour: string;
  leather: string | null | undefined;
  colour2?: string | null | undefined;
  leather2?: string | null | undefined;
};

export type EditableCustomSku = SkuColumnRow & {
  id: number;
};

/**
 * Specs uses a compound column key only when a style has the same colour in
 * more than one leather or Upper 2. Build the same key for editable custom
 * SKUs so each physical SKU can open the correct edit form.
 */
export function buildEditableCustomSkuColumns(
  selectedStyle: string | null,
  allSkus: readonly SkuColumnRow[],
  customSkus: readonly EditableCustomSku[],
): Record<string, EditableCustomSku> {
  if (!selectedStyle) return {};

  const keyBySku = buildSpecColourKeyLookup(allSkus.filter((sku) => sku.style === selectedStyle));

  const columns: Record<string, EditableCustomSku> = {};
  for (const sku of customSkus) {
    if (sku.style !== selectedStyle) continue;
    const columnKey = keyBySku.get(getSpecSkuIdentity(
      sku.style,
      sku.colour,
      sku.leather,
      sku.colour2,
      sku.leather2,
    )) ?? sku.colour;
    columns[columnKey] = sku;
  }
  return columns;
}
