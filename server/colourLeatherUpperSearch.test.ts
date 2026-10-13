import { describe, expect, it } from "vitest";
import { matchesColourLeatherUpperSearch } from "@shared/colourLeatherUpperSearch";

const ecruLipstick = {
  upper1Label: "ECRU SNAKE",
  upper2Label: "LIPSTICK SUEDE",
};

describe("Colour Leather Upper search", () => {
  it("matches an Upper 1 filter", () => {
    expect(matchesColourLeatherUpperSearch(ecruLipstick, { upper1Query: "ecru snake" })).toBe(true);
    expect(matchesColourLeatherUpperSearch(ecruLipstick, { upper1Query: "black vintage" })).toBe(false);
  });

  it("matches an Upper 2 filter independently", () => {
    expect(matchesColourLeatherUpperSearch(ecruLipstick, { upper2Query: "lipstick suede" })).toBe(true);
    expect(matchesColourLeatherUpperSearch(ecruLipstick, { upper2Query: "royal suede" })).toBe(false);
  });

  it("requires combined Upper 1 and Upper 2 filters on the same physical SKU", () => {
    expect(matchesColourLeatherUpperSearch(ecruLipstick, {
      upper1Query: "ECRU SNAKE",
      upper2Query: "LIPSTICK SUEDE",
    })).toBe(true);
    expect(matchesColourLeatherUpperSearch(ecruLipstick, {
      upper1Query: "ECRU SNAKE",
      upper2Query: "ROYAL SUEDE",
    })).toBe(false);
  });

  it("accepts a compact Upper 1/Upper 2 lookup", () => {
    expect(matchesColourLeatherUpperSearch(ecruLipstick, {
      upper1Query: "  ECRU   SNAKE / LIPSTICK SUEDE ",
    })).toBe(true);
  });

  it("does not treat a missing Upper 2 as a match", () => {
    expect(matchesColourLeatherUpperSearch({ upper1Label: "BLACK NAPPA" }, {
      upper2Query: "LIPSTICK SUEDE",
    })).toBe(false);
  });
});
