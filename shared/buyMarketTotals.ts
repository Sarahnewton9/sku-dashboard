export type BuyMarketQuantities = {
  totalAu?: number | null;
  totalUsa?: number | null;
  totalNyc?: number | null;
  totalLa?: number | null;
};

/** A stored session item can retain the pre-market-split `qty` field. */
export type StoredBuyMarketQuantities = {
  auQty?: number | null;
  usaQty?: number | null;
  nycQty?: number | null;
  laQty?: number | null;
  qty?: number | null;
};

export type BuyMarketTotals = {
  au: number;
  usa: number;
  nyc: number;
  la: number;
};

function asQuantity(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function toBuyMarketTotals(value?: BuyMarketQuantities | null): BuyMarketTotals {
  return {
    au: asQuantity(value?.totalAu),
    usa: asQuantity(value?.totalUsa),
    nyc: asQuantity(value?.totalNyc),
    la: asQuantity(value?.totalLa),
  };
}

/**
 * Normalise a stored Buy Session item to its four current markets. Old items
 * recorded before the market split retain their quantity in `qty`; that value
 * belongs to AU only when no AU quantity has subsequently been saved.
 */
export function getStoredBuyMarketTotals(value?: StoredBuyMarketQuantities | null): BuyMarketTotals {
  const savedAu = asQuantity(value?.auQty);
  return {
    au: savedAu || asQuantity(value?.qty),
    usa: asQuantity(value?.usaQty),
    nyc: asQuantity(value?.nycQty),
    la: asQuantity(value?.laQty),
  };
}

export function sumBuyMarketTotals(values: ReadonlyArray<BuyMarketQuantities | null | undefined>): BuyMarketTotals {
  return values.reduce<BuyMarketTotals>((totals, value) => {
    const markets = toBuyMarketTotals(value);
    return {
      au: totals.au + markets.au,
      usa: totals.usa + markets.usa,
      nyc: totals.nyc + markets.nyc,
      la: totals.la + markets.la,
    };
  }, { au: 0, usa: 0, nyc: 0, la: 0 });
}

export function getBuyMarketTotal(totals: BuyMarketTotals): number {
  return totals.au + totals.usa + totals.nyc + totals.la;
}
