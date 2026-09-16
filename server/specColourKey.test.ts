import { describe, expect, it } from "vitest";
import {
  buildSpecColourKeyLookup,
  getSpecSkuIdentity,
  normalizeStoredSpecColourKey,
  readSpecColourValue,
} from "../shared/specColourKey";

describe("normalized Specs colour keys", () => {
  it("keeps one column for a colour with one leather and splits it when leathers differ", () => {
    const keys = buildSpecColourKeyLookup([
      { style: "tammy", colour: " black ", leather: "mesh" },
      { style: "tammy", colour: "petal", leather: "mesh" },
      { style: "tilda", colour: "black", leather: "speckle" },
      { style: "TILDA", colour: "BLACK", leather: "crinkle" },
    ]);

    expect(keys.get(getSpecSkuIdentity("TAMMY", "BLACK", "MESH"))).toBe("BLACK");
    expect(keys.get(getSpecSkuIdentity("TILDA", "BLACK", "SPECKLE"))).toBe("BLACK SPECKLE");
    expect(keys.get(getSpecSkuIdentity("TILDA", "BLACK", "CRINKLE"))).toBe("BLACK CRINKLE");
  });

  it("reads current and legacy per-colour values despite casing and spacing differences", () => {
    expect(readSpecColourValue({ "black  speckle": "MATCHING" }, "BLACK SPECKLE")).toBe("MATCHING");
    expect(readSpecColourValue({ BLACK: "LEGACY" }, "BLACK SPECKLE", "BLACK")).toBe("LEGACY");
  });

  it("normalizes persisted keys but preserves the shared custom-row key", () => {
    expect(normalizeStoredSpecColourKey("  black   mesh ")).toBe("BLACK MESH");
    expect(normalizeStoredSpecColourKey("__ALL__")).toBe("__all__");
  });
});
