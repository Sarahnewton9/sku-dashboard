import { describe, expect, it } from "vitest";
import { DEFAULT_FITTING_SIZE, getFittingSizeOptions, getNewFittingSize, getLastApprovalSizeChecks, getLastApprovalSizeProgress } from "../shared/lastApprovalSizes";

describe("Last Approval fitting sizes", () => {
  it("keeps size 7 first, followed by the confirmed 5, 6.5 and 9", () => {
    const checks = getLastApprovalSizeChecks("W27");
    expect(checks.map((check) => check.label)).toEqual(["7", "5", "6.5", "9"]);
    expect(checks.map((check) => check.field)).toEqual(["size7Approved", "size5Approved", "size65Approved", "size9Approved"]);
    expect(checks.filter((check) => check.firstFitting).map((check) => check.label)).toEqual(["7"]);
  });

  it("does not reinterpret discontinued size 5.5/6/9.5 approvals as different sizes", () => {
    const flags = { size7Approved: true, size55Approved: true, size6Approved: true, size95Approved: true };
    expect(getLastApprovalSizeChecks("W27", flags).map((check) => check.checked)).toEqual([true, false, false, false]);
    expect(getLastApprovalSizeProgress("W27", flags)).toEqual({ approved: 1, total: 4, percent: 25, complete: false });
    expect(flags).toEqual({ size7Approved: true, size55Approved: true, size6Approved: true, size95Approved: true });
  });

  it.each(["size5Approved", "size65Approved", "size9Approved"] as const)("stores %s independently from the first-size fitting", (field) => {
    const checks = getLastApprovalSizeChecks("W27", { size7Approved: false, [field]: true });
    expect(checks.find((check) => check.field === field)?.checked).toBe(true);
    expect(checks.find((check) => check.field === "size7Approved")?.checked).toBe(false);
    expect(checks.filter((check) => check.checked)).toHaveLength(1);
  });

  it("retains existing genuine size 6.5 and 9 approvals alongside size 7", () => {
    expect(getLastApprovalSizeChecks("W27", { size65Approved: true, size7Approved: true, size9Approved: true }).map(c => c.checked))
      .toEqual([true, false, true, true]);
  });

  it("counts all four actual W27 size approvals for completion", () => {
    expect(getLastApprovalSizeProgress("W27", { size7Approved: true, size5Approved: true, size65Approved: true, size9Approved: true }))
      .toEqual({ approved: 4, total: 4, percent: 100, complete: true });
  });

  it("keeps SS26's original 6.5/7/9.5 fields and three-size progress", () => {
    const flags = { size65Approved: true, size7Approved: true, size95Approved: true, size5Approved: false };
    expect(getLastApprovalSizeChecks("SS26", flags).map((check) => check.label)).toEqual(["6.5", "7", "9.5"]);
    expect(getLastApprovalSizeProgress("SS26", flags)).toEqual({ approved: 3, total: 3, percent: 100, complete: true });
  });

  it("normalizes the season and defaults missing records to pending", () => {
    expect(getLastApprovalSizeChecks(" w27 ").map((check) => check.label)).toEqual(["7", "5", "6.5", "9"]);
    expect(getLastApprovalSizeProgress("W27")).toEqual({ approved: 0, total: 4, percent: 0, complete: false });
  });
});

describe("Fitting session sizes", () => {
  it("uses the same four W27 sizes as Last Approvals with 7 as default", () => {
    expect(DEFAULT_FITTING_SIZE).toBe("7");
    expect(getFittingSizeOptions("W27")).toEqual(["7", "5", "6.5", "9"]);
  });

  it.each([undefined, null, "", "  "])("defaults an unrecorded new fitting to 7 (%s)", (value) => {
    expect(getNewFittingSize(value)).toBe("7");
  });

  it.each(["5", "6.5", "9", "37", "8"])("preserves an explicitly recorded fitting size %s", (value) => {
    expect(getNewFittingSize(value)).toBe(value);
  });

  it("preserves a legacy saved size as an edit option without adding it to new session choices", () => {
    expect(getFittingSizeOptions("W27", "37")).toEqual(["7", "5", "6.5", "9", "37"]);
    expect(getFittingSizeOptions("W27", "6.5")).toEqual(["7", "5", "6.5", "9"]);
    expect(getFittingSizeOptions("W27")).not.toContain("37");
  });

  it("keeps SS26 options linked to its own approval sizes", () => {
    expect(getFittingSizeOptions("SS26")).toEqual(["7", "6.5", "9.5"]);
    expect(getFittingSizeOptions("SS26", "8")).toEqual(["7", "6.5", "9.5", "8"]);
  });
});
