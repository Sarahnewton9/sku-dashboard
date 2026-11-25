import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";

type RawSku = { style: string; colour: string; leather: string; colour2?: string; leather2?: string; is_new: boolean; is_core?: boolean; _sourceColour?: string; _sourceLeather?: string };
const fixture = vi.hoisted(() => ({
  target: "styles", stateCall: 0, range: "all-range", buy: "all", newness: "All", expanded: null as string | null,
  size11: false, selected: null as string | null, raw: [] as RawSku[], meta: [] as any[],
  quantities: {} as Record<string, any>, cancelledStyles: new Set<string>(), cancelled: [] as any[], exactCancelled: [] as any[],
  queryCalls: [] as Array<{ name: string; input: unknown; options: unknown }>,
  customRows: [] as any[],
}));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: any) => {
    const index = fixture.stateCall++;
    const overrides: Record<number, unknown> = fixture.target === "styles"
      ? { 2: fixture.newness, 3: fixture.buy, 8: fixture.size11, 19: fixture.expanded }
      : fixture.target === "specs" ? { 0: fixture.selected } : {};
    return actual.useState(index in overrides ? overrides[index] : initial === "all-range" ? fixture.range : initial);
  } };
});
vi.stubGlobal("React", React);
vi.mock("@/contexts/SeasonContext", () => ({ useSeason: () => ({ season: "W27" }) }));
vi.mock("@/hooks/useCancelledStyles", () => ({ useCancelledStyles: () => ({ cancelledSet: fixture.cancelledStyles, raw: [] }) }));
vi.mock("@/hooks/useStyleCategories", () => ({ useStyleCategories: () => ({ getCategory: (_: unknown, category: string) => category, getTrendFlag: () => null, getTrends: () => [], allTrends: [] }) }));
vi.mock("@/hooks/useCustomSkus", () => ({ useCustomSkus: () => ({
  customStyleRows: [], customSkus: [], mergedRawSkus: fixture.raw,
  mergedStyles: Array.from(new Set(fixture.raw.map(sku => sku.style))).map(style => {
    const skus = fixture.raw.filter(sku => sku.style === style);
    return { style, category: "DRESS SHOE", last: "TEST LAST", leathers: Array.from(new Set(skus.map(sku => sku.leather))), colours: skus.map(sku => sku.colour), totalSKUs: skus.length, newSKUs: skus.filter(sku => sku.is_new).length, existingSKUs: skus.filter(sku => !sku.is_new).length, hasNew: skus.some(sku => sku.is_new), isAllNew: skus.every(sku => sku.is_new) };
  }), refetch: vi.fn(), refetchImageOverrides: vi.fn(), refetchCustomStyles: vi.fn(),
}) }));
vi.mock("@/lib/trpc", () => {
  const endpoint = (path: string[] = []): any => new Proxy({}, { get: (_, key: string) => {
    if (key === "useUtils") return () => endpoint();
    if (key === "useMutation") return () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
    if (key === "useQuery") return (input?: unknown, options?: unknown) => {
      const name = path.join(".");
      fixture.queryCalls.push({ name, input, options });
      const objects: Record<string, unknown> = {
        "customSku.getAll": fixture.customRows,
        "sku.getAll": fixture.meta, "buy.getAllSessionQtys": fixture.quantities, "buy.getActive": null,
        "cancelledSku.list": fixture.cancelled, "cancelledSku.listExact": fixture.exactCancelled,
        "styles.listCancelled": Array.from(fixture.cancelledStyles, style => ({ style })),
        "specHiddenColumns.getHidden": { hidden: [] }, "specRowOrder.get": { rowKeys: [], hiddenRows: [] },
        "specs.getMeta": null, "ap21SizeRange.getAll": {}, "ap21Refs.getStyleRefs": null,
      };
      return { data: name in objects ? objects[name] : [], isLoading: false, isError: false, refetch: vi.fn() };
    };
    if (key === "invalidate") return vi.fn();
    return endpoint([...path, key]);
  } });
  return { trpc: endpoint() };
});
vi.mock("@/components/dashboard/StylePricingCard", () => ({ StylePricingCard: () => null }));
vi.mock("@/components/dashboard/LastMeasurementsPanel", () => ({ LastMeasurementsPanel: () => null }));
vi.mock("@/components/dashboard/CostRequestImportDialog", () => ({ CostRequestImportDialog: () => null }));
vi.mock("@/components/dashboard/BuySessionBar", () => ({ default: () => null }));
vi.mock("@/components/dashboard/EmailExportDialog", () => ({ EmailExportDialog: () => null }));
vi.mock("@/components/dashboard/EmailSpecDialog", () => ({ EmailSpecDialog: () => null }));
import StylesTab from "@/components/dashboard/StylesTab";
import SkuDetailPanel, { type SkuPanelData } from "@/components/dashboard/SkuDetailPanel";
import SpecsTab from "@/components/dashboard/SpecsTab";

