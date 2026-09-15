export type ActiveStyleSku = {
  colour: string;
  leather: string;
  is_new: boolean;
};

/**
 * Builds the SKU-derived fields for a custom style. An empty SKU list is
 * intentional: it represents a newly created style that is ready for colours
 * to be added and must still be visible in By Style.
 */
export function summarizeCustomStyleSkus(activeSkus: readonly ActiveStyleSku[]) {
  const totalSKUs = activeSkus.length;
  const newSKUs = activeSkus.filter((sku) => sku.is_new).length;

  return {
    colours: Array.from(new Set(activeSkus.map((sku) => sku.colour))),
    leathers: Array.from(new Set(activeSkus.map((sku) => sku.leather).filter(Boolean))),
    totalSKUs,
    newSKUs,
    existingSKUs: totalSKUs - newSKUs,
    hasNew: newSKUs > 0,
    isAllNew: newSKUs === totalSKUs && totalSKUs > 0,
  };
}
