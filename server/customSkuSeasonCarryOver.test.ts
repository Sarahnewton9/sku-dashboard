import { describe, expect, it } from "vitest";
import { getCustomSkuCarryOverSeason } from "@shared/customSkuSeasonCarryOver";

describe("getCustomSkuCarryOverSeason", () => {
  it("carries SS26 custom SKUs into W27", () => {
    expect(getCustomSkuCarryOverSeason("SS26")).toBe("W27");
    expect(getCustomSkuCarryOverSeason(" ss26 ")).toBe("W27");
  });

  it("does not copy W27 custom SKUs into another season", () => {
    expect(getCustomSkuCarryOverSeason("W27")).toBeNull();
    expect(getCustomSkuCarryOverSeason(undefined)).toBeNull();
  });
});
