import { getSkuCompositeIdentity, normalizeSkuIdentityPart } from "./skuCompositeIdentity";
import { getBuyMarketTotal, getStoredBuyMarketTotals, type StoredBuyMarketQuantities } from "./buyMarketTotals";

export type BuySkuIdentity = {
  style: string;
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
};

export type SkuMetaIdentityState = {
  colourOverride?: string | null;
  leatherOverride?: string | null;
  colour2?: string | null;
  leather2?: string | null;
};

export type SkuMetaIdentityUpdate = BuySkuIdentity & SkuMetaIdentityState;

function asIdentity(identity: BuySkuIdentity): Required<BuySkuIdentity> {
  return {
    style: normalizeSkuIdentityPart(identity.style),
    colour: normalizeSkuIdentityPart(identity.colour),
    leather: normalizeSkuIdentityPart(identity.leather),
    colour2: normalizeSkuIdentityPart(identity.colour2),
    leather2: normalizeSkuIdentityPart(identity.leather2),
  };
}

function sameIdentity(left: BuySkuIdentity, right: BuySkuIdentity): boolean {
  return getSkuCompositeIdentity(left.style, left.colour, left.leather, left.colour2, left.leather2)
    === getSkuCompositeIdentity(right.style, right.colour, right.leather, right.colour2, right.leather2);
}

/**
 * Builds the old/new Buy Session identity for a static SKU metadata edit.
 * Metadata is stored under the original SKU identity, while colour overrides
 * are the displayed colourway used by buying, so quantities must move to the
 * new identity whenever an upper changes.
 */
export function getStaticSkuBuyRename(
  update: SkuMetaIdentityUpdate,
  existing?: SkuMetaIdentityState | null,
): { previous: Required<BuySkuIdentity>; next: Required<BuySkuIdentity> } | null {
  const changesIdentity = update.colourOverride !== undefined
    || update.leatherOverride !== undefined
    || update.colour2 !== undefined
    || update.leather2 !== undefined;
  if (!changesIdentity) return null;

  const source = asIdentity(update);
  const previous = asIdentity({
    style: source.style,
    colour: existing?.colourOverride || source.colour,
    leather: existing?.leatherOverride || source.leather,
    colour2: existing?.colour2 ?? "",
    leather2: existing?.leather2 ?? "",
  });
  const next = asIdentity({
    style: source.style,
    colour: update.colourOverride === undefined
      ? previous.colour
      : (update.colourOverride || source.colour),
    leather: update.leatherOverride === undefined
      ? previous.leather
      : (update.leatherOverride || source.leather),
    colour2: update.colour2 === undefined ? previous.colour2 : update.colour2,
    leather2: update.leather2 === undefined ? previous.leather2 : update.leather2,
  });

  return sameIdentity(previous, next) ? null : { previous, next };
}

export function getCustomSkuBuyRename(
  previous: BuySkuIdentity,
  next: BuySkuIdentity,
): { previous: Required<BuySkuIdentity>; next: Required<BuySkuIdentity> } | null {
  const normalizedPrevious = asIdentity(previous);
  const normalizedNext = asIdentity(next);
  return sameIdentity(normalizedPrevious, normalizedNext)
    ? null
    : { previous: normalizedPrevious, next: normalizedNext };
}

/**
 * A rename can meet an existing Buy Session row (for example when two colour
 * labels are consolidated). Keep every market quantity instead of overwriting
 * the original row, including legacy `qty` values that pre-date market splits.
 */
export function mergeRenamedBuySessionQuantities(
  source: StoredBuyMarketQuantities,
  target: StoredBuyMarketQuantities,
) {
  const sourceMarkets = getStoredBuyMarketTotals(source);
  const targetMarkets = getStoredBuyMarketTotals(target);
  const merged = {
    au: sourceMarkets.au + targetMarkets.au,
    usa: sourceMarkets.usa + targetMarkets.usa,
    nyc: sourceMarkets.nyc + targetMarkets.nyc,
    la: sourceMarkets.la + targetMarkets.la,
  };
  return {
    auQty: merged.au,
    usaQty: merged.usa,
    nycQty: merged.nyc,
    laQty: merged.la,
    qty: getBuyMarketTotal(merged),
  };
}
