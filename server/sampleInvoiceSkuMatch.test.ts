import { describe, expect, it } from "vitest";
import { matchSampleInvoiceSku } from "@shared/sampleInvoiceSkuMatch";

const liveW27Skus = [
  { style: "ESSA", colour: "CHOCOLATE", leather: "NAPPA" },
  { style: "ESSA", colour: "VINO", leather: "NAPPA" },
  { style: "JERZY", colour: "BLACK", leather: "SUEDE" },
  { style: "JERZY", colour: "ROYAL", leather: "SUEDE" },
  { style: "JERZY", colour: "BLOSSOM", leather: "SUEDE" },
  { style: "JERZY", colour: "STONE", leather: "SUEDE" },
  { style: "JERZY", colour: "MIDNIGHT", leather: "SUEDE" },
  { style: "LUCKY", colour: "CHOCOLATE", leather: "NAPPA" },
  { style: "LUCKY", colour: "VANILLA", leather: "NAPPA" },
  { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" },
];

describe("sample invoice SKU matching", () => {
  it.each([
    ["ESSA", "CHOCOLATE NAPPA", "ESSA", "CHOCOLATE", "NAPPA"],
    ["ESSA", "VINO NAPPA", "ESSA", "VINO", "NAPPA"],
    ["JERZY", "BLACK SUEDE", "JERZY", "BLACK", "SUEDE"],
    ["JERZY", "ROYAL SUEDE", "JERZY", "ROYAL", "SUEDE"],
    ["JERZY", "BLOSSOM SUEDE", "JERZY", "BLOSSOM", "SUEDE"],
    ["JERZY", "STONE SUEDE", "JERZY", "STONE", "SUEDE"],
    ["JERZY", "MIDNIGHT SUEDE", "JERZY", "MIDNIGHT", "SUEDE"],
    ["LUCKY", "CHOCOLATE NAPPA", "LUCKY", "CHOCOLATE", "NAPPA"],
    ["LUCKY", "VANILLA NAPPA", "LUCKY", "VANILLA", "NAPPA"],
  ])("matches current range SKU %s %s", (style, colour, expectedStyle, expectedColour, expectedLeather) => {
    const result = matchSampleInvoiceSku({ style, colour }, liveW27Skus);
    expect(result.confidence).toBe(100);
    expect(result.matchedSku).toMatchObject({
      style: expectedStyle,
      colour: expectedColour,
      leather: expectedLeather,
    });
  });

  it("matches a complete dual-upper invoice colourway without selecting a sibling", () => {
    const result = matchSampleInvoiceSku({ style: "ROBYN", colour: "ECRU SNAKE / ROYAL SUEDE" }, liveW27Skus);
    expect(result.matchedSku).toMatchObject({
      style: "ROBYN",
      colour: "ECRU",
      leather: "SNAKE",
      colour2: "ROYAL",
      leather2: "SUEDE",
    });
  });

  it("does not match a style that is absent from the live range", () => {
    const result = matchSampleInvoiceSku({ style: "UNKNOWN", colour: "BLACK SUEDE" }, liveW27Skus);
    expect(result.matchedSku).toBeNull();
    expect(result.confidence).toBe(0);
  });
});
