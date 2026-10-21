import { describe, expect, it } from "vitest";
import { countFittingEmailImages, selectFittingEmailSessions } from "@shared/fittingEmailReport";

const sessions = [
  { id: 1, sessionDate: "2026-10-10", notes: "Earlier fit", images: [{ imageUrl: "https://example.com/earlier.jpg" }] },
  { id: 2, sessionDate: "2026-10-21", notes: "Current instruction", images: [{ imageUrl: "https://example.com/current-1.jpg" }, { imageUrl: "https://example.com/current-2.jpg" }] },
  { id: 3, sessionDate: "2026-10-21", notes: "Second current model", images: [] },
];

describe("per-style fitting email session selection", () => {
  it("uses every session from the latest fitting day by default", () => {
    const selected = selectFittingEmailSessions(sessions, false);
    expect(selected.map((session) => session.id)).toEqual([3, 2]);
    expect(countFittingEmailImages(selected)).toBe(2);
  });

  it("keeps the full fitting history in newest-first order when requested", () => {
    const selected = selectFittingEmailSessions(sessions, true);
    expect(selected.map((session) => session.id)).toEqual([3, 2, 1]);
    expect(countFittingEmailImages(selected)).toBe(3);
  });
});
