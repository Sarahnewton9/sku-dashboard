import { describe, expect, it } from "vitest";
import { buildSkuCoreLookup, isCoreSku, matchesSkuRangeStatus, type CoreSkuMetaRow, type SkuRangeStatus } from "../shared/skuCore";

const single = { style: "RORY", colour: "VANILLA", leather: "NAPPA" };
const primary = { style: "ROBYN", colour: "ECRU", leather: "SNAKE" };
const royal = { ...primary, colour2: "ROYAL", leather2: "SUEDE" };
const lipstick = { ...primary, colour2: "LIPSTICK", leather2: "SUEDE" };

describe("strict CORE metadata identity", () => {
  it("requires explicit true; false, unset and absent metadata remain non-core", () => {
    for (const rows of [[], [{ ...single, isCore: false }], [{ ...single }], [{ ...single, isCore: null }]]) {
      expect(isCoreSku(buildSkuCoreLookup(rows), single)).toBe(false);
    }
    expect(isCoreSku(buildSkuCoreLookup([{ ...single, isCore: true }]), single)).toBe(true);
  });

  it("does not infer core from carryover or a truthy non-boolean field", () => {
    const rows = [{ ...single, isCore: "true" }] as unknown as CoreSkuMetaRow[];
    expect(isCoreSku(buildSkuCoreLookup(rows), { ...single })).toBe(false);
    expect(isCoreSku(buildSkuCoreLookup([]), single)).toBe(false);
  });

  it("never leaks a supplied single-upper CORE identity to Upper 2, even the only variant", () => {
    const lookup = buildSkuCoreLookup([{ ...primary, isCore: true }]);
    expect(isCoreSku(lookup, primary)).toBe(true);
    expect(isCoreSku(lookup, royal)).toBe(false);
    expect(isCoreSku(lookup, lipstick)).toBe(false);
  });

  it("keeps both ordered secondary fields exact", () => {
    const lookup = buildSkuCoreLookup([{ ...royal, isCore: true }]);
    expect(isCoreSku(lookup, royal)).toBe(true);
    expect(isCoreSku(lookup, lipstick)).toBe(false);
    expect(isCoreSku(lookup, { ...royal, leather2: "NAPPA" })).toBe(false);
    expect(isCoreSku(lookup, primary)).toBe(false);
    expect(isCoreSku(lookup, { style: royal.style, colour: royal.colour2, leather: royal.leather2, colour2: royal.colour, leather2: royal.leather })).toBe(false);
  });

  it("normalises case/whitespace and treats absent, NULL and blank Upper 2 as exact copies", () => {
    const lookup = buildSkuCoreLookup([{ style: " rory ", colour: " vanilla ", leather: " nappa ", colour2: null, leather2: " ", isCore: true }]);
    expect(isCoreSku(lookup, single)).toBe(true);
    expect(isCoreSku(lookup, { ...single, colour2: "", leather2: null })).toBe(true);
    expect(isCoreSku(buildSkuCoreLookup([{ ...single, leather: "METALLIC  NAPPA", isCore: true }]), { ...single, leather: " metallic nappa " })).toBe(true);
  });

  it("resolves display-corrected static colour and leather through their source key", () => {
    const lookup = buildSkuCoreLookup([{ ...single, isCore: true }]);
    expect(isCoreSku(lookup, { ...single, colour: "PETAL", leather: "SUEDE", _sourceColour: "VANILLA", _sourceLeather: "NAPPA" })).toBe(true);
    expect(isCoreSku(lookup, { ...single, colour: "PETAL", leather: "SUEDE" })).toBe(false);
  });

  it("supports an exact corrected display metadata key when the source row is absent", () => {
    const displayed = { ...single, colour: "PETAL", leather: "SUEDE" };
    const lookup = buildSkuCoreLookup([{ ...displayed, isCore: true }]);
    expect(isCoreSku(lookup, { ...displayed, _sourceColour: "VANILLA", _sourceLeather: "NAPPA" })).toBe(true);
  });

  it("exposes corrected aliases without requiring source annotations and still retains Upper 2", () => {
    const lookup = buildSkuCoreLookup([{ ...royal, colourOverride: "PEARL", leatherOverride: "CROC", isCore: true }]);
    expect(isCoreSku(lookup, { ...royal, colour: "PEARL", leather: "CROC" })).toBe(true);
    expect(isCoreSku(lookup, { ...lipstick, colour: "PEARL", leather: "CROC" })).toBe(false);
  });

  it("never overrides an explicit non-core source using another display identity's flag", () => {
    const displayed = { ...single, colour: "PETAL" };
    for (const isCore of [false, undefined]) {
      const lookup = buildSkuCoreLookup([{ ...single, isCore }, { ...displayed, isCore: true }]);
      expect(isCoreSku(lookup, { ...displayed, _sourceColour: "VANILLA" })).toBe(false);
    }
  });

  it("resolves duplicate disagreements conservatively and independently of order", () => {
    for (const other of [false, undefined, null]) {
      const rows = [{ ...single, colour2: null, leather2: null, colourOverride: "PETAL", isCore: true },
        { ...single, colour2: "", leather2: "", colourOverride: "PETAL", isCore: other }];
      for (const order of [rows, [...rows].reverse()]) {
        const lookup = buildSkuCoreLookup(order);
        expect(isCoreSku(lookup, single)).toBe(false);
        expect(isCoreSku(lookup, { ...single, colour: "PETAL" })).toBe(false);
      }
    }
    expect(isCoreSku(buildSkuCoreLookup([{ ...single, isCore: true }, { ...single, colour2: null, isCore: true }]), single)).toBe(true);
  });

  it("does not change a CORE construction because a sibling is false", () => {
    const lookup = buildSkuCoreLookup([{ ...royal, isCore: true }, { ...lipstick, isCore: false }]);
    expect(isCoreSku(lookup, royal)).toBe(true);
    expect(isCoreSku(lookup, lipstick)).toBe(false);
  });
});

describe("mutually exclusive SKU range status", () => {
  const statuses: SkuRangeStatus[] = ["all", "core", "carryover", "new"];
  it.each([
    [{ is_core: true, is_new: true }, [true, true, false, false]],
    [{ is_core: true, is_new: false }, [true, true, false, false]],
    [{ is_core: false, is_new: true }, [true, false, false, true]],
    [{ is_core: false, is_new: false }, [true, false, true, false]],
    [{ is_new: false }, [true, false, true, false]],
    [{}, [true, false, true, false]],
  ])("classifies %j with CORE first", (sku, expected) => {
    expect(statuses.map(status => matchesSkuRangeStatus(sku, status))).toEqual(expected);
  });
});
