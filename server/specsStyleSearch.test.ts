import { describe, expect, it } from "vitest";
import { matchesSpecsStyleSearch } from "@shared/specsStyleSearch";

const petalNappaStyle = {
  style: "AVANTI",
  last: "AVANTI",
  category: "Dress Shoe",
  colourLabels: ["BLACK NAPPA", "PETAL NAPPA"],
};

describe("Specs style search", () => {
  it("finds every style whose Upper 1 colour/leather matches the query", () => {
    expect(matchesSpecsStyleSearch(petalNappaStyle, "petal nappa")).toBe(true);
    expect(matchesSpecsStyleSearch(petalNappaStyle, "  PETAL   NAPPA ")).toBe(true);
  });

  it("does not match a colour/leather that only appears as Upper 2", () => {
    expect(matchesSpecsStyleSearch({
      style: "ROBYN",
      last: "ROBYN",
      category: "Dress Shoe",
      colourLabels: ["ECRU SNAKE/PETAL NAPPA"],
    }, "PETAL NAPPA")).toBe(false);
  });

  it("retains style, last and category matching", () => {
    expect(matchesSpecsStyleSearch(petalNappaStyle, "avanti")).toBe(true);
    expect(matchesSpecsStyleSearch(petalNappaStyle, "dress shoe")).toBe(true);
    expect(matchesSpecsStyleSearch(petalNappaStyle, "choc suede")).toBe(false);
  });
});
