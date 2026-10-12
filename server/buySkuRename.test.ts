import { describe, expect, it } from "vitest";
import { getCustomSkuBuyRename, getStaticSkuBuyRename, mergeRenamedBuySessionQuantities } from "@shared/buySkuRename";

describe("Buy SKU rename planning", () => {
  it("moves bought quantities from a static SKU's prior Upper 1 override to the new Upper 1", () => {
    expect(getStaticSkuBuyRename({
      style: "ENVY",
      colour: "BLOSSOM",
      leather: "NAPPA",
      colourOverride: "PETAL",
      leatherOverride: "NAPPA",
    }, {
      colourOverride: "BLOSSOM",
      leatherOverride: "NAPPA",
    })).toEqual({
      previous: { style: "ENVY", colour: "BLOSSOM", leather: "NAPPA", colour2: "", leather2: "" },
      next: { style: "ENVY", colour: "PETAL", leather: "NAPPA", colour2: "", leather2: "" },
    });
  });

  it("preserves an Upper 2 identity while changing Upper 1", () => {
    expect(getStaticSkuBuyRename({
      style: "ROBYN",
      colour: "BLOSSOM",
      leather: "SUEDE",
      colourOverride: "PETAL",
      leatherOverride: "NAPPA",
    }, {
      colourOverride: "BLOSSOM",
      leatherOverride: "SUEDE",
      colour2: "LIPSTICK",
      leather2: "SUEDE",
    })).toEqual({
      previous: { style: "ROBYN", colour: "BLOSSOM", leather: "SUEDE", colour2: "LIPSTICK", leather2: "SUEDE" },
      next: { style: "ROBYN", colour: "PETAL", leather: "NAPPA", colour2: "LIPSTICK", leather2: "SUEDE" },
    });
  });

  it("does not re-key Buy Sessions for a non-identity metadata edit", () => {
    expect(getStaticSkuBuyRename({
      style: "ENVY",
      colour: "BLOSSOM",
      leather: "NAPPA",
      sampleStatus: "received",
    } as any, null)).toBeNull();
  });

  it("plans custom colourway renames with Upper 2 preserved", () => {
    expect(getCustomSkuBuyRename(
      { style: "MACK", colour: "BLOSSOM", leather: "NAPPA", colour2: "LIPSTICK", leather2: "SUEDE" },
      { style: "MACK", colour: "PETAL", leather: "NAPPA", colour2: "LIPSTICK", leather2: "SUEDE" },
    )).toEqual({
      previous: { style: "MACK", colour: "BLOSSOM", leather: "NAPPA", colour2: "LIPSTICK", leather2: "SUEDE" },
      next: { style: "MACK", colour: "PETAL", leather: "NAPPA", colour2: "LIPSTICK", leather2: "SUEDE" },
    });
  });

  it("merges quantities rather than overwriting them when the renamed identity already exists", () => {
    expect(mergeRenamedBuySessionQuantities(
      { qty: 60, auQty: 0, usaQty: 25, nycQty: 0, laQty: 5 },
      { auQty: 40, usaQty: 10, nycQty: 15, laQty: 0 },
    )).toEqual({ auQty: 100, usaQty: 35, nycQty: 15, laQty: 5, qty: 155 });
  });
});
