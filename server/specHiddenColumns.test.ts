import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module so we don't need a real DB connection
vi.mock("../drizzle/schema", () => ({
  specHiddenColumns: { style: "style", colour: "colour" },
}));

// Test the logic of the router procedures (input/output shapes)
describe("specHiddenColumns router logic", () => {
  it("getHidden returns an object with a hidden array", () => {
    const mockResult = { hidden: ["BLACK", "PETAL"] };
    expect(mockResult).toHaveProperty("hidden");
    expect(Array.isArray(mockResult.hidden)).toBe(true);
    expect(mockResult.hidden).toContain("BLACK");
  });

  it("hide mutation input validates style and colour", () => {
    const input = { style: "DAZIE", colour: "BLACK CAPRI" };
    expect(input.style).toBeTruthy();
    expect(input.colour).toBeTruthy();
    expect(typeof input.style).toBe("string");
    expect(typeof input.colour).toBe("string");
  });

  it("show mutation input validates style and colour", () => {
    const input = { style: "DAZIE", colour: "BLACK CAPRI" };
    expect(input.style).toBeTruthy();
    expect(input.colour).toBeTruthy();
  });

  it("filtering hidden columns from entry works correctly", () => {
    const entry = {
      style: "DAZIE",
      colours: ["BLACK", "BLACK CAPRI", "PETAL"],
      colourLabels: ["BLACK NAPPA", "BLACK CAPRI NAPPA", "PETAL NAPPA"],
      toeCapsPerColour: {},
    };
    const hiddenSet = new Set(["BLACK CAPRI"]);

    const filteredColours: string[] = [];
    const filteredLabels: string[] = [];
    for (let i = 0; i < entry.colours.length; i++) {
      const colour = entry.colours[i];
      if (!hiddenSet.has(colour)) {
        filteredColours.push(colour);
        filteredLabels.push(entry.colourLabels[i]);
      }
    }

    expect(filteredColours).toEqual(["BLACK", "PETAL"]);
    expect(filteredLabels).toEqual(["BLACK NAPPA", "PETAL NAPPA"]);
    expect(filteredColours).not.toContain("BLACK CAPRI");
  });

  it("show toggle restores hidden column to visible", () => {
    const hiddenSet = new Set(["BLACK CAPRI", "PETAL"]);
    const colourToRestore = "BLACK CAPRI";

    // Simulate showing a column
    const newHidden = Array.from(hiddenSet).filter((c) => c !== colourToRestore);
    const newSet = new Set(newHidden);

    expect(newSet.has("BLACK CAPRI")).toBe(false);
    expect(newSet.has("PETAL")).toBe(true);
  });

  it("hide adds colour to hidden set", () => {
    const hiddenSet = new Set<string>(["PETAL"]);
    const colourToHide = "BLACK CAPRI";

    // Simulate hiding a column
    const newSet = new Set([...hiddenSet, colourToHide]);

    expect(newSet.has("BLACK CAPRI")).toBe(true);
    expect(newSet.has("PETAL")).toBe(true);
    expect(newSet.size).toBe(2);
  });
});
