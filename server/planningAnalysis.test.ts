import { describe, expect, it } from "vitest";
import { buildPlanningAnalysis } from "@shared/planningAnalysis";

describe("planning analysis", () => {
  const analysis = buildPlanningAnalysis([
    {
      style: "ALPHA", category: "Dress Shoe", last: "ALPHA", isNew: true,
      auQty: 10, usaQty: 2, nycQty: 0, laQty: 0, fobUsd: 30, rrpAud: 199.95,
    },
    {
      style: "BETA", category: "Boot", last: "BETA", isNew: false,
      auQty: 0, usaQty: 3, nycQty: 1, laQty: 0, fobUsd: null, rrpAud: 249.95,
    },
  ]);

  it("separates costed, priced, and comparable units instead of inventing missing spend", () => {
    expect(analysis.total.units).toBe(16);
    expect(analysis.total.newUnits).toBe(12);
    expect(analysis.total.costedUnits).toBe(12);
    expect(analysis.total.pricedUnits).toBe(16);
    expect(analysis.total.comparableUnits).toBe(12);
    expect(analysis.total.fobSpendUsd).toBe(360);
    expect(analysis.total.landedSpendAud).toBeCloseTo(529.285714, 5);
    expect(analysis.total.retailValueAud).toBeCloseTo(3399.2, 4);
    expect(analysis.total.grossMargin).toBeCloseTo(0.7578, 3);
  });

  it("keeps market and category spend allocation tied to purchased quantities", () => {
    expect(analysis.markets.find((row) => row.market === "AU")).toMatchObject({
      units: 10, costedUnits: 10, fobSpendUsd: 300,
    });
    expect(analysis.markets.find((row) => row.market === "USA")).toMatchObject({
      units: 5, costedUnits: 2, fobSpendUsd: 60,
    });
    expect(analysis.categories.find((row) => row.category === "Dress Shoe")).toMatchObject({
      units: 12, newUnits: 12, fobSpendUsd: 360,
    });
    expect(analysis.categories.find((row) => row.category === "Boot")).toMatchObject({
      units: 4, costedUnits: 0, grossMargin: null,
    });
  });
});
