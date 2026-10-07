import { describe, expect, it } from "vitest";
import {
  getAuGrossMarginFromFob,
  getEstimatedLandedCostAud,
  getMarginStatus,
  getSuggestedAuRrpFromFob,
} from "../shared/fobMargin";

describe("FOB margin planning", () => {
  it("uses the established planning conversion and freight allowance", () => {
    // Summer 26 ARLA: US$31.50 FOB → AU$46.25 planning landed cost.
    expect(getEstimatedLandedCostAud(31.5)).toBeCloseTo(46.25, 6);
  });

  it("recreates the established 75% RRP guide from FOB", () => {
    expect(getSuggestedAuRrpFromFob(31.5)).toBe(209.95);
    expect(getAuGrossMarginFromFob(31.5, 199.95)).toBeCloseTo(0.7456, 4);
  });

  it("can guide the margin from the highest available FOB while other colourways await costs", () => {
    expect(getAuGrossMarginFromFob(33.5, 199.95)).toBeCloseTo(0.7298, 4);
    expect(getSuggestedAuRrpFromFob(33.5)).toBe(219.95);
  });

  it("keeps 70–74.9% within tolerance and warns below 70%", () => {
    expect(getMarginStatus(0.75)).toBe("on_target");
    expect(getMarginStatus(0.745)).toBe("within_tolerance");
    expect(getMarginStatus(0.70)).toBe("within_tolerance");
    expect(getMarginStatus(0.699)).toBe("below_tolerance");
  });
});
