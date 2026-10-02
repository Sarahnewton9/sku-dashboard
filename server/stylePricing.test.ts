import { describe, expect, it } from "vitest";
import { getAuGrossMargin, getSuggestedAuRrp } from "../shared/stylePricing";

describe("style price recommendations", () => {
  it("rounds a 75% target price up to the established Buy Plan ladder", () => {
    // Summer 26 ARLA: $46.25 landed cost, with the next full RRP point at $209.95.
    expect(getSuggestedAuRrp(46.25, 0.75)).toBe(209.95);
  });

  it("calculates gross margin on retail excluding Australian GST", () => {
    // Summer 26 ARLA's AU actual RRP of $199.95 produces the 74.6% buy-plan margin.
    expect(getAuGrossMargin(46.25, 199.95)).toBeCloseTo(0.7456, 4);
  });

  it("rejects incomplete or invalid price inputs", () => {
    expect(getSuggestedAuRrp(0, 0.75)).toBeNull();
    expect(getSuggestedAuRrp(46.25, 1)).toBeNull();
    expect(getAuGrossMargin(46.25, 0)).toBeNull();
  });
});
