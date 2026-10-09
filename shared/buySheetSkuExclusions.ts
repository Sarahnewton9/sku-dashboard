import { getSkuCompositeIdentity, normalizeSkuIdentityPart } from "./skuCompositeIdentity";

export type BuySheetSkuIdentity = {
  style: string;
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
  /** Original identity retained when a static SKU's display label is corrected. */
  _sourceColour?: string | null;
  _sourceLeather?: string | null;
  _sourceColour2?: string | null;
  _sourceLeather2?: string | null;
};

export type BuySheetSessionItem = {
  style: string;
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
};

/**
 * Historical SKU cancellations are stored at Upper 1 level. Keep that key
 * separate from a physical composite identity so existing cancellation records
 * continue to exclude the intended item(s), while active Upper 2 variants stay
 * distinguishable everywhere else.
 */
export function getCancelledBuySheetSkuKey(
  style: string | null | undefined,
  colour: string | null | undefined,
  leather: string | null | undefined,
): string {
  return [style, colour, leather].map(normalizeSkuIdentityPart).join("\u0000");
}

/** Build the active physical-SKU identities eligible to appear on a Buy Sheet. */
export function buildActiveBuySheetSkuIdentitySet(skus: readonly BuySheetSkuIdentity[]): Set<string> {
  const identities = new Set<string>();
  for (const sku of skus) {
    identities.add(getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2));

    // Quantity rows retain their original identity even when the dashboard
    // shows a corrected display label. Retain that source alias so a valid SKU
    // is not lost from an export merely because its wording was corrected.
    if (sku._sourceColour || sku._sourceLeather || sku._sourceColour2 || sku._sourceLeather2) {
      identities.add(getSkuCompositeIdentity(
        sku.style,
        sku._sourceColour ?? sku.colour,
        sku._sourceLeather ?? sku.leather,
        sku._sourceColour2 ?? sku.colour2,
        sku._sourceLeather2 ?? sku.leather2,
      ));
    }
  }
  return identities;
}

/**
 * A session quantity can remain in the database for history after its SKU is
 * deleted, cancelled or marked down. It must never reappear in the current Buy
 * Sheet, email attachment or live session preview.
 */
export function isActiveBuySheetSessionItem(
  item: BuySheetSessionItem,
  input: {
    activeSkuIdentities: ReadonlySet<string>;
    cancelledStyleNames: ReadonlySet<string>;
    cancelledSkuKeys: ReadonlySet<string>;
  },
): boolean {
  const style = normalizeSkuIdentityPart(item.style);
  if (input.cancelledStyleNames.has(style)) return false;
  if (input.cancelledSkuKeys.has(getCancelledBuySheetSkuKey(item.style, item.colour, item.leather))) return false;

  return input.activeSkuIdentities.has(
    getSkuCompositeIdentity(item.style, item.colour, item.leather, item.colour2, item.leather2),
  );
}
