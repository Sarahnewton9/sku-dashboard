import { describe, expect, it } from "vitest";
import { hasSize11ForAllColourways } from "../shared/size11";

describe("hasSize11ForAllColourways", () => {
  it("requires every colourway to be explicitly confirmed", () => {
    expect(hasSize11ForAllColourways([true, true, true], Boolean)).toBe(true);
    expect(hasSize11ForAllColourways([true, false, true], Boolean)).toBe(false);
  });

  it("does not mark an empty or unconfirmed style as Size 11", () => {
    expect(hasSize11ForAllColourways([], Boolean)).toBe(false);
    expect(hasSize11ForAllColourways([false, false], Boolean)).toBe(false);
  });
});
