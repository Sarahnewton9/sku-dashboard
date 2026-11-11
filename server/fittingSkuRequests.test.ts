import { describe, expect, it } from "vitest";
import {
  getRequestedFittingSkuLabels,
  type ActiveFittingSku,
} from "@shared/fittingSkuRequests";

const cubaBlackSupra: ActiveFittingSku = {
  style: "CUBA",
  colour: "BLACK",
  leather: "SUPRA",
  colour2: null,
  leather2: null,
};

describe("requested fitting SKU labels", () => {
  it("returns the exact CUBA BLACK SUPRA request for W27", () => {
    expect(getRequestedFittingSkuLabels("W27", [cubaBlackSupra])).toEqual(
      new Map([["CUBA", ["BLACK SUPRA"]]]),
    );
  });

  it("normalizes season, identity parts, and null/blank Upper 2 values", () => {
    expect(getRequestedFittingSkuLabels(" w27 ", [{
      style: " cuba ",
      colour: " black ",
      leather: "  supra ",
      colour2: "",
      leather2: " ",
    }])).toEqual(new Map([["CUBA", ["BLACK SUPRA"]]]));
  });

  it("does not return a request when the active range omits it", () => {
    expect(getRequestedFittingSkuLabels("W27", [])).toEqual(new Map());
    expect(getRequestedFittingSkuLabels("W27", [
      { ...cubaBlackSupra, colour: "WHITE" },
    ])).toEqual(new Map());
  });

  it("does not apply the W27 request to SS26", () => {
    expect(getRequestedFittingSkuLabels("SS26", [cubaBlackSupra])).toEqual(new Map());
  });

  it("does not match Upper 2 siblings, other CUBA colours, or other styles", () => {
    expect(getRequestedFittingSkuLabels("W27", [
      { ...cubaBlackSupra, colour2: "BLACK", leather2: "SUPRA" },
      { ...cubaBlackSupra, colour: "WHITE" },
      { ...cubaBlackSupra, style: "CAPRICE" },
    ])).toEqual(new Map());
  });

  it("does not duplicate a requested label when the active input repeats a row", () => {
    expect(getRequestedFittingSkuLabels("W27", [cubaBlackSupra, { ...cubaBlackSupra }])).toEqual(
      new Map([["CUBA", ["BLACK SUPRA"]]]),
    );
  });
});
