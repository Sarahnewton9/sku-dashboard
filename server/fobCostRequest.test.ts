import { describe, expect, it } from "vitest";
import { isFobCostRequestEligible } from "../shared/fobCostRequest";

describe("FOB cost request eligibility", () => {
  it("includes a received sample from an all-new style when FOB is missing", () => {
    expect(isFobCostRequestEligible({
      isNewSeasonStyle: true,
      sampleStatus: "received",
      currentFobUsd: null,
    })).toBe(true);
  });

  it("drops the SKU from the rolling request immediately after an FOB import", () => {
    expect(isFobCostRequestEligible({
      isNewSeasonStyle: true,
      sampleStatus: "received",
      currentFobUsd: 31.5,
    })).toBe(false);
  });

  it("excludes carry-over styles and samples that have not been received", () => {
    expect(isFobCostRequestEligible({
      isNewSeasonStyle: false,
      sampleStatus: "received",
      currentFobUsd: null,
    })).toBe(false);
    expect(isFobCostRequestEligible({
      isNewSeasonStyle: true,
      sampleStatus: "waiting",
      currentFobUsd: null,
    })).toBe(false);
  });
});
