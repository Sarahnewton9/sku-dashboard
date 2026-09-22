import { describe, expect, it } from "vitest";
import { formatHandbagDisplayLabel } from "@shared/handbagDisplayLabel";

describe("handbag display labels", () => {
  it("renders handbag values in capitals without changing their data keys", () => {
    expect(formatHandbagDisplayLabel("Sky")).toBe("SKY");
    expect(formatHandbagDisplayLabel("Soft Vintage")).toBe("SOFT VINTAGE");
    expect(formatHandbagDisplayLabel("Core / Carry Over")).toBe("CORE / CARRY OVER");
  });

  it("uses a readable fallback for empty values", () => {
    expect(formatHandbagDisplayLabel(null)).toBe("—");
    expect(formatHandbagDisplayLabel("  ", "UNASSIGNED")).toBe("UNASSIGNED");
  });
});
