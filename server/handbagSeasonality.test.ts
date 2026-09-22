import { describe, expect, it } from "vitest";
import {
  getHandbagSeasonality,
  HANDBAG_SEASONALITY_OPTIONS,
  normalizeHandbagSeasonality,
} from "@shared/handbagSeasonality";

describe("handbag seasonality", () => {
  it("uses the handbag-only SKU seasonality when it is set", () => {
    expect(getHandbagSeasonality({ seasonality: "SS26", section: "Core / Carry Over" }, "Core / Carry Over"))
      .toBe("SS26");
  });

  it("retains legacy section values for the existing handbag range", () => {
    expect(getHandbagSeasonality({ section: "Core / Carry Over" }, "SS26"))
      .toBe("Core / Carry Over");
  });

  it("uses the parent style seasonality for a new style with no SKUs", () => {
    expect(getHandbagSeasonality(undefined, "SS26")).toBe("SS26");
  });

  it("normalizes blank inputs to null", () => {
    expect(normalizeHandbagSeasonality("  ")).toBeNull();
    expect(normalizeHandbagSeasonality(" SS26 ")).toBe("SS26");
  });

  it("offers W27 for new handbag styles and SKUs", () => {
    expect(HANDBAG_SEASONALITY_OPTIONS).toContain("W27");
  });
});
