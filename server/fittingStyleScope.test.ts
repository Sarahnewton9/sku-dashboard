import { describe, expect, it } from "vitest";
import { getW27NewPatternStyleNames, isEligibleFittingStyle } from "@shared/fittingStyleScope";

describe("W27 fitting scope", () => {
  const w27Parents = [{ style: "Mack" }, { style: "Apache" }, { style: "ANJA" }];
  const ss26Parents = [{ style: "APACHE" }, { style: "Anja" }];
  const newW27Patterns = getW27NewPatternStyleNames(w27Parents, ss26Parents);

  it("includes only W27 patterns with no SS26 parent", () => {
    expect([...newW27Patterns]).toEqual(["MACK"]);
  });

  it("excludes carry-over custom patterns such as APACHE and ANJA", () => {
    expect(isEligibleFittingStyle("W27", "APACHE", true, newW27Patterns)).toBe(false);
    expect(isEligibleFittingStyle("W27", "ANJA", true, newW27Patterns)).toBe(false);
  });

  it("does not put existing static patterns or new colourways into W27 fittings", () => {
    expect(isEligibleFittingStyle("W27", "MADDl", false, newW27Patterns)).toBe(false);
  });

  it("keeps the SS26 fitting workflow unchanged", () => {
    expect(isEligibleFittingStyle("SS26", "APACHE", true, newW27Patterns)).toBe(true);
  });
});
