import { describe, expect, it } from "vitest";
import { buildRangeReadiness } from "@shared/rangeReadiness";

describe("range readiness", () => {
  const { rows, summary } = buildRangeReadiness([
    {
      style: "READY", last: "NEW LAST", category: "Dress Shoe", isNew: true,
      requiresFitting: true, needsLastApproval: true, lastApproved: true,
      fitApproved: true, hasFittingSession: true, specComplete: true,
      newSkuCount: 2, boughtNewSkuCount: 2, costedNewSkuCount: 2, hasRrp: true,
    },
    {
      style: "BLOCKED", last: "NEW LAST", category: "Dress Shoe", isNew: true,
      requiresFitting: true, needsLastApproval: true, lastApproved: false,
      fitApproved: false, hasFittingSession: false, specComplete: false,
      newSkuCount: 3, boughtNewSkuCount: 1, costedNewSkuCount: 2, hasRrp: false,
    },
    {
      style: "CORE", last: "CORE LAST", category: "Boot", isNew: false,
      requiresFitting: false, needsLastApproval: false, lastApproved: false,
      fitApproved: false, hasFittingSession: false, specComplete: false,
      newSkuCount: 0, boughtNewSkuCount: 0, costedNewSkuCount: 0, hasRrp: false,
    },
  ]);

  it("counts only relevant gates and leaves core carry-over styles out of development blockers", () => {
    const core = rows.find((row) => row.style === "CORE")!;
    expect(core.readiness).toBe(1);
    expect(core.blockers).toEqual([]);
    expect(core.gates.every((gate) => gate.status === "not_required")).toBe(true);
  });

  it("surfaces each outstanding development gate without treating a partial cost or buy as complete", () => {
    const blocked = rows.find((row) => row.style === "BLOCKED")!;
    expect(blocked.blockers).toEqual(["Fit", "Last", "Specs", "FOB", "RRP", "Buy"]);
    expect(blocked.readyGateCount).toBe(0);
    expect(blocked.requiredGateCount).toBe(6);
    expect(blocked.nextAction).toBe("Complete Fit · Last · Specs · FOB · RRP · Buy");
  });

  it("summarises the actionable new-SKU workflow", () => {
    expect(summary).toMatchObject({
      styles: 3,
      readyStyles: 2,
      attentionStyles: 1,
      newSkus: 5,
      boughtNewSkus: 3,
      costedNewSkus: 4,
      pricedStyles: 1,
      fittingRequired: 2,
      fittingApproved: 1,
      lastApprovalRequired: 2,
      lastApproved: 1,
      specsRequired: 2,
      specsComplete: 1,
    });
  });
});
