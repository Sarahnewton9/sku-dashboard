import { describe, expect, it } from "vitest";
import {
  buildActiveBuySheetSkuIdentitySet,
  getCancelledBuySheetSkuKey,
  isActiveBuySheetSessionItem,
} from "@shared/buySheetSkuExclusions";

describe("Buy Sheet SKU exclusions", () => {
  const activeSkuIdentities = buildActiveBuySheetSkuIdentitySet([
    { style: "MACK", colour: "BLACK", leather: "NAPPA" },
    { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "LIPSTICK", leather2: "SUEDE" },
    {
      style: "MOMA",
      colour: "VINO",
      leather: "CRINKLE",
      _sourceColour: "BURGUNDY",
      _sourceLeather: "CRINKLE",
    },
  ]);

  const noCancelledStyles = new Set<string>();
  const noCancelledSkus = new Set<string>();

  it("excludes a deleted/cancelled SKU even when its session quantity remains", () => {
    const cancelledSkuKeys = new Set([
      getCancelledBuySheetSkuKey("MACK", "BLACK", "NAPPA"),
    ]);

    expect(isActiveBuySheetSessionItem(
      { style: "MACK", colour: "BLACK", leather: "NAPPA" },
      { activeSkuIdentities, cancelledStyleNames: noCancelledStyles, cancelledSkuKeys },
    )).toBe(false);
  });

  it("excludes a quantity for any SKU no longer in the active range", () => {
    expect(isActiveBuySheetSessionItem(
      { style: "MACK", colour: "TAN", leather: "NAPPA" },
      { activeSkuIdentities, cancelledStyleNames: noCancelledStyles, cancelledSkuKeys: noCancelledSkus },
    )).toBe(false);
  });

  it("keeps distinct active dual-upper SKU identities eligible", () => {
    expect(isActiveBuySheetSessionItem(
      { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "LIPSTICK", leather2: "SUEDE" },
      { activeSkuIdentities, cancelledStyleNames: noCancelledStyles, cancelledSkuKeys: noCancelledSkus },
    )).toBe(true);

    expect(isActiveBuySheetSessionItem(
      { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" },
      { activeSkuIdentities, cancelledStyleNames: noCancelledStyles, cancelledSkuKeys: noCancelledSkus },
    )).toBe(false);
  });

  it("keeps an active SKU eligible after its display colour was corrected", () => {
    expect(isActiveBuySheetSessionItem(
      { style: "MOMA", colour: "BURGUNDY", leather: "CRINKLE" },
      { activeSkuIdentities, cancelledStyleNames: noCancelledStyles, cancelledSkuKeys: noCancelledSkus },
    )).toBe(true);
  });
});
