import { describe, expect, it } from "vitest";
import {
  sumBuyMarketTotals,
  type BuyMarketQuantities,
} from "@shared/buyMarketTotals";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";
import {
  matchesStyleBuyFilter,
  summariseActiveStyleBuys,
  type StyleBuyFilter,
} from "@shared/styleBuyStatus";

type ActiveSku = {
  style: string;
  colour: string;
  leather?: string | null;
  colour2?: string | null;
  leather2?: string | null;
};

const skuKey = (sku: ActiveSku) =>
  getSkuCompositeIdentity(
    sku.style,
    sku.colour,
    sku.leather,
    sku.colour2,
    sku.leather2,
  );

const astiBlack: ActiveSku = {
  style: "ASTI",
  colour: "BLACK",
  leather: "NAPPA",
};

const emptySummary = {
  au: 0,
  usa: 0,
  nyc: 0,
  la: 0,
  total: 0,
  boughtSkus: 0,
  unboughtSkus: 0,
};

describe("summariseActiveStyleBuys", () => {
  it("returns the complete zero summary for an empty active style", () => {
    expect(summariseActiveStyleBuys([], {})).toEqual(emptySummary);
  });

  it("counts active SKUs without quantities as unbought", () => {
    const skus = [astiBlack, { ...astiBlack, colour: "TAN" }];

    expect(summariseActiveStyleBuys(skus, {})).toEqual({
      ...emptySummary,
      unboughtSkus: 2,
    });
  });

  it.each([
    ["AU", "totalAu", "au"],
    ["USA", "totalUsa", "usa"],
    ["NYC", "totalNyc", "nyc"],
    ["LA", "totalLa", "la"],
  ] as const)("recognises a positive %s-only buy", (_label, field, market) => {
    const quantities: Record<string, BuyMarketQuantities | undefined> = {
      [skuKey(astiBlack)]: { [field]: 5 },
    };

    expect(summariseActiveStyleBuys([astiBlack], quantities)).toEqual({
      ...emptySummary,
      [market]: 5,
      total: 5,
      boughtSkus: 1,
    });
  });

  it("keeps a style with mixed bought and unbought SKUs in the bought filter only", () => {
    const skus = [
      astiBlack,
      { ...astiBlack, colour: "TAN" },
      { ...astiBlack, colour: "WHITE" },
    ];
    const summary = summariseActiveStyleBuys(skus, {
      [skuKey(skus[0])]: { totalAu: 5 },
      [skuKey(skus[1])]: { totalLa: 7 },
    });

    expect(summary).toEqual({
      au: 5,
      usa: 0,
      nyc: 0,
      la: 7,
      total: 12,
      boughtSkus: 2,
      unboughtSkus: 1,
    });
    expect(matchesStyleBuyFilter("all", summary)).toBe(true);
    expect(matchesStyleBuyFilter("bought", summary)).toBe(true);
    expect(matchesStyleBuyFilter("unbought", summary)).toBe(false);
  });

  it("uses the supplied all-session aggregate, including quantities from every market", () => {
    // The caller supplies an aggregate across sessions, not just the selected one.
    const allSessions = sumBuyMarketTotals([
      { totalAu: 10 },
      { totalUsa: 20 },
      { totalNyc: 30 },
      { totalLa: 40 },
    ]);
    const quantities = {
      [skuKey(astiBlack)]: {
        totalAu: allSessions.au,
        totalUsa: allSessions.usa,
        totalNyc: allSessions.nyc,
        totalLa: allSessions.la,
      },
    };

    expect(summariseActiveStyleBuys([astiBlack], quantities)).toEqual({
      au: 10,
      usa: 20,
      nyc: 30,
      la: 40,
      total: 100,
      boughtSkus: 1,
      unboughtSkus: 0,
    });
  });

  it("matches the exact ordered composite identity, including Upper 2 colour and leather", () => {
    const royal = {
      style: "ZOE",
      colour: "ECRU",
      leather: "SNAKE",
      colour2: "ROYAL",
      leather2: "SUEDE",
    };
    const lipstick = { ...royal, colour2: "LIPSTICK" };
    const royalNappa = { ...royal, leather2: "NAPPA" };
    const quantities = {
      [skuKey(royal)]: { totalAu: 6 },
      [skuKey(lipstick)]: { totalUsa: 10 },
    };

    expect(summariseActiveStyleBuys([royal], quantities)).toEqual({
      ...emptySummary,
      au: 6,
      total: 6,
      boughtSkus: 1,
    });
    expect(summariseActiveStyleBuys([royalNappa], quantities)).toEqual({
      ...emptySummary,
      unboughtSkus: 1,
    });
    expect(
      summariseActiveStyleBuys([royal, lipstick, royalNappa], quantities),
    ).toEqual({
      ...emptySummary,
      au: 6,
      usa: 10,
      total: 16,
      boughtSkus: 2,
      unboughtSkus: 1,
    });
  });

  it("ignores cancelled and historical buy rows absent from the active SKU list", () => {
    const cancelled = { ...astiBlack, colour: "CANCELLED TAN" };
    const historical = { ...astiBlack, colour: "OLD WHITE" };
    const anotherStyle = { ...astiBlack, style: "ZOE" };
    const quantities = {
      [skuKey(cancelled)]: { totalAu: 100 },
      [skuKey(historical)]: { totalUsa: 200, totalNyc: 300 },
      [skuKey(anotherStyle)]: { totalLa: 400 },
    };

    const summary = summariseActiveStyleBuys([astiBlack], quantities);
    expect(summary).toEqual({ ...emptySummary, unboughtSkus: 1 });
    expect(matchesStyleBuyFilter("bought", summary)).toBe(false);
    expect(matchesStyleBuyFilter("unbought", summary)).toBe(true);
    expect(summariseActiveStyleBuys([], quantities)).toEqual(emptySummary);
  });

  it("deduplicates repeated and normalised active identities before summing or counting", () => {
    const tan = { ...astiBlack, colour: "TAN" };
    const duplicateBlack = {
      style: " asti ",
      colour: " black ",
      leather: " nappa ",
      colour2: null,
      leather2: " ",
    };
    const skus = [astiBlack, astiBlack, duplicateBlack, tan, { ...tan }];

    expect(
      summariseActiveStyleBuys(skus, {
        [skuKey(astiBlack)]: { totalNyc: 5 },
      }),
    ).toEqual({
      ...emptySummary,
      nyc: 5,
      total: 5,
      boughtSkus: 1,
      unboughtSkus: 1,
    });
  });

  it("returns numeric zero totals for zero, empty and explicitly undefined quantities", () => {
    const skus = [
      astiBlack,
      { ...astiBlack, colour: "TAN" },
      { ...astiBlack, colour: "WHITE" },
    ];
    const quantities: Readonly<Record<string, BuyMarketQuantities | undefined>> = {
      [skuKey(skus[0])]: {
        totalAu: 0,
        totalUsa: 0,
        totalNyc: 0,
        totalLa: 0,
      },
      [skuKey(skus[1])]: {},
      [skuKey(skus[2])]: undefined,
    };

    expect(summariseActiveStyleBuys(skus, quantities)).toEqual({
      ...emptySummary,
      unboughtSkus: 3,
    });
  });

  it("treats null and nonfinite market quantities as zero", () => {
    const quantities = {
      [skuKey(astiBlack)]: {
        totalAu: null,
        totalUsa: Number.NaN,
        totalNyc: Number.POSITIVE_INFINITY,
        totalLa: Number.NEGATIVE_INFINITY,
      },
    };

    expect(summariseActiveStyleBuys([astiBlack], quantities)).toEqual({
      ...emptySummary,
      unboughtSkus: 1,
    });
  });

  it("preserves a valid positive market alongside null and nonfinite quantities", () => {
    const quantities = {
      [skuKey(astiBlack)]: {
        totalAu: null,
        totalUsa: Number.NaN,
        totalNyc: Number.POSITIVE_INFINITY,
        totalLa: 5,
      },
    };

    expect(summariseActiveStyleBuys([astiBlack], quantities)).toEqual({
      ...emptySummary,
      la: 5,
      total: 5,
      boughtSkus: 1,
    });
  });
});

describe("matchesStyleBuyFilter", () => {
  it.each([
    ["all", 0, true],
    ["all", 2, true],
    ["bought", 0, false],
    ["bought", 1, true],
    ["bought", 2, true],
    ["unbought", 0, true],
    ["unbought", 1, false],
    ["unbought", 2, false],
  ] satisfies [StyleBuyFilter, number, boolean][])(
    "%s with %i bought SKUs returns %s",
    (filter, boughtSkus, expected) => {
      expect(matchesStyleBuyFilter(filter, { boughtSkus })).toBe(expected);
    },
  );
});
