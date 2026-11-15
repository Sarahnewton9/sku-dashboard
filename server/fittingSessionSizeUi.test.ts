import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Render the production SessionCard and its real FittingSizeSelect. Only external
// data/context imports are isolated; these tests never instantiate an API client.
const fixture = vi.hoisted(() => ({ season: "W27" }));
vi.stubGlobal("React", React);
vi.mock("@/contexts/SeasonContext", () => ({
  useSeason: () => ({ season: fixture.season }),
}));
vi.mock("@/lib/trpc", () => ({ trpc: {} }));
vi.mock("@/lib/skuData", () => ({ skuData: { styles: [], rawSkus: [] } }));
import { SessionCard } from "../client/src/components/dashboard/FittingTab";

type Session = React.ComponentProps<typeof SessionCard>["session"];
const baseSession: Session = {
  id: 91001,
  style: "SYNTHETIC SIZE CHECK",
  fitModel: "SYNTHETIC MODEL",
  sessionDate: "2026-11-16",
  notes: "Synthetic unchanged fitting notes",
  sampleDate: "2026-11-15",
  sampleType: "Original",
  sampleSize: null,
  images: [],
};

function renderSession(overrides: Partial<Session> = {}, editing = false) {
  const onUpdateSession = vi.fn();
  const html = renderToStaticMarkup(
    React.createElement(SessionCard, {
      session: { ...baseSession, ...overrides },
      knownModels: ["SYNTHETIC MODEL"],
      onUploadImage: vi.fn(),
      onDeleteImage: vi.fn(),
      onUpdateSession,
      onDeleteSession: vi.fn(),
      startInEditMode: editing,
    })
  );
  return { html, onUpdateSession };
}

function fittingSizeMarkup(html: string) {
  const row = html.match(/Fitting size:<\/span>([\s\S]*?)<\/div>/);
  expect(row, "actual SessionCard fitting size row").not.toBeNull();
  return row![1];
}

function options(html: string) {
  const select = fittingSizeMarkup(html).match(
    /<select\b[^>]*>([\s\S]*?)<\/select>/
  );
  expect(select, "actual fitting size select").not.toBeNull();
  return [...select![1].matchAll(/<option value="([^"]+)"([^>]*)>/g)].map(
    match => ({ value: match[1], selected: match[2].includes("selected") })
  );
}

beforeEach(() => {
  fixture.season = "W27";
});

describe("actual SessionCard fitting size SSR", () => {
  it.each(["Original", "Proto", "Revised Last", "Fitting Sample"])(
    "starts editing a null-size %s session with 7 and all W27 approval sizes",
    sampleType => {
      const { html, onUpdateSession } = renderSession({ sampleType }, true);
      expect(options(html)).toEqual([
        { value: "7", selected: true },
        { value: "5", selected: false },
        { value: "6.5", selected: false },
        { value: "9", selected: false },
      ]);
      expect(html).toContain('aria-label="Fitting size"');
      expect(html).toContain(">Save</button>");
      expect(html).toContain(">Cancel</button>");
      expect(onUpdateSession).not.toHaveBeenCalled();
    }
  );

  it.each(["Original", "Proto", "Revised Last", "Fitting Sample"])(
    "shows a historical null-size %s session as a dash, never invented 7",
    sampleType => {
      const { html, onUpdateSession } = renderSession({ sampleType });
      const row = fittingSizeMarkup(html);
      expect(row).toContain("—");
      expect(row).not.toContain(">7<");
      expect(row).not.toContain("<select");
      expect(html).toContain("Synthetic unchanged fitting notes");
      expect(onUpdateSession).not.toHaveBeenCalled();
    }
  );

  it.each(["5", "6.5", "7", "9", "8", "37"])(
    "renders saved size %s unchanged in view mode",
    sampleSize => {
      const { html } = renderSession({ sampleSize });
      expect(fittingSizeMarkup(html)).toContain(`>${sampleSize}</span>`);
      expect(fittingSizeMarkup(html)).not.toContain("<select");
    }
  );

  it.each(["5", "6.5", "7", "9", "8", "37"])(
    "preserves meaningful saved size %s as selected when editing",
    sampleSize => {
      const { html, onUpdateSession } = renderSession({ sampleSize }, true);
      const values = options(html);
      expect(values.filter(option => option.selected)).toEqual([
        { value: sampleSize, selected: true },
      ]);
      expect(values.slice(0, 4).map(option => option.value)).toEqual([
        "7",
        "5",
        "6.5",
        "9",
      ]);
      expect(html).toContain('value="SYNTHETIC MODEL"');
      expect(html).toContain('value="2026-11-16"');
      expect(html).toContain('value="2026-11-15"');
      expect(html).toContain("Synthetic unchanged fitting notes");
      expect(onUpdateSession).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, "", "   "])(
    "defaults missing or blank saved size %j to 7 only in edit mode",
    sampleSize => {
      const { html } = renderSession({ sampleSize }, true);
      expect(options(html).filter(option => option.selected)).toEqual([
        { value: "7", selected: true },
      ]);
    }
  );

  it("keeps 7 as the edit default while retaining SS26 historical sizes", () => {
    fixture.season = "SS26";
    const { html } = renderSession({}, true);
    expect(options(html)).toEqual([
      { value: "7", selected: true },
      { value: "6.5", selected: false },
      { value: "9.5", selected: false },
    ]);
  });
});
