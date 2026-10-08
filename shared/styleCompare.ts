export type StyleCompareSku = {
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
  is_new?: boolean;
};

export type StyleCompareSummary = {
  skuCount: number;
  newSkuCount: number;
  existingSkuCount: number;
  materialLabels: string[];
  colourLabels: string[];
};

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(normalise).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

/**
 * Returns a compact, deterministic comparison summary from the physical SKUs
 * currently in the active range. Upper 2 values remain visible rather than
 * being flattened into the primary material/colour.
 */
export function summariseStyleForComparison(skus: StyleCompareSku[]): StyleCompareSummary {
  const materialLabels = uniqueSorted(skus.flatMap((sku) => [sku.leather, sku.leather2]));
  const colourLabels = uniqueSorted(skus.flatMap((sku) => [sku.colour, sku.colour2]));
  const newSkuCount = skus.filter((sku) => sku.is_new).length;

  return {
    skuCount: skus.length,
    newSkuCount,
    existingSkuCount: skus.length - newSkuCount,
    materialLabels,
    colourLabels,
  };
}

/**
 * Finds the overlapping colour and material vocabulary between two styles.
 * This is a decision aid only; it never treats two physical SKUs as identical.
 */
export function getStyleComparisonOverlap(left: StyleCompareSku[], right: StyleCompareSku[]) {
  const leftSummary = summariseStyleForComparison(left);
  const rightSummary = summariseStyleForComparison(right);
  const rightMaterials = new Set(rightSummary.materialLabels);
  const rightColours = new Set(rightSummary.colourLabels);

  return {
    sharedMaterialLabels: leftSummary.materialLabels.filter((label) => rightMaterials.has(label)),
    sharedColourLabels: leftSummary.colourLabels.filter((label) => rightColours.has(label)),
  };
}
