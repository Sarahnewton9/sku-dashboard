import { describe, expect, it } from "vitest";
import {
  buildSpecColourKeyLookup,
  findSpecColourMapValue,
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

  it("keeps duplicate Upper 1 combinations separate when Upper 2 differs", () => {
    const keys = buildSpecColourKeyLookup([
      { style: "EMILY", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" },
      { style: "EMILY", colour: "ECRU", leather: "SNAKE", colour2: "LIPSTICK", leather2: "SUEDE" },
    ]);

    expect(keys.get(getSpecSkuIdentity("EMILY", "ECRU", "SNAKE", "ROYAL", "SUEDE")))
      .toBe("ECRU SNAKE/ROYAL SUEDE");
    expect(keys.get(getSpecSkuIdentity("EMILY", "ECRU", "SNAKE", "LIPSTICK", "SUEDE")))
      .toBe("ECRU SNAKE/LIPSTICK SUEDE");
  });

  it("reads current and legacy per-colour values despite casing and spacing differences", () => {
    expect(readSpecColourValue({ "black  speckle": "MATCHING" }, "BLACK SPECKLE")).toBe("MATCHING");
    expect(readSpecColourValue({ BLACK: "LEGACY" }, "BLACK SPECKLE", "BLACK")).toBe("LEGACY");
  });

  it("keeps an exact saved blank instead of falling back to a raw colour value", () => {
    expect(readSpecColourValue({ "BLACK SPECKLE": "", BLACK: "STALE RAW" }, "BLACK SPECKLE", "BLACK"))
      .toBe("");
    expect(readSpecColourValue({ " black  speckle ": "", BLACK: "STALE RAW" }, "BLACK SPECKLE", "BLACK"))
      .toBe("");
  });

  it("keeps an exact saved blank instead of allowing a shared custom-row fallback", () => {
    const values = { "BLACK SPECKLE": "", __all__: "STALE SHARED" };
    const result = readSpecColourValue(values, "BLACK SPECKLE", "BLACK");
    expect(result).toBe("");
    expect(result ?? values.__all__).toBe("");
  });

  it("keeps a blank full Upper 2 key ahead of primary, raw and shared values", () => {
    const values = {
      "ECRU SNAKE/ROYAL SUEDE": "",
      "ECRU SNAKE": "STALE PRIMARY",
      ECRU: "STALE RAW",
      __all__: "STALE SHARED",
    };
    expect(readSpecColourValue(values, "ECRU SNAKE/ROYAL SUEDE", "ECRU") ?? values.__all__).toBe("");
  });

  it("still permits a shared fallback when no current or legacy colour is saved", () => {
    const values = { __all__: "SHARED" };
    expect(readSpecColourValue(values, "BLACK SPECKLE", "BLACK")).toBeUndefined();
    expect(readSpecColourValue(values, "BLACK SPECKLE", "BLACK") ?? values.__all__).toBe("SHARED");
  });

  it("normalizes persisted keys but preserves the shared custom-row key", () => {
    expect(normalizeStoredSpecColourKey("  black   mesh ")).toBe("BLACK MESH");
    expect(normalizeStoredSpecColourKey("__ALL__")).toBe("__all__");
  });

  it("reads custom-row map values through normalized current and legacy keys", () => {
    const currentRows = new Map([["Blush Nubuck", { value: "matching" }]]);
    const legacyRows = new Map([["Blush", { value: "matching" }]]);
    expect(findSpecColourMapValue(currentRows, "BLUSH NUBUCK")?.value).toBe("matching");
    expect(findSpecColourMapValue(legacyRows, "BLUSH CAPRETTO", "BLUSH")?.value).toBe("matching");
  });
});
