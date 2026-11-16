import { describe, expect, it } from "vitest";
import {
  getBuySessionSelectionState,
  toggleAllBuySessionIds,
  toggleBuySessionId,
} from "../shared/buySessionSelection";

describe("Buy session selection helpers", () => {
  it("selects every available session when none are selected", () => {
    expect(toggleAllBuySessionIds([29, 5, 12], [])).toEqual([29, 5, 12]);
  });

  it("reselects every available session after a partial selection", () => {
    expect(toggleAllBuySessionIds([29, 5, 12], [29])).toEqual([29, 5, 12]);
  });

  it("clears all sessions when every available session is already selected", () => {
    expect(toggleAllBuySessionIds([29, 5], [29, 5])).toEqual([]);
  });

  it("deduplicates available IDs when selecting all", () => {
    expect(toggleAllBuySessionIds([29, 5, 29, 5], [])).toEqual([29, 5]);
  });

  it("does not count or leak an unrelated season's selected ID", () => {
    expect(getBuySessionSelectionState([29, 5], [29, 99])).toBe("indeterminate");
    expect(toggleAllBuySessionIds([29, 5], [29, 99])).toEqual([29, 5]);
  });

  it("reports false for an empty available-session list", () => {
    expect(getBuySessionSelectionState([], [])).toBe(false);
    expect(toggleAllBuySessionIds([], [99])).toEqual([]);
  });

  it("reports true only when all available sessions are selected", () => {
    expect(getBuySessionSelectionState([29, 5], [29, 5])).toBe(true);
    expect(getBuySessionSelectionState([29, 5, 29], [29, 5])).toBe(true);
  });

  it("reports indeterminate when only some available sessions are selected", () => {
    expect(getBuySessionSelectionState([29, 5], [5])).toBe("indeterminate");
  });

  it("toggles one session off while retaining the other selection", () => {
    expect(toggleBuySessionId([29, 5], 29)).toEqual([5]);
  });

  it("adds a newly toggled session without duplicating existing selections", () => {
    expect(toggleBuySessionId([29], 5)).toEqual([29, 5]);
    expect(toggleBuySessionId([29, 5], 5)).toEqual([29]);
  });

  it("removes duplicate occurrences when toggling an already-selected ID off", () => {
    expect(toggleBuySessionId([29, 5, 29], 29)).toEqual([5]);
  });

  it("does not mutate caller-owned arrays", () => {
    const availableIds = [29, 5, 29];
    const selectedIds = [29, 99];
    const availableBefore = [...availableIds];
    const selectedBefore = [...selectedIds];

    toggleAllBuySessionIds(availableIds, selectedIds);
    getBuySessionSelectionState(availableIds, selectedIds);
    toggleBuySessionId(selectedIds, 5);

    expect(availableIds).toEqual(availableBefore);
    expect(selectedIds).toEqual(selectedBefore);
  });

  it("keeps locked-session filtering outside the helper contract", () => {
    // The caller passes only selectable IDs; locked sessions need no DB/helper logic.
    expect(toggleAllBuySessionIds([29, 5], [])).toEqual([29, 5]);
  });
});
