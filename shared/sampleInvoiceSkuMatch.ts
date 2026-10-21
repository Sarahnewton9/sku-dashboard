export type SampleInvoiceSku = {
  style: string;
  colour: string;
  leather?: string | null;
  colour2?: string | null;
  leather2?: string | null;
};

export type SampleInvoiceMatchInput = {
  style: string;
  colour: string;
  material?: string | null;
};

export type SampleInvoiceMatch = {
  matchedSku: SampleInvoiceSku | null;
  confidence: number;
};

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  let common = 0;
  leftTokens.forEach((token) => { if (rightTokens.has(token)) common += 1; });
  const union = new Set(Array.from(leftTokens).concat(Array.from(rightTokens))).size;
  return union === 0 ? 0 : common / union;
}

export function getSampleInvoiceSkuLabel(sku: SampleInvoiceSku): string {
  const upper1 = `${sku.colour ?? ""} ${sku.leather ?? ""}`.trim();
  const upper2 = `${sku.colour2 ?? ""} ${sku.leather2 ?? ""}`.trim();
  return upper2 ? `${upper1}/${upper2}` : upper1;
}

/**
 * Select the best live-range physical SKU for a supplier invoice row. The
 * full label includes Upper 2 when present, preventing an invoice colourway
 * from silently attaching to a sibling that only shares Upper 1.
 */
export function matchSampleInvoiceSku(
  row: SampleInvoiceMatchInput,
  skus: readonly SampleInvoiceSku[],
): SampleInvoiceMatch {
  const invoiceStyle = normalize(row.style);
  const invoiceColour = normalize(row.colour);
  const invoiceColourWithMaterial = normalize(`${row.colour ?? ""} ${row.material ?? ""}`);
  let bestSku: SampleInvoiceSku | null = null;
  let bestScore = 0;

  for (const sku of skus) {
    const styleScore = tokenSimilarity(invoiceStyle, normalize(sku.style));
    if (styleScore < 0.5) continue;

    const skuLabel = normalize(getSampleInvoiceSkuLabel(sku));
    const colourScore = Math.max(
      tokenSimilarity(invoiceColour, skuLabel),
      tokenSimilarity(invoiceColourWithMaterial, skuLabel),
    );
    const score = (styleScore * 0.5) + (colourScore * 0.5);
    if (score > bestScore) {
      bestScore = score;
      bestSku = sku;
    }
  }

  return {
    matchedSku: bestScore >= 0.45 ? bestSku : null,
    confidence: Math.round(bestScore * 100),
  };
}
