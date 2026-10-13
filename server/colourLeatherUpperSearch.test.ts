import { describe, expect, it } from "vitest";
import { matchesColourLeatherUpperSearch } from "@shared/colourLeatherUpperSearch";

const ecruLipstick = {
  upper1Label: "ECRU SNAKE",
  upper2Label: "LIPSTICK SUEDE",
};

describe("Colour Leather upper search", () => {
  it("matches a term in Upper 1", () => {
    expect(matchesColourLeatherUpperSearch(ecruLipstick, "ecru snake")).toBe(true);
    expect(matchesColourLeatherUpperSearch(ecruLipstick, "black vintage")).toBe(false);
  });

  it("matches a term in Upper 2", () => {
    expect(matchesColourLeatherUpperSearch(ecruLipstick, "lipstick suede")).toBe(true);
    expect(matchesColourLeatherUpperSearch(ecruLipstick, "royal suede")).toBe(false);
  });

  it("returns a physical SKU when the term is in either ordered upper", () => {
    const labels = [
      { upper1Label: "ECRU SNAKE", upper2Label: "ROYAL SUEDE" },
      { upper1Label: "BLACK VINTAGE", upper2Label: "LIPSTICK SUEDE" },
    ];

    expect(labels.filter((sku) => matchesColourLeatherUpperSearch(sku, "ECRU SNAKE"))).toHaveLength(1);
    expect(labels.filter((sku) => matchesColourLeatherUpperSearch(sku, "LIPSTICK SUEDE"))).toHaveLength(1);
  });

  it("normalizes case and spacing", () => {
    expect(matchesColourLeatherUpperSearch(ecruLipstick, "  LIPSTICK   SUEDE  ")).toBe(true);
  });

  it("does not match a missing Upper 2", () => {
    expect(matchesColourLeatherUpperSearch({ upper1Label: "BLACK NAPPA" }, "LIPSTICK SUEDE")).toBe(false);
  });
});
