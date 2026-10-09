import { getSkuCompositeIdentity, normalizeSkuIdentityPart } from "./skuCompositeIdentity";

export type CancelledSkuIdentity = {
  style: string | null | undefined;
  colour: string | null | undefined;
  leather: string | null | undefined;
  colour2?: string | null | undefined;
  leather2?: string | null | undefined;
};

/**
 * Legacy cancelled-SKU records were stored at Upper 1 level and intentionally
 * hide every Upper 2 construction sharing that primary upper.
 */
export function getLegacyCancelledSkuKey(
  style: string | null | undefined,
  colour: string | null | undefined,
  leather: string | null | undefined,
): string {
  return `legacy:${[style, colour, leather].map(normalizeSkuIdentityPart).join("\u0000")}`;
}

/** A cancellation with Upper 2 is precise to one physical ordered SKU. */
export function getExactCancelledSkuKey(identity: CancelledSkuIdentity): string {
  return `exact:${getSkuCompositeIdentity(
    identity.style,
    identity.colour,
    identity.leather,
    identity.colour2,
    identity.leather2,
  )}`;
}

export function hasUpper2(identity: CancelledSkuIdentity): boolean {
  return Boolean(
    normalizeSkuIdentityPart(identity.colour2) || normalizeSkuIdentityPart(identity.leather2),
  );
}

/** Builds a mixed legacy/exact cancellation set from persisted cancellation rows. */
export function buildCancelledSkuKeySet(rows: readonly CancelledSkuIdentity[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(
      hasUpper2(row)
        ? getExactCancelledSkuKey(row)
        : getLegacyCancelledSkuKey(row.style, row.colour, row.leather),
    );
  }
  return keys;
}

/** Returns whether the requested physical SKU is cancelled by an exact or legacy rule. */
export function isCancelledSku(
  cancelledSkuKeys: ReadonlySet<string>,
  identity: CancelledSkuIdentity,
): boolean {
  const legacyKey = getLegacyCancelledSkuKey(identity.style, identity.colour, identity.leather);
  // The unprefixed variant was used by the first Buy Sheet exclusion helper.
  // Honour it while callers migrate to the explicit legacy/exact key format.
  const oldLegacyKey = [identity.style, identity.colour, identity.leather]
    .map(normalizeSkuIdentityPart)
    .join("\u0000");

  return cancelledSkuKeys.has(legacyKey)
    || cancelledSkuKeys.has(oldLegacyKey)
    || cancelledSkuKeys.has(getExactCancelledSkuKey(identity));
}
