import { describe, expect, it } from "vitest";
import { getLastApprovalSizeChecks, getLastApprovalSizeProgress } from "../shared/lastApprovalSizes";

describe("Last Approval fitting sizes", () => {
  it("keeps size 7 first, followed by the confirmed 5.5, 6 and 9", () => {
    const checks = getLastApprovalSizeChecks("W27");
    expect(checks.map((check) => check.label)).toEqual(["7", "5.5", "6", "9"]);
    expect(checks.map((check) => check.field)).toEqual(["size7Approved", "size55Approved", "size6Approved", "size9Approved"]);
    expect(checks.filter((check) => check.firstFitting).map((check) => check.label)).toEqual(["7"]);
  });

  it("keeps the original stored size 7 checked without marking new sizes as fitted", () => {
    const flags = { size7Approved: true, size65Approved: true, size95Approved: true };
    expect(getLastApprovalSizeChecks("W27", flags).map((check) => check.checked)).toEqual([true, false, false, false]);
    expect(getLastApprovalSizeProgress("W27", flags)).toEqual({ approved: 1, total: 4, percent: 25, complete: false });
    expect(flags).toEqual({ size7Approved: true, size65Approved: true, size95Approved: true });
  });

  it.each(["size55Approved", "size6Approved", "size9Approved"] as const)("stores %s independently from the first-size fitting", (field) => {
    const checks = getLastApprovalSizeChecks("W27", { size7Approved: false, [field]: true });
    expect(checks.find((check) => check.field === field)?.checked).toBe(true);
    expect(checks.find((check) => check.field === "size7Approved")?.checked).toBe(false);
    expect(checks.filter((check) => check.checked)).toHaveLength(1);
  });

  it("counts all four actual W27 size approvals for completion", () => {
    expect(getLastApprovalSizeProgress("W27", { size7Approved: true, size55Approved: true, size6Approved: true, size9Approved: true }))
      .toEqual({ approved: 4, total: 4, percent: 100, complete: true });
  });

  it("keeps SS26's original 6.5/7/9.5 fields and three-size progress", () => {
    const flags = { size65Approved: true, size7Approved: true, size95Approved: true, size55Approved: false };
    expect(getLastApprovalSizeChecks("SS26", flags).map((check) => check.label)).toEqual(["6.5", "7", "9.5"]);
    expect(getLastApprovalSizeProgress("SS26", flags)).toEqual({ approved: 3, total: 3, percent: 100, complete: true });
  });

  it("normalizes the season and defaults missing records to pending without guessing approvals", () => {
    expect(getLastApprovalSizeChecks(" w27 ").map((check) => check.label)).toEqual(["7", "5.5", "6", "9"]);
    expect(getLastApprovalSizeProgress("W27")).toEqual({ approved: 0, total: 4, percent: 0, complete: false });
  });
});
