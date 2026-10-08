export type BuyMarketQuantities = {
  totalAu?: number | null;
  totalUsa?: number | null;
  totalNyc?: number | null;
  totalLa?: number | null;
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
