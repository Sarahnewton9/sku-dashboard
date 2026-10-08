import { getSkuCompositeIdentity } from "./skuCompositeIdentity";

export type CompositeSku = {
  style: string;
  colour: string;
  leather?: string | null;
  colour2?: string | null;
  leather2?: string | null;
};

/**
 * Keeps the first occurrence of each exact physical SKU identity.
 *
 * Upper 2 remains part of the identity: a matching Upper 1 with a different
 * secondary upper is still a separate physical SKU. This only suppresses true
 * duplicates from imported/static data before any dashboard or export uses it.
 */
export function dedupeSkusByCompositeIdentity<T extends CompositeSku>(skus: readonly T[]): T[] {
  const identities = new Set<string>();
  const unique: T[] = [];

  for (const sku of skus) {
    const identity = getSkuCompositeIdentity(
      sku.style,
      sku.colour,
      sku.leather,
      sku.colour2,
      sku.leather2,
    );
    if (identities.has(identity)) continue;
    identities.add(identity);
    unique.push(sku);
  }

  return unique;
}
