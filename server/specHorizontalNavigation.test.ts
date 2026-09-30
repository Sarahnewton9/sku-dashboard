import { describe, expect, it } from "vitest";
import {
  getHorizontalScrollMetrics,
  getHorizontalScrollTarget,
} from "@shared/specHorizontalNavigation";

describe("dynamic Specs horizontal navigation", () => {
  it("exposes a slider only when the grid exceeds the visible width", () => {
    expect(getHorizontalScrollMetrics(900, 900, 0)).toEqual({
      position: 0,
      maxPosition: 0,
      isScrollable: false,
    });
    expect(getHorizontalScrollMetrics(2400, 900, 600)).toEqual({
      position: 600,
      maxPosition: 1500,
      isScrollable: true,
    });
  });

  it("moves by a large visible page without exceeding either edge", () => {
    expect(getHorizontalScrollTarget(0, 900, 1500, "right")).toBe(720);
    expect(getHorizontalScrollTarget(1500, 900, 1500, "right")).toBe(1500);
    expect(getHorizontalScrollTarget(300, 900, 1500, "left")).toBe(0);
  });
});
