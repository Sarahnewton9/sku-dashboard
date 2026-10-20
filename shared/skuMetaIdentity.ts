import { getSkuCompositeIdentity } from "./skuCompositeIdentity";

/**
 * SKU metadata was historically keyed by Upper 1 only. Metadata now retains
 * Upper 2, so sample status and other per-SKU attributes must resolve using
 * the full physical identity first. The primary-only key remains a backward
 * compatible fallback for legacy single-upper rows.
 */
export type SkuMetaIdentity = {
  style: string;
  colour: string;
  leather?: string | null;
  colour2?: string | null;
  leather2?: string | null;
};

export function getSkuMetaPrimaryKey(sku: SkuMetaIdentity): string {
  return `${sku.style}|${sku.colour}|${sku.leather ?? ""}`;
}

export function getSkuMetaCompositeKey(sku: SkuMetaIdentity): string {
  return getSkuCompositeIdentity(
    sku.style,
    sku.colour,
    sku.leather ?? "",
    sku.colour2 ?? "",
    sku.leather2 ?? "",
  );
}

export function buildSkuMetaLookup<T extends SkuMetaIdentity>(rows: readonly T[]) {
  const byPrimary: Record<string, T> = {};
  const byComposite: Record<string, T> = {};

  for (const row of rows) {
    byPrimary[getSkuMetaPrimaryKey(row)] = row;
    byComposite[getSkuMetaCompositeKey(row)] = row;
  }

  return { byPrimary, byComposite };
}

export function resolveSkuMeta<T extends SkuMetaIdentity>(
  lookup: ReturnType<typeof buildSkuMetaLookup<T>>,
  sku: SkuMetaIdentity,
): T | undefined {
  return lookup.byComposite[getSkuMetaCompositeKey(sku)]
    ?? lookup.byPrimary[getSkuMetaPrimaryKey(sku)];
}
