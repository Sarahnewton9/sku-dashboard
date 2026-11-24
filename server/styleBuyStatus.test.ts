import { describe, expect, it } from "vitest";
import {
  sumBuyMarketTotals,
  type BuyMarketQuantities,
} from "@shared/buyMarketTotals";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";
import {
  getMatchingStyleBuySkus,
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
  is_new?: boolean;
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

  it("keeps a style with mixed bought and unbought SKUs in both buy filters", () => {
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
    expect(matchesStyleBuyFilter("unbought", summary)).toBe(true);
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
    ["all", 0, 0, true],
    ["all", 2, 0, true],
    ["all", 0, 2, true],
    ["bought", 0, 0, false],
    ["bought", 0, 2, false],
    ["bought", 1, 0, true],
    ["bought", 2, 1, true],
    ["unbought", 0, 0, false],
    ["unbought", 0, 2, true],
    ["unbought", 1, 0, false],
    ["unbought", 2, 1, true],
  ] satisfies [StyleBuyFilter, number, number, boolean][])(
    "%s with %i bought and %i unbought SKUs returns %s",
    (filter, boughtSkus, unboughtSkus, expected) => {
      expect(matchesStyleBuyFilter(filter, { boughtSkus, unboughtSkus })).toBe(
        expected,
      );
    },
  );
});

