export type ReadinessStatus = "ready" | "attention" | "not_required";

export type RangeReadinessInput = {
  style: string;
  last: string;
  category: string;
  imageUrl?: string;
  isNew: boolean;
  requiresFitting: boolean;
  needsLastApproval: boolean;
  lastApproved: boolean;
  fitApproved: boolean;
  hasFittingSession: boolean;
  specComplete: boolean;
  newSkuCount: number;
  boughtNewSkuCount: number;
  costedNewSkuCount: number;
  hasRrp: boolean;
};

export type ReadinessGate = {
  key: "fit" | "last" | "specs" | "fob" | "rrp" | "buy";
  label: string;
  status: ReadinessStatus;
  detail: string;
};

export type RangeReadinessRow = RangeReadinessInput & {
  gates: ReadinessGate[];
  requiredGateCount: number;
  readyGateCount: number;
  readiness: number;
  blockers: string[];
  nextAction: string;
};

export type RangeReadinessSummary = {
  styles: number;
  readyStyles: number;
  attentionStyles: number;
  newSkus: number;
  boughtNewSkus: number;
  costedNewSkus: number;
  pricedStyles: number;
  fittingRequired: number;
  fittingApproved: number;
  lastApprovalRequired: number;
  lastApproved: number;
  specsRequired: number;
  specsComplete: number;
};

function countDetail(done: number, total: number, noun: string) {
  return `${done}/${total} ${noun}`;
}

/**
 * Builds a style-level range-development worklist. A gate is only counted when
 * it is relevant to that style: fitting applies to new pattern styles, Last
 * Approval to new lasts, and Specs/FOB/buy to new physical SKUs.
 */
export function buildRangeReadiness(inputs: RangeReadinessInput[]) {
  const rows: RangeReadinessRow[] = inputs.map((input) => {
    const gates: ReadinessGate[] = [];

    gates.push(input.requiresFitting
      ? {
          key: "fit",
          label: "Fit",
          status: input.fitApproved ? "ready" : "attention",
          detail: input.fitApproved
            ? "Approved"
            : input.hasFittingSession ? "Needs sign-off" : "No fitting logged",
        }
      : { key: "fit", label: "Fit", status: "not_required", detail: "Not required" });

    gates.push(input.needsLastApproval
      ? {
          key: "last",
          label: "Last",
          status: input.lastApproved ? "ready" : "attention",
          detail: input.lastApproved ? "Approved" : "Waiting approval",
        }
      : { key: "last", label: "Last", status: "not_required", detail: "Existing last" });

    gates.push(input.newSkuCount > 0
      ? {
          key: "specs",
          label: "Specs",
          status: input.specComplete ? "ready" : "attention",
          detail: input.specComplete ? "Complete" : "To complete",
        }
      : { key: "specs", label: "Specs", status: "not_required", detail: "No new SKUs" });

    gates.push(input.newSkuCount > 0
      ? {
          key: "fob",
          label: "FOB",
          status: input.costedNewSkuCount === input.newSkuCount ? "ready" : "attention",
          detail: countDetail(input.costedNewSkuCount, input.newSkuCount, "costed"),
        }
      : { key: "fob", label: "FOB", status: "not_required", detail: "No new SKUs" });

    gates.push(input.newSkuCount > 0
      ? {
          key: "rrp",
          label: "RRP",
          status: input.hasRrp ? "ready" : "attention",
          detail: input.hasRrp ? "Set" : "Not set",
        }
      : { key: "rrp", label: "RRP", status: "not_required", detail: "No new SKUs" });

    gates.push(input.newSkuCount > 0
      ? {
          key: "buy",
          label: "Buy",
          status: input.boughtNewSkuCount === input.newSkuCount ? "ready" : "attention",
          detail: countDetail(input.boughtNewSkuCount, input.newSkuCount, "bought"),
        }
      : { key: "buy", label: "Buy", status: "not_required", detail: "No new SKUs" });

    const required = gates.filter((gate) => gate.status !== "not_required");
    const ready = required.filter((gate) => gate.status === "ready");
    const blockers = gates.filter((gate) => gate.status === "attention").map((gate) => gate.label);
    const nextAction = blockers.length ? `Complete ${blockers.join(" · ")}` : "Range ready";

    return {
      ...input,
      gates,
      requiredGateCount: required.length,
      readyGateCount: ready.length,
      readiness: required.length ? ready.length / required.length : 1,
      blockers,
      nextAction,
    };
  }).sort((a, b) => a.readiness - b.readiness || a.style.localeCompare(b.style));

  const summary: RangeReadinessSummary = {
    styles: rows.length,
    readyStyles: rows.filter((row) => row.blockers.length === 0).length,
    attentionStyles: rows.filter((row) => row.blockers.length > 0).length,
    newSkus: rows.reduce((sum, row) => sum + row.newSkuCount, 0),
    boughtNewSkus: rows.reduce((sum, row) => sum + row.boughtNewSkuCount, 0),
    costedNewSkus: rows.reduce((sum, row) => sum + row.costedNewSkuCount, 0),
    pricedStyles: rows.filter((row) => row.newSkuCount > 0 && row.hasRrp).length,
    fittingRequired: rows.filter((row) => row.requiresFitting).length,
    fittingApproved: rows.filter((row) => row.requiresFitting && row.fitApproved).length,
    lastApprovalRequired: rows.filter((row) => row.needsLastApproval).length,
    lastApproved: rows.filter((row) => row.needsLastApproval && row.lastApproved).length,
    specsRequired: rows.filter((row) => row.newSkuCount > 0).length,
    specsComplete: rows.filter((row) => row.newSkuCount > 0 && row.specComplete).length,
  };

  return { rows, summary };
}
