import { describe, expect, it } from "vitest";
import { getSpecExportFilename } from "@shared/specExportFilename";

describe("Specs export filename", () => {
  it("uses the factory-facing Winter 2027 filename", () => {
    expect(getSpecExportFilename("essa")).toBe("ESSA- TONY BIANCO DEV WINTER 2027.xlsx");
  });

  it("removes accidental whitespace around the style name", () => {
    expect(getSpecExportFilename("  VIBE  ")).toBe("VIBE- TONY BIANCO DEV WINTER 2027.xlsx");
  });
});
