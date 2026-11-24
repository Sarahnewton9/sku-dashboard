import { getBuyMarketTotal, sumBuyMarketTotals, toBuyMarketTotals, type BuyMarketQuantities } from "./buyMarketTotals";
import { getSkuCompositeIdentity } from "./skuCompositeIdentity";

export type StyleBuyFilter = "all" | "bought" | "unbought";

type ActiveColourway = {
  style: string;
  colour: string;
  leather?: string | null;
  colour2?: string | null;
  leather2?: string | null;
};

/** Only current active colourways count; quantities are already season-scoped
 * and aggregated across every session by getAllSessionQtys. */
export function summariseActiveStyleBuys(
  skus: readonly ActiveColourway[],
  quantities: Readonly<Record<string, BuyMarketQuantities | undefined>>,
) {
  const seen = new Set<string>();
  const values: Array<BuyMarketQuantities | undefined> = [];
  let boughtSkus = 0;
  for (const sku of skus) {
    const key = getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2);
    if (seen.has(key)) continue;
    seen.add(key);
    const quantity = quantities[key];
    values.push(quantity);
    if (getBuyMarketTotal(toBuyMarketTotals(quantity)) > 0) boughtSkus += 1;
  }
  const markets = sumBuyMarketTotals(values);
  return { ...markets, total: getBuyMarketTotal(markets), boughtSkus, unboughtSkus: seen.size - boughtSkus };
}

/** A partly bought style belongs in 'bought', not 'unbought'. */
export function matchesStyleBuyFilter(filter: StyleBuyFilter, summary: { boughtSkus: number }): boolean {
  if (filter === "bought") return summary.boughtSkus > 0;
  if (filter === "unbought") return summary.boughtSkus === 0;
  return true;
}
