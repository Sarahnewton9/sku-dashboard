import { describe, expect, it } from "vitest";
import { selectSpecColourColumns, shouldIncludeStyleInSpecs } from "@shared/specsStyleVisibility";

describe("Specs style visibility", () => {
  it("includes an existing style when it has a new seasonal colour", () => {
    expect(shouldIncludeStyleInSpecs({ isOnNewLast: false, hasNewColours: true })).toBe(true);
  });

  it("keeps styles without a new last or new colours out of Specs", () => {
    expect(shouldIncludeStyleInSpecs({ isOnNewLast: false, hasNewColours: false })).toBe(false);
  });

  it("shows all active colours for run-ons but only new colours when present", () => {
    expect(selectSpecColourColumns({ activeColours: ["BLACK", "TAN"], newColours: [] })).toEqual(["BLACK", "TAN"]);
    expect(selectSpecColourColumns({ activeColours: ["BLACK", "TAN"], newColours: ["TAN"] })).toEqual(["TAN"]);
  });
});
