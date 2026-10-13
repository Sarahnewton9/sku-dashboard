import { describe, expect, it } from "vitest";
import { matchesSpecsStyleSearch, matchesSpecsStyleSearchFilters } from "@shared/specsStyleSearch";

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

  it("finds a style from Upper 2 alone", () => {
    const dualUpperStyle = {
      style: "ROBYN",
      last: "ROBYN",
      category: "Dress Shoe",
      colourLabels: ["ECRU SNAKE/ROYAL SUEDE", "ECRU SNAKE/LIPSTICK SUEDE"],
    };

    expect(matchesSpecsStyleSearchFilters(dualUpperStyle, { upper2Query: "lipstick suede" })).toBe(true);
    expect(matchesSpecsStyleSearchFilters(dualUpperStyle, { upper2Query: "petal nappa" })).toBe(false);
  });

  it("requires Upper 1 and Upper 2 filters to match the same physical SKU", () => {
    const splitUpperStyle = {
      style: "ROBYN",
      last: "ROBYN",
      category: "Dress Shoe",
      colourLabels: ["ECRU SNAKE/ROYAL SUEDE", "BLACK VINTAGE/LIPSTICK SUEDE"],
    };

    expect(matchesSpecsStyleSearchFilters(splitUpperStyle, {
      query: "ECRU SNAKE",
      upper2Query: "ROYAL SUEDE",
    })).toBe(true);
    expect(matchesSpecsStyleSearchFilters(splitUpperStyle, {
      query: "ECRU SNAKE",
      upper2Query: "LIPSTICK SUEDE",
    })).toBe(false);
  });

  it("accepts a compact Upper 1/Upper 2 SKU lookup in the main search", () => {
    expect(matchesSpecsStyleSearchFilters({
      style: "ROBYN",
      last: "ROBYN",
      category: "Dress Shoe",
      colourLabels: ["ECRU SNAKE/LIPSTICK SUEDE"],
    }, { query: "ecru snake/lipstick suede" })).toBe(true);
  });
});
