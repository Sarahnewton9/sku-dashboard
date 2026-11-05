import { getSkuCompositeIdentity } from "./skuCompositeIdentity";
import type { SkuMetaIdentity } from "./skuMetaIdentity";
import { formatSkuExportLabel } from "./skuExportLabel";

export type SampleStatus = "waiting" | "fitting_sample" | "received";
export type SampleReceiptMeta = SkuMetaIdentity & { sampleStatus?: string | null };
export type SampleReceiptSku = SkuMetaIdentity & {
  is_new?: boolean;
  _sourceColour?: string;
  _sourceLeather?: string;
};

export function sampleReceiptIdentity(sku: SampleReceiptSku): SkuMetaIdentity {
  return {
    style: sku.style,
    colour: sku._sourceColour ?? sku.colour,
    leather: sku._sourceLeather ?? sku.leather ?? "",
    colour2: sku.colour2 ?? "",
    leather2: sku.leather2 ?? "",
  };
}

const keyFor = (sku: SkuMetaIdentity) => getSkuCompositeIdentity(
  sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2,
);
const priority: Record<SampleStatus, number> = { waiting: 0, fitting_sample: 1, received: 2 };

/** NULL/blank Upper 2 duplicates are the same physical SKU. Retain receipt
 * evidence instead of allowing a default waiting copy to overwrite it. Receipt
 * updates write all copies of the exact identity, so explicit resets still work.
 * Legacy primary-only receipts may apply to a two-upper construction only when
 * it is the sole active physical SKU with that Upper 1. Multiple variants are
 * deliberately left unresolved rather than borrowing a sibling's receipt.
 */
export function buildSampleReceiptLookup(rows: readonly SampleReceiptMeta[], skus: readonly SampleReceiptSku[] = []) {
  const lookup = new Map<string, SampleStatus>();
  for (const row of rows) {
    const key = keyFor(row);
    const status: SampleStatus = row.sampleStatus === "received" || row.sampleStatus === "fitting_sample"
      ? row.sampleStatus : "waiting";
    if (!lookup.has(key) || priority[status] > priority[lookup.get(key)!]) lookup.set(key, status);
  }
  const variants = new Map<string, Set<string>>();
  for (const sku of skus) {
    const identity = sampleReceiptIdentity(sku);
    const primary = keyFor({ ...identity, colour2: "", leather2: "" });
    if (!variants.has(primary)) variants.set(primary, new Set());
    variants.get(primary)!.add(keyFor(identity));
  }
  return { byIdentity: lookup, variants };
}

export function resolveSampleReceiptStatus(
  lookup: ReturnType<typeof buildSampleReceiptLookup>, sku: SampleReceiptSku,
): SampleStatus {
  const identity = sampleReceiptIdentity(sku);
  const key = keyFor(identity);
  const exact = lookup.byIdentity.get(key);
  if (exact !== undefined) return exact;
  const primary = keyFor({ ...identity, colour2: "", leather2: "" });
  if (lookup.variants.get(primary)?.size === 1) {
    return lookup.byIdentity.get(primary) ?? "waiting";
  }
  return "waiting";
}

export function buildSampleReceiptWorklist(
  skus: readonly SampleReceiptSku[], rows: readonly SampleReceiptMeta[],
  cancelledStyles: ReadonlySet<string> = new Set(),
) {
  const lookup = buildSampleReceiptLookup(rows, skus.filter((sku) => !cancelledStyles.has(sku.style)));
  const seen = new Set<string>();
  const list = skus.flatMap((sku) => {
    if (!sku.is_new || cancelledStyles.has(sku.style)) return [];
    const key = keyFor(sku);
    if (seen.has(key)) return [];
    seen.add(key);
    const status = resolveSampleReceiptStatus(lookup, sku);
    return [{ key, sku, status, identity: sampleReceiptIdentity(sku),
      label: `${sku.style} — ${formatSkuExportLabel(sku)}` }];
  }).sort((a, b) => a.label.localeCompare(b.label));
  const receivedSkus = list.filter((row) => row.status !== "waiting");
  const waitingSkus = list.filter((row) => row.status === "waiting");
  return { receivedSkus, waitingSkus,
    counts: { total: list.length, received: receivedSkus.length, waiting: waitingSkus.length } };
}
