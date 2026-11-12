import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { LastApprovalSizeChecks } from "../client/src/components/dashboard/LastApprovalSizeChecks";

beforeAll(() => { (globalThis as any).React = React; });

function render(season: string, approvals = { size7Approved: true }) {
  return renderToStaticMarkup(React.createElement(LastApprovalSizeChecks, { season, approvals, onToggle: () => undefined }));
}

describe("Last Approval size controls", () => {
  it("renders 7 first fitting then 5.5, 6 and 9 in order", () => {
    const html = render("W27");
    expect(html.match(/aria-label="[^"]+"/g)).toEqual([
      'aria-label="Size 7 — first fitting"', 'aria-label="Size 5.5"', 'aria-label="Size 6"', 'aria-label="Size 9"',
    ]);
    expect(html).toContain("First fitting");
    expect(html).not.toContain("Sz 6.5");
    expect(html).not.toContain("Sz 9.5");
  });

  it("keeps the existing size 7 visibly approved and the additional sizes pending", () => {
    const html = render("W27");
    expect(html.match(/aria-pressed="(true|false)"/g)).toEqual([
      'aria-pressed="true"', 'aria-pressed="false"', 'aria-pressed="false"', 'aria-pressed="false"',
    ]);
  });

  it("does not relabel historical SS26 size approvals", () => {
    const html = render("SS26");
    expect(html.match(/aria-label="[^"]+"/g)).toEqual([
      'aria-label="Size 6.5"', 'aria-label="Size 7"', 'aria-label="Size 9.5"',
    ]);
    expect(html).not.toContain("First fitting");
  });
});