const raw = (style: string, colour: string, status: "core" | "carryover" | "new" = "core", extra: Partial<RawSku> = {}): RawSku => ({ style, colour, leather: "NAPPA", is_new: status === "new", is_core: status === "core", ...extra });
const key = (sku: RawSku) => getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2);
function renderStyles() { fixture.target = "styles"; fixture.stateCall = 0; return renderToStaticMarkup(React.createElement(StylesTab)); }
function styleRow(html: string, style: string) { return html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)?.find(row => row.includes(`>${style}</span>`)) ?? ""; }
function panel(sku: Partial<SkuPanelData> = {}) {
  fixture.target = "panel"; fixture.stateCall = 0;
  return renderToStaticMarkup(React.createElement(SkuDetailPanel, {
    sku: { style: "MIXED", colour: "BLACK", leather: "NAPPA", category: "DRESS SHOE", last: "TEST LAST", isNew: false, ...sku },
    season: "W27", onClose: vi.fn(), onMetaChange: vi.fn(), skuMeta: {}, styleMeta: {},
  }));
}
function specs() { fixture.target = "specs"; fixture.stateCall = 0; return renderToStaticMarkup(React.createElement(SpecsTab, {})); }
beforeEach(() => Object.assign(fixture, { target: "styles", stateCall: 0, range: "all-range", buy: "all", newness: "All", expanded: null, size11: false, selected: null, raw: [], meta: [], quantities: {}, cancelledStyles: new Set<string>(), cancelled: [], exactCancelled: [], queryCalls: [], customRows: [] }));

