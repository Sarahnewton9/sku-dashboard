import { describe, expect, it } from "vitest";
import {
  getStoredBuyMarketTotals,
  getBuyMarketTotal,
  sumBuyMarketTotals,
  toBuyMarketTotals,
} from "@shared/buyMarketTotals";

describe("buy market totals", () => {
  it("assigns a legacy unsplit quantity to AU when no AU quantity exists", () => {
    expect(getStoredBuyMarketTotals({ qty: 60, auQty: 0, usaQty: 12, nycQty: 3, laQty: 4 }))
      .toEqual({ au: 60, usa: 12, nyc: 3, la: 4 });
    expect(getStoredBuyMarketTotals({ qty: 60, auQty: 80, usaQty: 12 }))
      .toEqual({ au: 80, usa: 12, nyc: 0, la: 0 });
  });

  it("keeps AU, USA, NYC and LA quantities in the same total", () => {
    const totals = sumBuyMarketTotals([
      { totalAu: 15_042, totalUsa: 9_222, totalNyc: 1_554, totalLa: 1_134 },
      { totalAu: 8, totalUsa: 2, totalNyc: 1, totalLa: 4 },
    ]);

    expect(totals).toEqual({ au: 15_050, usa: 9_224, nyc: 1_555, la: 1_138 });
    expect(getBuyMarketTotal(totals)).toBe(26_967);
  });

  it("treats missing market values as zero without dropping the other stores", () => {
    expect(toBuyMarketTotals({ totalAu: 10, totalLa: 6 })).toEqual({
      au: 10,
      usa: 0,
      nyc: 0,
      la: 6,
    });
  });
});
