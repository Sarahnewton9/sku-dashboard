import { describe, expect, it } from "vitest";
import { buildSampleReceiptLookup, buildSampleReceiptWorklist, resolveSampleReceiptStatus } from "../shared/sampleReceiptTracking";

const single = { style: "RORY", colour: "VANILLA", leather: "NAPPA", is_new: true };

describe("sample receipt worklists", () => {
  it("retains existing receipt evidence despite default waiting duplicates, regardless of row order", () => {
    const rows = [{ ...single, colour2: null, leather2: null, sampleStatus: "received" },
      { ...single, colour2: "", leather2: "", sampleStatus: "waiting" }];
    for (const order of [rows, [...rows].reverse()]) {
      const result = buildSampleReceiptWorklist([single], order);
      expect(result.counts).toEqual({ total: 1, received: 1, waiting: 0 });
      expect(result.receivedSkus[0].status).toBe("received");
    }
  });

  it("counts fitting samples as received and includes each physical SKU only once", () => {
    const result = buildSampleReceiptWorklist([single, single], [{ ...single, sampleStatus: "fitting_sample" }]);
    expect(result.counts).toEqual({ total: 1, received: 1, waiting: 0 });
    expect(result.receivedSkus[0].status).toBe("fitting_sample");
  });

  it("never borrows receipt status from a different Upper 2 or a legacy single-upper row", () => {
    const upper1 = { style: "ROBYN", colour: "ECRU", leather: "SNAKE" };
    const royal = { ...upper1, colour2: "ROYAL", leather2: "SUEDE", is_new: true };
    const lipstick = { ...upper1, colour2: "LIPSTICK", leather2: "SUEDE", is_new: true };
    const result = buildSampleReceiptWorklist([royal, lipstick], [
      { ...upper1, sampleStatus: "received" }, { ...royal, sampleStatus: "received" },
    ]);
    expect(result.counts).toEqual({ total: 2, received: 1, waiting: 1 });
    expect(result.waitingSkus[0].sku.colour2).toBe("LIPSTICK");
  });

  it("resolves renamed static SKUs using their saved source identity", () => {
    const result = buildSampleReceiptWorklist([
      { ...single, colour: "PETAL", _sourceColour: "VANILLA", _sourceLeather: "NAPPA" },
    ], [{ ...single, sampleStatus: "received" }]);
    expect(result.counts.received).toBe(1);
    expect(result.receivedSkus[0].label).toContain("PETAL NAPPA");
    expect(result.receivedSkus[0].identity.colour).toBe("VANILLA");
  });

  it("retains a legacy received marker for the only active two-upper construction", () => {
    const primary = { style: "EMILY", colour: "BLACK", leather: "VINTAGE" };
    const sku = { ...primary, colour2: "BLACK", leather2: "SUEDE", is_new: true };
    const result = buildSampleReceiptWorklist([sku], [{ ...primary, sampleStatus: "received" }]);
    expect(result.counts.received).toBe(1);
    expect(result.receivedSkus[0].identity.colour2).toBe("BLACK");
    const reset = buildSampleReceiptWorklist([sku], [
      { ...primary, sampleStatus: "received" }, { ...sku, sampleStatus: "waiting" },
    ]);
    expect(reset.counts.waiting).toBe(1);
  });

  it("supports explicit resets after every duplicate is saved as waiting", () => {
    const lookup = buildSampleReceiptLookup([
      { ...single, sampleStatus: "waiting" }, { ...single, colour2: "", leather2: "", sampleStatus: "waiting" },
    ]);
    expect(resolveSampleReceiptStatus(lookup, single)).toBe("waiting");
  });

  it("excludes carry-over and cancelled styles; counts agree exactly with displayed lists", () => {
    const result = buildSampleReceiptWorklist([
      single, { ...single, style: "CORE", is_new: false }, { ...single, style: "CANCELLED" },
      { ...single, style: "AVAR" },
    ], [], new Set(["CANCELLED"]));
    expect(result.counts).toEqual({ total: 2, received: 0, waiting: 2 });
    expect(result.counts.total).toBe(result.receivedSkus.length + result.waitingSkus.length);
    expect(result.waitingSkus.map((row) => row.sku.style)).toEqual(["AVAR", "RORY"]);
  });

  it("normalises case and whitespace without conflating Upper 2 identities", () => {
    const lookup = buildSampleReceiptLookup([{ style: "  rory ", colour: " vanilla ", leather: "nappa", sampleStatus: "received" }]);
    expect(resolveSampleReceiptStatus(lookup, single)).toBe("received");
  });
});