describe("getMatchingStyleBuySkus", () => {
  const blackSupra: ActiveSku = {
    style: "CHELSEA",
    colour: "BLACK",
    leather: "SUPRA",
    is_new: true,
  };
  const mintSupra: ActiveSku = { ...blackSupra, colour: "MINT" };
  const purpleSupra: ActiveSku = { ...blackSupra, colour: "PURPLE" };
  const blackNappa: ActiveSku = {
    ...blackSupra,
    leather: "NAPPA",
    is_new: false,
  };
  const chelseaSkus = [blackSupra, mintSupra, purpleSupra, blackNappa];
  const chelseaQuantities: Readonly<
    Record<string, BuyMarketQuantities | undefined>
  > = {
    [skuKey(blackSupra)]: { totalAu: 0, totalUsa: 0, totalNyc: 0, totalLa: 0 },
    [skuKey(mintSupra)]: { totalAu: 8 },
    [skuKey(purpleSupra)]: { totalUsa: 6 },
    [skuKey(blackNappa)]: { totalAu: 0 },
  };

  it.each(["Has New SKUs", "All New"])(
    "includes CHELSEA BLACK SUPRA under unbought + %s despite bought new siblings",
    newness => {
      expect(
        getMatchingStyleBuySkus(
          chelseaSkus,
          chelseaQuantities,
          "unbought",
          newness,
        ),
      ).toEqual([blackSupra]);
      expect(
        getMatchingStyleBuySkus(
          chelseaSkus,
          chelseaQuantities,
          "bought",
          newness,
        ),
      ).toEqual([mintSupra, purpleSupra]);
    },
  );

  it("defaults newness to All and returns only individual matching buy quantities", () => {
    expect(
      getMatchingStyleBuySkus(chelseaSkus, chelseaQuantities, "unbought"),
    ).toEqual([blackSupra, blackNappa]);
    expect(
      getMatchingStyleBuySkus(chelseaSkus, chelseaQuantities, "bought"),
    ).toEqual([mintSupra, purpleSupra]);
  });

  it("No New SKUs includes false and missing is_new, excluding new SKUs", () => {
    const missingNewness = { ...astiBlack };
    const skus = [...chelseaSkus, missingNewness];

    expect(
      getMatchingStyleBuySkus(
        skus,
        chelseaQuantities,
        "unbought",
        "No New SKUs",
      ),
    ).toEqual([blackNappa, missingNewness]);
    expect(
      getMatchingStyleBuySkus(skus, chelseaQuantities, "bought", "No New SKUs"),
    ).toEqual([]);
  });

  it.each(["Has New SKUs", "All New"])(
    "does not combine a bought new SKU with an unrelated unbought existing sibling for %s",
    newness => {
      expect(
        getMatchingStyleBuySkus(
          [mintSupra, blackNappa],
          chelseaQuantities,
          "unbought",
          newness,
        ),
      ).toEqual([]);
    },
  );

  it("does not combine an unbought new SKU with a bought existing sibling", () => {
    const boughtExisting = { ...mintSupra, is_new: false };
    const skus = [blackSupra, boughtExisting];

    expect(
      getMatchingStyleBuySkus(skus, chelseaQuantities, "bought", "Has New SKUs"),
    ).toEqual([]);
    expect(
      getMatchingStyleBuySkus(skus, chelseaQuantities, "unbought", "No New SKUs"),
    ).toEqual([]);
    expect(
      getMatchingStyleBuySkus(skus, chelseaQuantities, "bought", "No New SKUs"),
    ).toEqual([boughtExisting]);
  });

  it.each(["All", "Has New SKUs", "All New", "No New SKUs"])(
    "leaves all input SKUs untouched for the all buy filter with %s",
    newness => {
      const skus = Object.freeze([...chelseaSkus, blackSupra]);
      const result = getMatchingStyleBuySkus(
        skus,
        chelseaQuantities,
        "all",
        newness,
      );

      expect(result).toEqual(skus);
      expect(result).toHaveLength(skus.length);
      result.forEach((sku, index) => expect(sku).toBe(skus[index]));
    },
  );

  it.each(["all", "bought", "unbought"] satisfies StyleBuyFilter[])(
    "returns an empty result for an empty active list under %s",
    filter => {
      expect(
        getMatchingStyleBuySkus([], chelseaQuantities, filter, "Has New SKUs"),
      ).toEqual([]);
    },
  );

  it.each(["totalAu", "totalUsa", "totalNyc", "totalLa"] as const)(
    "recognises a buy in %s without requiring any other market",
    field => {
      const quantities: Readonly<
        Record<string, BuyMarketQuantities | undefined>
      > = { [skuKey(blackSupra)]: { [field]: 5 } };

      expect(
        getMatchingStyleBuySkus([blackSupra], quantities, "bought", "All New"),
      ).toEqual([blackSupra]);
      expect(
        getMatchingStyleBuySkus([blackSupra], quantities, "unbought", "All New"),
      ).toEqual([]);
    },
  );

  it("uses the exact ordered Upper 2 colour and leather identity for each SKU", () => {
    const royal = {
      style: "ZOE",
      colour: "ECRU",
      leather: "SNAKE",
      colour2: "ROYAL",
      leather2: "SUEDE",
      is_new: true,
    };
    const lipstick = { ...royal, colour2: "LIPSTICK" };
    const royalNappa = { ...royal, leather2: "NAPPA" };
    const swappedUppers = {
      ...royal,
      colour: royal.colour2,
      leather: royal.leather2,
      colour2: royal.colour,
      leather2: royal.leather,
    };
    const skus = [royal, lipstick, royalNappa, swappedUppers];
    const quantities = { [skuKey(royal)]: { totalNyc: 4 } };

    expect(
      getMatchingStyleBuySkus(skus, quantities, "bought", "Has New SKUs"),
    ).toEqual([royal]);
    expect(
      getMatchingStyleBuySkus(skus, quantities, "unbought", "Has New SKUs"),
    ).toEqual([lipstick, royalNappa, swappedUppers]);
  });

  it("deduplicates normalised identities while preserving the first matching object and order", () => {
    const duplicateBlack = {
      ...blackSupra,
      style: " chelsea ",
      colour: " black ",
      leather: " supra ",
      colour2: null,
      leather2: " ",
    };
    const skus = Object.freeze([
      blackSupra,
      mintSupra,
      duplicateBlack,
      blackNappa,
      { ...blackNappa },
      purpleSupra,
      { ...mintSupra },
    ]);

    const unbought = getMatchingStyleBuySkus(skus, chelseaQuantities, "unbought");
    const bought = getMatchingStyleBuySkus(skus, chelseaQuantities, "bought");
    expect(unbought).toEqual([blackSupra, blackNappa]);
    expect(unbought[0]).toBe(blackSupra);
    expect(unbought[1]).toBe(blackNappa);
    expect(bought).toEqual([mintSupra, purpleSupra]);
    expect(bought[0]).toBe(mintSupra);
    expect(bought[1]).toBe(purpleSupra);
    expect(skus).toHaveLength(7);
  });

  it("treats absent, undefined, empty, invalid and nonpositive totals as unbought", () => {
    const skus = ["ABSENT", "UNDEFINED", "EMPTY", "INVALID", "ZERO", "NEGATIVE"].map(
      colour => ({ ...blackSupra, colour }),
    );
    const quantities: Readonly<
      Record<string, BuyMarketQuantities | undefined>
    > = {
      [skuKey(skus[1])]: undefined,
      [skuKey(skus[2])]: {},
      [skuKey(skus[3])]: {
        totalAu: null,
        totalUsa: Number.NaN,
        totalNyc: Number.POSITIVE_INFINITY,
        totalLa: Number.NEGATIVE_INFINITY,
      },
      [skuKey(skus[4])]: { totalAu: 5, totalUsa: -5 },
      [skuKey(skus[5])]: { totalLa: -2 },
    };

    expect(
      getMatchingStyleBuySkus(skus, quantities, "unbought", "Has New SKUs"),
    ).toEqual(skus);
    expect(
      getMatchingStyleBuySkus(skus, quantities, "bought", "Has New SKUs"),
    ).toEqual([]);
  });

  it("ignores quantities for historical or cancelled SKUs outside the active input", () => {
    const cancelled = { ...blackSupra, colour: "CANCELLED" };
    const quantities = { [skuKey(cancelled)]: { totalLa: 20 } };

    expect(
      getMatchingStyleBuySkus([blackSupra], quantities, "bought", "Has New SKUs"),
    ).toEqual([]);
    expect(
      getMatchingStyleBuySkus([blackSupra], quantities, "unbought", "Has New SKUs"),
    ).toEqual([blackSupra]);
  });
});
