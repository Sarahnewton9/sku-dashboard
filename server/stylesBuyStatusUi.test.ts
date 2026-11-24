import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";

const fixture = vi.hoisted(() => ({ filter: "all", category: "All", season: "W27", loading: false, error: false, queryInputs: [] as any[] }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: any) => actual.useState(initial === "all" ? fixture.filter : initial === "All" && fixture.category !== "All" ? fixture.category : initial) };
});
vi.stubGlobal("React", React);
vi.mock("@/contexts/SeasonContext", () => ({ useSeason: () => ({ season: fixture.season }) }));
vi.mock("@/hooks/useCancelledStyles", () => ({ useCancelledStyles: () => ({ cancelledSet: new Set(["CANCELLED"]), raw: [] }) }));
vi.mock("@/hooks/useStyleCategories", () => ({ useStyleCategories: () => ({ getCategory: (_: any, category: string) => category, getTrendFlag: () => null, getTrends: () => [], allTrends: [] }) }));
vi.mock("@/hooks/useCustomSkus", () => ({ useCustomSkus: () => {
  const specs = [
    ["AU-ONLY", "BLACK"], ["USA-ONLY", "BLACK"], ["NYC-ONLY", "BLACK"], ["LA-ONLY", "BLACK"],
    ["MIXED", "BLACK"], ["MIXED", "DOVE"], ["UNBOUGHT", "BLACK"], ["CANCELLED", "BLACK"],
  ];
  return { customStyleRows: [], customSkus: [], mergedRawSkus: specs.map(([style, colour]) => ({ style, colour, leather: "NAPPA", is_new: true })),
    mergedStyles: Array.from(new Set(specs.map(([style]) => style))).map((style) => ({ style, last: "TEST LAST", category: "DRESS SHOE", leathers: ["NAPPA"], colours: ["BLACK"], totalSKUs: 1, newSKUs: 1, existingSKUs: 0, hasNew: true, isAllNew: true })) };
} }));
vi.mock("@/lib/trpc", () => {
  const endpoint = (path: string[] = []): any => new Proxy({}, { get: (_, key: string) => {
    if (key === "useUtils") return () => endpoint();
    if (key === "useMutation") return () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
    if (key === "useQuery") return (input?: any) => {
      const name = path.join(".");
      const quantities = Object.fromEntries([
        ["AU-ONLY", { totalAu: 1 }], ["USA-ONLY", { totalUsa: 2 }], ["NYC-ONLY", { totalNyc: 3 }], ["LA-ONLY", { totalLa: 4 }],
        ["MIXED", { totalAu: 5 }], ["CANCELLED", { totalAu: 100 }], ["OLD-COLOUR", { totalAu: 300 }],
      ].map(([style, quantity]) => [getSkuCompositeIdentity(style as string, "BLACK", "NAPPA"), quantity]));
      if (name === "buy.getAllSessionQtys") fixture.queryInputs.push(input);
      return { data: name === "buy.getAllSessionQtys" ? quantities : name === "buy.getActive" ? null : [],
        isLoading: name === "buy.getAllSessionQtys" && fixture.loading,
        isError: name === "buy.getAllSessionQtys" && fixture.error, refetch: vi.fn() };
    };
    if (key === "invalidate") return vi.fn();
    return endpoint([...path, key]);
  } });
  return { trpc: endpoint() };
});
vi.mock("@/components/dashboard/SkuDetailPanel", () => ({ default: () => null }));
vi.mock("@/components/dashboard/StylePricingCard", () => ({ StylePricingCard: () => null }));
vi.mock("@/components/dashboard/LastMeasurementsPanel", () => ({ LastMeasurementsPanel: () => null }));
vi.mock("@/components/dashboard/CostRequestImportDialog", () => ({ CostRequestImportDialog: () => null }));
vi.mock("@/components/dashboard/BuySessionBar", () => ({ default: () => null }));
vi.mock("@/components/dashboard/EmailExportDialog", () => ({ EmailExportDialog: () => null }));
import StylesTab from "@/components/dashboard/StylesTab";
const render = () => renderToStaticMarkup(React.createElement(StylesTab));
beforeEach(() => Object.assign(fixture, { filter: "all", category: "All", season: "W27", loading: false, error: false, queryInputs: [] }));

describe("By Style buy status filter UI", () => {
  it("renders all three accessible buy status options beside the existing filters", () => {
    const html = render();
    expect(html).toContain('aria-label="Buy status"');
    expect(html).toContain('value="bought"');
    expect(html).toContain('value="unbought"');
    expect(html).toContain('>UNBOUGHT<');
    expect(html).toContain('>LA-ONLY<');
    expect(html).not.toContain('>CANCELLED<');
  });
  it("includes every market-only bought style and mixed styles when bought is selected", () => {
    fixture.filter = "bought";
    const html = render();
    for (const style of ["AU-ONLY", "USA-ONLY", "NYC-ONLY", "LA-ONLY", "MIXED"]) expect(html).toContain(`>${style}<`);
    expect(html).not.toContain('>UNBOUGHT<');
    expect(html).toContain('5 of 6 styles');
    expect(html).toContain('Clear filters');
  });
  it("shows only wholly unbought styles and not partly bought styles", () => {
    fixture.filter = "unbought";
    const html = render();
    expect(html).toContain('>UNBOUGHT<');
    expect(html).not.toContain('>MIXED<');
    expect(html).not.toContain('>LA-ONLY<');
    expect(html).toContain('1 of 6 styles');
  });
  it("queries combined quantities for the active season rather than a selected session", () => {
    fixture.filter = "bought"; fixture.season = "SS26";
    expect(render()).toContain('All SS26 buy sessions');
    expect(fixture.queryInputs).toEqual([{ season: "SS26" }]);
  });
  it("does not misclassify unloaded quantities as unbought", () => {
    fixture.filter = "unbought"; fixture.loading = true;
    const html = render();
    expect(html).not.toContain('>UNBOUGHT<');
    expect(html).toContain('Loading buy quantities');
    expect(html).toMatch(/aria-label="Buy status"[^>]*disabled/);
  });
  it("does not misclassify a failed quantity query as unbought", () => {
    fixture.filter = "unbought"; fixture.error = true;
    const html = render();
    expect(html).not.toContain('>UNBOUGHT<');
    expect(html).toContain('Buy quantities could not be loaded');
  });
});
