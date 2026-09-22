import { describe, expect, it } from "vitest";
import {
  getHandbagSeasonality,
  normalizeHandbagSeasonality,
} from "@shared/handbagSeasonality";

describe("handbag seasonality", () => {
  it("uses the handbag-only SKU seasonality when it is set", () => {
    expect(getHandbagSeasonality({ seasonality: "New Season", section: "Core / Carry Over" }, "Core / Carry Over"))
      .toBe("New Season");
  });

  it("retains legacy section values for the existing handbag range", () => {
    expect(getHandbagSeasonality({ section: "Core / Carry Over" }, "New Season"))
      .toBe("Core / Carry Over");
  });

  it("uses the parent style seasonality for a new style with no SKUs", () => {
    expect(getHandbagSeasonality(undefined, "New Season")).toBe("New Season");
  });

  it("normalizes blank inputs to null", () => {
    expect(normalizeHandbagSeasonality("  ")).toBeNull();
    expect(normalizeHandbagSeasonality(" New Season ")).toBe("New Season");
  });
});
