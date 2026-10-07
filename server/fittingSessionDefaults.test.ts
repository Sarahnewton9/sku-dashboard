import { describe, expect, it } from "vitest";
import { getSameDayFittingDefaults, getSydneyBusinessDate } from "../shared/fittingSessionDefaults";

describe("same-day fitting session defaults", () => {
  it("copies sample details from the newest same-day session while keeping a new model independent", () => {
    const result = getSameDayFittingDefaults([
      { id: 10, sessionDate: "2026-10-07", sampleDate: "2026-09-29", sampleType: "Proto" },
      { id: 11, sessionDate: "2026-10-07", sampleDate: "2026-09-30", sampleType: "Revised Last" },
      { id: 12, sessionDate: "2026-10-06", sampleDate: "2026-09-28", sampleType: "Original" },
    ], "2026-10-07");

    expect(result).toEqual({
      sessionDate: "2026-10-07",
      sampleDate: "2026-09-30",
      sampleType: "Revised Last",
      sampleSize: null,
      copiedFromSessionId: 11,
    });
  });

  it("copies a fitting size only for fitting samples and leaves unrelated days blank", () => {
    expect(getSameDayFittingDefaults([
      { id: 10, sessionDate: "2026-10-07", sampleDate: "2026-09-29", sampleType: "Fitting Sample", sampleSize: "37" },
    ], "2026-10-07").sampleSize).toBe("37");

    expect(getSameDayFittingDefaults([
      { id: 10, sessionDate: "2026-10-06", sampleDate: "2026-09-29", sampleType: "Proto" },
    ], "2026-10-07")).toMatchObject({
      sampleDate: null,
      sampleType: null,
      copiedFromSessionId: null,
    });
  });

  it("uses the Sydney business date for same-day matching", () => {
    expect(getSydneyBusinessDate(new Date("2026-10-06T14:00:00.000Z"))).toBe("2026-10-07");
  });
});
