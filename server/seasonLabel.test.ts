import { describe, expect, it } from "vitest";
import { getSeasonDisplayLabel, getSeasonFileLabel } from "@shared/seasonLabel";

describe("season output labels", () => {
  it("uses Winter 27 wording for W27 outputs", () => {
    expect(getSeasonDisplayLabel("W27")).toBe("Winter 27");
    expect(getSeasonFileLabel("W27")).toBe("Winter_27");
  });

  it("retains Summer 26 wording for SS26 outputs", () => {
    expect(getSeasonDisplayLabel("SS26")).toBe("Summer 26");
    expect(getSeasonFileLabel("SS26")).toBe("Summer_26");
  });
});
