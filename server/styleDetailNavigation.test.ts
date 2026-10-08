import { describe, expect, it } from "vitest";
import { getAdjacentStyle } from "@shared/styleDetailNavigation";

describe("getAdjacentStyle", () => {
  const visibleStyles = ["ALBA", "BLAIRE", "CITY"];

  it("moves through the currently visible style order", () => {
    expect(getAdjacentStyle(visibleStyles, "BLAIRE", "previous")).toBe("ALBA");
    expect(getAdjacentStyle(visibleStyles, "BLAIRE", "next")).toBe("CITY");
  });

  it("does not wrap past the first or last visible style", () => {
    expect(getAdjacentStyle(visibleStyles, "ALBA", "previous")).toBeNull();
    expect(getAdjacentStyle(visibleStyles, "CITY", "next")).toBeNull();
  });

  it("does not navigate when the active style is not in the filtered list", () => {
    expect(getAdjacentStyle(visibleStyles, "MARGOT", "next")).toBeNull();
  });
});
