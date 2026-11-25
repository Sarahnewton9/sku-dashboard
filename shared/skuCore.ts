import { getSkuCompositeIdentity } from "./skuCompositeIdentity";
import type { SkuMetaIdentity } from "./skuMetaIdentity";

/** The saved Upper 1 remains authoritative when a static label is corrected. */
export type CoreSkuIdentity = SkuMetaIdentity & {
  _sourceColour?: string;
  _sourceLeather?: string;
};

export type CoreSkuMetaRow = CoreSkuIdentity & {
  isCore?: boolean | null;
  colourOverride?: string | null;
  leatherOverride?: string | null;
};

export type SkuCoreLookup = {
  byIdentity: ReadonlyMap<string, boolean>;
  byDisplayIdentity: ReadonlyMap<string, boolean>;
};

// Same source/default conventions as sampleReceiptIdentity, but CORE never
// inherits from a primary-only row, even for the sole active Upper 2 variant.
const sourceKey = (sku: CoreSkuIdentity): string => getSkuCompositeIdentity(
  sku.style,
  sku._sourceColour ?? sku.colour,
  sku._sourceLeather ?? sku.leather ?? "",
  sku.colour2 ?? "",
  sku.leather2 ?? "",
);
const displayKey = (sku: CoreSkuIdentity): string => getSkuCompositeIdentity(
  sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2,
);

/**
 * Only an explicit true confirms CORE. NULL/blank Upper 2 copies are one exact
 * identity; a false/unset copy wins a disagreement, independently of row order.
 * Saving CORE must align all exact copies, rather than borrowing a sibling's
 * flag or relying on whichever metadata row happened to be returned last.
 */
export function buildSkuCoreLookup(rows: readonly CoreSkuMetaRow[]): SkuCoreLookup {
  const byIdentity = new Map<string, boolean>();
  const byDisplayIdentity = new Map<string, boolean>();
  const merge = (map: Map<string, boolean>, key: string, value: boolean) => {
    map.set(key, (map.get(key) ?? true) && value);
  };

  for (const row of rows) merge(byIdentity, sourceKey(row), row.isCore === true);
  for (const row of rows) {
    const colour = row.colourOverride?.trim() || row.colour;
    const leather = row.leatherOverride?.trim() || row.leather;
    merge(byDisplayIdentity, displayKey({ ...row, colour, leather }), byIdentity.get(sourceKey(row)) === true);
  }
  return { byIdentity, byDisplayIdentity };
}

/** Resolve source first, then an exact displayed key/alias; never Upper 1 only. */
export function isCoreSku(lookup: SkuCoreLookup, sku: CoreSkuIdentity): boolean {
  const source = lookup.byIdentity.get(sourceKey(sku));
  if (source !== undefined) return source === true;
  const displayed = displayKey(sku);
  const exactDisplay = lookup.byIdentity.get(displayed);
  if (exactDisplay !== undefined) return exactDisplay === true;
  return lookup.byDisplayIdentity.get(displayed) === true;
}

export type SkuRangeStatus = "all" | "core" | "carryover" | "new";
export type SkuRangeFlags = { is_core?: boolean; is_new?: boolean };

/** Mutually exclusive classifications: CORE takes precedence over NEW. */
export function matchesSkuRangeStatus(sku: SkuRangeFlags, status: SkuRangeStatus): boolean {
  if (status === "all") return true;
  if (sku.is_core === true) return status === "core";
  if (status === "core") return false;
  return status === "new" ? sku.is_new === true : sku.is_new !== true;
}
