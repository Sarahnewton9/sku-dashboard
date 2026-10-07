import { describe, expect, it } from "vitest";
import { isFobCostRequestEligible } from "../shared/fobCostRequest";

describe("FOB cost request eligibility", () => {
  it("includes a received new-season SKU when FOB is missing", () => {
    expect(isFobCostRequestEligible({
      isNewSeasonSku: true,
      sampleStatus: "received",
      currentFobUsd: null,
    })).toBe(true);
  });

  it("drops the SKU from the rolling request immediately after an FOB import", () => {
    expect(isFobCostRequestEligible({
      isNewSeasonSku: true,
      sampleStatus: "received",
      currentFobUsd: 31.5,
    })).toBe(false);
  });

  it("includes fitting samples and excludes carry-over or waiting SKUs", () => {
    expect(isFobCostRequestEligible({
      isNewSeasonSku: true,
      sampleStatus: "fitting_sample",
      currentFobUsd: null,
    })).toBe(true);
    expect(isFobCostRequestEligible({
      isNewSeasonSku: false,
      sampleStatus: "received",
      currentFobUsd: null,
    })).toBe(false);
    expect(isFobCostRequestEligible({
      isNewSeasonSku: true,
      sampleStatus: "waiting",
      currentFobUsd: null,
    })).toBe(false);
  });
});
