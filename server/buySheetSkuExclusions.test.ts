import { describe, expect, it } from "vitest";
import {
  getCancelledBuySheetSkuKey,
  isActiveBuySheetSessionItem,
} from "@shared/buySheetSkuExclusions";
import { getExactCancelledSkuKey } from "@shared/cancelledSkuIdentity";
import { buildMarkdownSkuSet } from "@shared/markdownSku";

describe("Buy Sheet SKU exclusions", () => {
  const noCancelledStyles = new Set<string>();
  const noCancelledSkus = new Set<string>();

  it("excludes a deleted/cancelled SKU even when its session quantity remains", () => {
    const cancelledSkuKeys = new Set([
      getCancelledBuySheetSkuKey("MACK", "BLACK", "NAPPA"),
    ]);

    expect(isActiveBuySheetSessionItem(
      { style: "MACK", colour: "BLACK", leather: "NAPPA" },
      { cancelledStyleNames: noCancelledStyles, cancelledSkuKeys },
    )).toBe(false);
  });

  it("keeps a valid historical purchase even when its SKU is no longer in the current range", () => {
    expect(isActiveBuySheetSessionItem(
      { style: "MACK", colour: "TAN", leather: "NAPPA" },
      { cancelledStyleNames: noCancelledStyles, cancelledSkuKeys: noCancelledSkus },
    )).toBe(true);
  });

  it("keeps distinct historical dual-upper SKU identities eligible", () => {
    expect(isActiveBuySheetSessionItem(
      { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "LIPSTICK", leather2: "SUEDE" },
      { cancelledStyleNames: noCancelledStyles, cancelledSkuKeys: noCancelledSkus },
    )).toBe(true);

    expect(isActiveBuySheetSessionItem(
      { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" },
      { cancelledStyleNames: noCancelledStyles, cancelledSkuKeys: noCancelledSkus },
    )).toBe(true);
  });

  it("excludes only a cancelled Upper 2 construction", () => {
    const cancelledSkuKeys = new Set([
      getExactCancelledSkuKey({
        style: "ELECTRIC", colour: "BLACK", leather: "NYLON", colour2: "ECRU", leather2: "SNAKE",
      }),
    ]);

    expect(isActiveBuySheetSessionItem(
      { style: "ELECTRIC", colour: "BLACK", leather: "NYLON", colour2: "ECRU", leather2: "SNAKE" },
      { cancelledStyleNames: noCancelledStyles, cancelledSkuKeys },
    )).toBe(false);
    expect(isActiveBuySheetSessionItem(
      { style: "ELECTRIC", colour: "BLACK", leather: "NYLON", colour2: "BLACK", leather2: "NAPPA" },
      { cancelledStyleNames: noCancelledStyles, cancelledSkuKeys },
    )).toBe(true);
  });

  it("keeps a historical SKU eligible after its display colour was corrected", () => {
    expect(isActiveBuySheetSessionItem(
      { style: "MOMA", colour: "BURGUNDY", leather: "CRINKLE" },
      { cancelledStyleNames: noCancelledStyles, cancelledSkuKeys: noCancelledSkus },
    )).toBe(true);
  });

  it("excludes a deleted markdown SKU even when a historical quantity remains", () => {
    const markdownSkuSet = buildMarkdownSkuSet([
      { styleCode: "MACK", colour: "TAN NAPPA", status: "deleted" },
    ]);
    expect(isActiveBuySheetSessionItem(
      { style: "MACK", colour: "TAN", leather: "NAPPA" },
      { cancelledStyleNames: noCancelledStyles, cancelledSkuKeys: noCancelledSkus, markdownSkuSet },
    )).toBe(false);
  });
});
