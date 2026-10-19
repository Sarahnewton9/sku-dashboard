import { describe, expect, it } from "vitest";
import { getSpecImageSampleOverlay } from "@shared/specImageSampleOverlay";

describe("Specs image sample overlay", () => {
  it("uses the latest fitting session with recorded sample details", () => {
    expect(getSpecImageSampleOverlay([
      { sampleDate: "03/10/2026", sampleType: "PROTO" },
      { sampleDate: null, sampleType: null },
      { sampleDate: "18/10/2026", sampleType: "SMS" },
    ])).toEqual({ sampleDate: "18/10/2026", sampleType: "SMS" });
  });

  it("keeps either detail when only one was recorded", () => {
    expect(getSpecImageSampleOverlay([{ sampleDate: "  ", sampleType: " Size Set " }]))
      .toEqual({ sampleDate: null, sampleType: "Size Set" });
  });

  it("does not render an overlay when no sample detail exists", () => {
    expect(getSpecImageSampleOverlay([{ sampleDate: null, sampleType: "" }])).toBeNull();
  });
});
