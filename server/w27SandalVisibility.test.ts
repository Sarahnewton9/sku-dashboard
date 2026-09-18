import { describe, expect, it } from "vitest";
import {
  getW27SandalCategory,
  isHiddenFromW27WorkingRange,
} from "@shared/w27SandalVisibility";

describe("W27 sandal working-range visibility", () => {
  it("classifies Kimba and Kali as Flat Sandals regardless of legacy category", () => {
    expect(getW27SandalCategory("KIMBA", "Dress Sandal")).toBe("FLAT SANDAL");
    expect(getW27SandalCategory("KALI", "Sandal")).toBe("FLAT SANDAL");
  });

  it("classifies every other legacy Sandal as a Casual Sandal", () => {
    expect(getW27SandalCategory("JAZZY", "Sandal")).toBe("CASUAL SANDAL");
    expect(getW27SandalCategory("ALLY", "Flat Sandal")).toBe("FLAT SANDAL");
    expect(getW27SandalCategory("CUSTOM", "Casual Sandal")).toBe("CASUAL SANDAL");
  });

  it("keeps Dress Sandals and every SS26 style visible", () => {
    expect(isHiddenFromW27WorkingRange("W27", "KASSY", "Dress Sandal")).toBe(false);
    expect(isHiddenFromW27WorkingRange("SS26", "KIMBA", "Dress Sandal")).toBe(false);
  });

  it("hides Flat and Casual Sandals in W27 only", () => {
    expect(isHiddenFromW27WorkingRange("W27", "KIMBA", "Dress Sandal")).toBe(true);
    expect(isHiddenFromW27WorkingRange("W27", "JAZZY", "Sandal")).toBe(true);
  });
});
