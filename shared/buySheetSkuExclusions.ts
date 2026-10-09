import { getSkuCompositeIdentity, normalizeSkuIdentityPart } from "./skuCompositeIdentity";
import { isMarkdownSku } from "./markdownSku";
import { isCancelledSku } from "./cancelledSkuIdentity";

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
 * Retained for compatibility with older callers. New code should use the
 * Upper 2-aware cancelled SKU identity helper.
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
 * explicitly cancelled, deleted or marked down. It must never reappear in the
 * current Buy Sheet, email attachment or live session preview.
 *
 * Do not require a session row to match the current active range. A locked buy
 * session is historical: range data can evolve after it was bought (for
 * example, an Upper 2 correction or a SKU that has not yet been restored to
 * W27), and that must not make a valid recorded purchase disappear.
 */
export function isActiveBuySheetSessionItem(
  item: BuySheetSessionItem,
  input: {
    cancelledStyleNames: ReadonlySet<string>;
    cancelledSkuKeys: ReadonlySet<string>;
    markdownSkuSet?: ReadonlySet<string>;
  },
): boolean {
  const style = normalizeSkuIdentityPart(item.style);
  if (input.cancelledStyleNames.has(style)) return false;
  if (isCancelledSku(input.cancelledSkuKeys, item)) return false;
  if (input.markdownSkuSet && isMarkdownSku(input.markdownSkuSet, item.style, item.colour, item.leather)) return false;
  return true;
}