describe("By Style exact core UI", () => {
  it("always renders an accessible range dropdown with every status even with More Filters closed", () => {
    const html = renderStyles();
    expect(html).toContain('aria-label="Range status"');
    for (const label of ["All range statuses", "Core", "Carry-over", "New SKUs"]) expect(html).toContain(`>${label}</option>`);
    expect(html).not.toContain('>Sample Status</label>');
  });
  it("badges a core colourway without retagging carry-over and new siblings or assigning development controls", () => {
    fixture.raw = [raw("MIXED", "BLACK"), raw("MIXED", "DOVE", "carryover"), raw("MIXED", "MINT", "new")];
    fixture.expanded = "MIXED";
    const html = renderStyles();
    expect(styleRow(html, "MIXED")).toContain('data-core-style="MIXED"');
    expect(styleRow(html, "MIXED")).toContain('Has 1 core colourway; other colourways may be carry-over or new.');
    expect(html.match(/title="Core colourway"/g)).toHaveLength(1);
    for (const sku of fixture.raw) expect(html).toContain(`data-range-sku="${key(sku)}" data-range-status="${sku.is_core ? "core" : sku.is_new ? "new" : "carryover"}"`);
    expect(html.match(/title="Mark sample as received"/g)).toHaveLength(1);
  });
  it.each(["core", "carryover", "new"])("shows only exact matching expanded colourways for %s", range => {
    fixture.range = range; fixture.expanded = "MIXED";
    fixture.raw = [raw("MIXED", "BLACK"), raw("MIXED", "DOVE", "carryover"), raw("MIXED", "MINT", "new"), raw("OTHER", "UNRELATED", "carryover")];
    const html = renderStyles();
    for (const sku of fixture.raw.filter(sku => sku.style === "MIXED")) {
      if ((sku.is_core ? "core" : sku.is_new ? "new" : "carryover") === range) expect(html).toContain(`data-range-sku="${key(sku)}"`);
      else expect(html).not.toContain(`data-range-sku="${key(sku)}"`);
    }
    expect(html).toContain("Clear filters");
    if (range !== "carryover") expect(html).not.toContain('>OTHER</span>');
  });
  it("intersects core and bought on the same physical SKU, including Upper 2", () => {
    const core = raw("NO-MATCH", "ECRU", "core", { leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" });
    const carryover = { ...core, colour2: "LIPSTICK", is_core: false };
    const matching = raw("MATCH", "BLACK");
    fixture.raw = [core, carryover, matching]; fixture.range = "core"; fixture.buy = "bought";
    fixture.quantities[key(carryover)] = { totalAu: 24 }; fixture.quantities[key(matching)] = { totalLa: 12 };
    expect(renderStyles()).not.toContain('>NO-MATCH</span>');
    expect(renderStyles()).toContain('>MATCH</span>');
    fixture.buy = "unbought"; fixture.expanded = "NO-MATCH";
    const html = renderStyles();
    expect(html).toContain(`data-range-sku="${key(core)}"`);
    expect(html).not.toContain(`data-range-sku="${key(carryover)}"`);
  });
  it("does not combine a new sibling and a core sibling to match core plus Has New SKUs", () => {
    fixture.raw = [raw("MIXED", "BLACK"), raw("MIXED", "MINT", "new")]; fixture.range = "core"; fixture.newness = "Has New SKUs";
    expect(renderStyles()).not.toContain('>MIXED</span>');
    fixture.range = "new";
    expect(renderStyles()).toContain('>MIXED</span>');
  });
  it("keeps style totals and all-colourway size eligibility unchanged by the core filter", () => {
    const core = raw("MIXED", "BLACK"); const carryover = raw("MIXED", "DOVE", "carryover");
    fixture.raw = [core, carryover]; fixture.expanded = "MIXED";
    fixture.meta = [{ ...core, isSize11: true }, { ...carryover, isSize11: false }];
    fixture.quantities = { [key(core)]: { totalAu: 10 }, [key(carryover)]: { totalLa: 20 } };
    const fullRow = styleRow(renderStyles(), "MIXED"); fixture.range = "core";
    const html = renderStyles();
    expect(styleRow(html, "MIXED")).toBe(fullRow);
    expect(html).not.toContain('data-size11-style="MIXED"');
    expect(html).not.toContain(`data-range-sku="${key(carryover)}"`);
    fixture.size11 = true;
    expect(renderStyles()).not.toContain('>MIXED</span>');
  });
  it("excludes cancelled core styles and colourways but preserves an uncancelled Upper 2 sibling", () => {
    const royal = raw("VARIANT", "ECRU", "core", { leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" });
    const lipstick = { ...royal, colour2: "LIPSTICK" };
    fixture.raw = [royal, lipstick, raw("CANCELLED-STYLE", "BLACK"), raw("CANCELLED-SKU", "BLACK")];
    fixture.exactCancelled = [royal]; fixture.cancelled = [fixture.raw[3]]; fixture.cancelledStyles.add("CANCELLED-STYLE");
    fixture.range = "core"; fixture.expanded = "VARIANT";
    const html = renderStyles();
    expect(html).not.toContain(`data-range-sku="${key(royal)}"`);
    expect(html).toContain(`data-range-sku="${key(lipstick)}"`);
    expect(html).not.toContain('>CANCELLED-STYLE</span>'); expect(html).not.toContain('>CANCELLED-SKU</span>');
  });
  it("honours cancellation under original source keys after a display correction", () => {
    fixture.raw = [raw("CORRECTED", "IVORY", "core", { leather: "SUEDE", _sourceColour: "BLACK", _sourceLeather: "NAPPA" })];
    fixture.cancelled = [{ style: "CORRECTED", colour: "BLACK", leather: "NAPPA" }]; fixture.range = "core";
    expect(renderStyles()).not.toContain('>CORRECTED</span>');
  });
  it("preserves existing buy/newness/expansion state slots and queries active-season quantities", () => {
    fixture.raw = [raw("STATE-SLOTS", "BLACK", "new"), raw("STATE-SLOTS", "DOVE", "carryover")];
    fixture.buy = "unbought"; fixture.newness = "Has New SKUs"; fixture.expanded = "STATE-SLOTS";
    const html = renderStyles();
    expect(html).toContain("Add colour"); expect(html).toContain('>BLACK</span>'); expect(html).not.toContain('>DOVE</span>');
    expect(fixture.queryCalls.filter(call => call.name === "buy.getAllSessionQtys").map(call => call.input)).toEqual([{ season: "W27" }]);
  });
});

describe("SKU detail core status", () => {
  it("shows saved CORE instead of NEW and never adds sample/order development requirements", () => {
    fixture.meta = [{ style: "MIXED", colour: "BLACK", leather: "NAPPA", isCore: true }];
    const html = panel({ isNew: true });
    expect(html).toContain('>CORE</span>'); expect(html).not.toContain('>NEW</span>');
    expect(html).not.toContain("Sample Status"); expect(html).not.toContain("Order Qty"); expect(html).toContain("FOB (USD)");
    expect(fixture.queryCalls.find(call => call.name === "sku.getAll")?.options).toEqual({ enabled: true, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: "always" });
  });
  it("does not borrow core from another leather or Upper 2 when navigating", () => {
    fixture.meta = [{ style: "MIXED", colour: "BLACK", leather: "NAPPA", isCore: true }];
    expect(panel({ leather: "SUEDE", isNew: true })).not.toContain('>CORE</span>');
    expect(panel({ colour2: "DOVE", leather2: "SUEDE", isNew: true })).toContain("Sample Status");
  });
  it("refreshes a stale raw core flag and honours corrected original identities", () => {
    fixture.meta = [{ style: "MIXED", colour: "BLACK", leather: "NAPPA", isCore: false }];
    expect(panel({ isCore: true })).not.toContain('>CORE</span>');
    fixture.meta[0].isCore = true;
    expect(panel({ colour: "IVORY", leather: "SUEDE", _sourceColour: "BLACK", _sourceLeather: "NAPPA" })).toContain('>CORE</span>');
  });
  it("fails closed when persisted exact copies disagree rather than selecting a true row arbitrarily", () => {
    fixture.meta = [{ style: "MIXED", colour: "BLACK", leather: "NAPPA", isCore: true }, { style: "MIXED", colour: "BLACK", leather: "NAPPA", isCore: false }];
    expect(panel({ isCore: true })).not.toContain('>CORE</span>');
  });
  it("uses the fresh stable custom-SKU flag even when raw navigation data is stale false", () => {
    fixture.customRows = [{ id: 17, style: "MIXED", colour: "BLACK", leather: "NAPPA", isCore: true }];
    expect(panel({ _customId: 17, isCore: false, isNew: true })).toContain('>CORE</span>');
    expect(panel({ _customId: 18, isCore: false })).not.toContain('>CORE</span>');
    expect(fixture.queryCalls.find(call => call.name === "customSku.getAll")?.input).toEqual({ season: "W27" });
  });
});

describe("Specs exact core badges", () => {
  it("badges core-containing styles but not carry-over siblings or cancelled whole styles", () => {
    fixture.raw = [raw("CORE-STYLE", "BLACK"), raw("CARRYOVER", "DOVE", "carryover"), raw("CANCELLED", "BLACK")];
    fixture.cancelledStyles.add("CANCELLED");
    const html = specs();
    expect(html).toContain('data-core-spec-style="CORE-STYLE"');
    expect(html).not.toContain('data-core-spec-style="CARRYOVER"'); expect(html).not.toContain('data-core-spec-style="CANCELLED"');
    expect(html).not.toContain("To Be Completed");
  });
  it("shows CORE only on the matching physical column and leaves spec counts and labels intact", () => {
    fixture.raw = [raw("MIXED", "BLACK"), raw("MIXED", "BLACK", "carryover", { leather: "SUEDE" })]; fixture.selected = "MIXED";
    const html = specs();
    expect(html).toContain('data-core-spec-colour="BLACK NAPPA"');
    expect(html).not.toContain('data-core-spec-colour="BLACK SUEDE"');
    expect(html).toContain("2 colours · 2 SKUs"); expect(html).toContain("BLACK SUEDE"); expect(html).not.toContain("New Pattern");
  });
});
