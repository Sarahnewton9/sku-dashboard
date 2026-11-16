import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { BuySessionPickerOptions } from "../client/src/components/dashboard/BuySessionPickerOptions";

beforeAll(() => { (globalThis as any).React = React; });
const sessions = [
  { id: 1, name: "BUY 05.10", createdAt: new Date("2026-10-05T00:00:00Z"), isLocked: 1 },
  { id: 2, name: "BUY 29.10", createdAt: new Date("2026-10-29T00:00:00Z"), isLocked: true },
];
function render(selectedIds: number[], items = sessions) {
  return renderToStaticMarkup(React.createElement(BuySessionPickerOptions, {
    sessions: items, selectedIds, onSelectionChange: () => undefined,
  }));
}

describe("Buy session Select all options", () => {
  it("puts Select all first and keeps newest sessions first", () => {
    const html = render([]);
    expect(html.match(/aria-label="[^"]+"/g)).toEqual([
      'aria-label="Select all sessions"', 'aria-label="BUY 29.10"', 'aria-label="BUY 05.10"',
    ]);
    expect(html).toContain("Select all</span>");
    expect(html.match(/aria-checked="[^"]+"/g)).toEqual(Array(3).fill('aria-checked="false"'));
  });
  it("shows every option checked when all are selected", () => {
    expect(render([1, 2]).match(/aria-checked="[^"]+"/g)).toEqual(Array(3).fill('aria-checked="true"'));
  });
  it("shows mixed Select all state and retains the other option after one is deselected", () => {
    expect(render([1]).match(/aria-checked="[^"]+"/g)).toEqual([
      'aria-checked="mixed"', 'aria-checked="false"', 'aria-checked="true"',
    ]);
  });
  it("keeps locked sessions selectable for analysis", () => {
    const html = render([1, 2]);
    expect(html.match(/>Locked<\/span>/g)).toHaveLength(2);
    expect(html).not.toContain("disabled");
  });
  it("does not show a meaningless Select all when no sessions exist", () => {
    const html = render([], []);
    expect(html).toContain("No sessions yet");
    expect(html).not.toContain("Select all");
  });
});
