export type SkuColumnRow = {
  style: string;
  colour: string;
  leather: string | null | undefined;
};

export type EditableCustomSku = SkuColumnRow & {
  id: number;
};

/**
 * Specs uses a compound column key only when a style has the same colour in
 * more than one leather. Build the same key for editable custom SKUs so, for
 * example, BLACK NAPPA and BLACK MESH can each open the correct edit form.
 */
export function buildEditableCustomSkuColumns(
  selectedStyle: string | null,
  allSkus: readonly SkuColumnRow[],
  customSkus: readonly EditableCustomSku[],
): Record<string, EditableCustomSku> {
  if (!selectedStyle) return {};

  const leathersByColour = new Map<string, Set<string>>();
  for (const sku of allSkus) {
    if (sku.style !== selectedStyle) continue;
    const leathers = leathersByColour.get(sku.colour) ?? new Set<string>();
    leathers.add(sku.leather ?? "");
    leathersByColour.set(sku.colour, leathers);
  }

  const columns: Record<string, EditableCustomSku> = {};
  for (const sku of customSkus) {
    if (sku.style !== selectedStyle) continue;
    const hasMultipleLeathers = (leathersByColour.get(sku.colour)?.size ?? 0) > 1;
    const columnKey = hasMultipleLeathers && sku.leather
      ? `${sku.colour} ${sku.leather}`
      : sku.colour;
    columns[columnKey] = sku;
  }
  return columns;
}
