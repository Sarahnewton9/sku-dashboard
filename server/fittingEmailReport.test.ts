import { describe, expect, it } from "vitest";
import { countFittingEmailImages, selectFittingEmailSessions, selectLatestFittingEmailImageSession } from "@shared/fittingEmailReport";

const sessions = [
  { id: 1, sessionDate: "2026-10-10", notes: "Earlier fit", images: [{ imageUrl: "https://example.com/earlier.jpg" }] },
  { id: 2, sessionDate: "2026-10-21", notes: "Current instruction", images: [{ imageUrl: "https://example.com/current-1.jpg" }, { imageUrl: "https://example.com/current-2.jpg" }] },
  { id: 3, sessionDate: "2026-10-21", notes: "Second current model", images: [] },
];

describe("per-style fitting email session selection", () => {
  it("uses every session from the latest fitting day by default", () => {
    const selected = selectFittingEmailSessions(sessions, false);
    expect(selected.map((session) => session.id)).toEqual([3, 2]);
    const newestImages = selectLatestFittingEmailImageSession(sessions);
    expect(newestImages?.id).toBe(2);
    expect(countFittingEmailImages(newestImages ? [newestImages] : [])).toBe(2);
  });

  it("keeps full note history without adding earlier fitting images", () => {
    const selected = selectFittingEmailSessions(sessions, true);
    expect(selected.map((session) => session.id)).toEqual([3, 2, 1]);
    const newestImages = selectLatestFittingEmailImageSession(sessions);
    expect(countFittingEmailImages(newestImages ? [newestImages] : [])).toBe(2);
  });
});
