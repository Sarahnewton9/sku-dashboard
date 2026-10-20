import { describe, expect, it } from "vitest";
import { buildSkuMetaLookup, resolveSkuMeta } from "../shared/skuMetaIdentity";

describe("SKU metadata identity lookup", () => {
  const rows = [
    { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "LIPSTICK", leather2: "SUEDE", sampleStatus: "waiting" },
    { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE", sampleStatus: "received" },
  ];

  it("resolves sample status by the complete Upper 1 and Upper 2 identity", () => {
    const lookup = buildSkuMetaLookup(rows);

    expect(resolveSkuMeta(lookup, {
      style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE",
    })?.sampleStatus).toBe("received");
    expect(resolveSkuMeta(lookup, {
      style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "LIPSTICK", leather2: "SUEDE",
    })?.sampleStatus).toBe("waiting");
  });

  it("retains primary-upper fallback for legacy single-upper metadata", () => {
    const lookup = buildSkuMetaLookup([
      { style: "VIVID", colour: "CLOUD", leather: "NAPPA", sampleStatus: "received" },
    ]);
    expect(resolveSkuMeta(lookup, {
      style: "VIVID", colour: "CLOUD", leather: "NAPPA",
    })?.sampleStatus).toBe("received");
  });
});
