import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";

type RawSku = {
  style: string;
  colour: string;
  leather: string;
  is_new: boolean;
  _sourceColour?: string;
  _sourceLeather?: string;
};
type SavedSkuMeta = {
  style: string;
  colour: string;
  leather: string;
  isSize11?: boolean | null;
};
type SavedCustomStyle = {
  id: number;
  style: string;
  lastName: string;
  category: string;
  isSize11?: boolean | null;
};
type QueryCall = { input: unknown; options: unknown };

const fixture = vi.hoisted(() => ({
  rawSkus: [] as RawSku[],
  skuMeta: [] as SavedSkuMeta[],
  customStyleRows: [] as SavedCustomStyle[],
  cancelledSet: new Set<string>(),
  quantities: {} as Record<string, { totalAu: number }>,
  filter: "all",
  newness: "All",
  size11Only: false,
  expandedStyle: null as string | null,
  stateCall: 0,
  skuQueryCalls: [] as QueryCall[],
}));

// Match the existing StylesTab SSR scaffold: seed only the relevant state slots,
// retaining real React state, memoization and the actual component's resolution.
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: any) => {
      const index = fixture.stateCall++;
      const overrides: Record<number, unknown> = {
        2: fixture.newness,
        3: fixture.filter,
        8: fixture.size11Only,
        19: fixture.expandedStyle,
      };
      return actual.useState(index in overrides ? overrides[index] : initial);
    },
  };
});
vi.stubGlobal("React", React);
vi.mock("@/contexts/SeasonContext", () => ({
  useSeason: () => ({ season: "W27" }),
}));
vi.mock("@/hooks/useCancelledStyles", () => ({
  useCancelledStyles: () => ({ cancelledSet: fixture.cancelledSet, raw: [] }),
}));
vi.mock("@/hooks/useStyleCategories", () => ({
  useStyleCategories: () => ({
    getCategory: (_: unknown, category: string) => category,
    getTrendFlag: () => null,
    getTrends: () => [],
    allTrends: [],
  }),
}));
vi.mock("@/hooks/useCustomSkus", () => ({
  useCustomSkus: () => {
    const styleNames = new Set([
      ...fixture.rawSkus.map(sku => sku.style),
      ...fixture.customStyleRows.map(style => style.style),
    ]);
    return {
      customStyleRows: fixture.customStyleRows,
      customSkus: [],
      mergedRawSkus: fixture.rawSkus,
      mergedStyles: Array.from(styleNames).map(style => {
        const skus = fixture.rawSkus.filter(sku => sku.style === style);
        return {
          style,
          last: "TEST LAST",
          category: "DRESS SHOE",
          leathers: Array.from(new Set(skus.map(sku => sku.leather))),
          colours: skus.map(sku => sku.colour),
          totalSKUs: skus.length,
          newSKUs: skus.filter(sku => sku.is_new).length,
          existingSKUs: skus.filter(sku => !sku.is_new).length,
          hasNew: skus.some(sku => sku.is_new),
          isAllNew: skus.length > 0 && skus.every(sku => sku.is_new),
          _isCustomStyle: fixture.customStyleRows.some(
            row => row.style === style
          ),
        };
      }),
      refetch: vi.fn(),
      refetchImageOverrides: vi.fn(),
      refetchCustomStyles: vi.fn(),
    };
  },
}));
vi.mock("@/lib/trpc", () => {
  const endpoint = (path: string[] = []): any =>
    new Proxy(
      {},
      {
        get: (_, key: string) => {
          if (key === "useUtils") return () => endpoint();
          if (key === "useMutation")
            return () => ({
              mutate: vi.fn(),
              mutateAsync: vi.fn(),
              isPending: false,
            });
          if (key === "useQuery")
            return (input?: unknown, options?: unknown) => {
              const name = path.join(".");
              if (name === "sku.getAll")
                fixture.skuQueryCalls.push({ input, options });
              return {
                data:
                  name === "sku.getAll"
                    ? fixture.skuMeta
                    : name === "buy.getAllSessionQtys"
                      ? fixture.quantities
                      : name === "buy.getActive"
                        ? null
                        : [],
                isLoading: false,
                isError: false,
                refetch: vi.fn(),
              };
            };
          if (key === "invalidate") return vi.fn();
          return endpoint([...path, key]);
        },
      }
    );
  return { trpc: endpoint() };
});
vi.mock("@/components/dashboard/SkuDetailPanel", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/StylePricingCard", () => ({
  StylePricingCard: () => null,
}));
vi.mock("@/components/dashboard/LastMeasurementsPanel", () => ({
  LastMeasurementsPanel: () => null,
}));
vi.mock("@/components/dashboard/CostRequestImportDialog", () => ({
  CostRequestImportDialog: () => null,
}));
vi.mock("@/components/dashboard/BuySessionBar", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/EmailExportDialog", () => ({
  EmailExportDialog: () => null,
}));

import StylesTab from "@/components/dashboard/StylesTab";

function rawSku(style: string, colour: string, isNew = true): RawSku {
  return { style, colour, leather: "NAPPA", is_new: isNew };
}
function savedMeta(sku: RawSku, isSize11: boolean | null): SavedSkuMeta {
  return {
    style: sku.style,
    colour: sku.colour,
    leather: sku.leather,
    isSize11,
  };
}
function savedParent(
  style: string,
  isSize11: boolean | null
): SavedCustomStyle {
  return {
    id: 1,
    style,
    lastName: "TEST LAST",
    category: "DRESS SHOE",
    isSize11,
  };
}
function render(): string {
  fixture.stateCall = 0;
  return renderToStaticMarkup(React.createElement(StylesTab));
}
function styleRow(html: string, style: string): string {
  const row = html
    .match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)
    ?.find(candidate => candidate.includes(`>${style}</span>`));
  expect(row, `expected a rendered style row for ${style}`).toBeDefined();
  return row!;
}
function expectBadge(html: string, style: string): void {
  const nameCell = styleRow(html, style).match(
    /<td\b[^>]*>[\s\S]*?<\/td>/
  )?.[0];
  expect(
    nameCell,
    "badge belongs beside the style name, not only in the Size 11 column"
  ).toContain(`data-size11-style="${style}"`);
  expect(nameCell).toMatch(
    /<span\b[^>]*data-size11-style="[^"]+"[^>]*>SIZE 11<\/span>/
  );
  expect(styleRow(html, style)).toContain('title="Size 11 — click to remove"');
}
function expectNoBadge(html: string, style: string): void {
  expect(styleRow(html, style)).toContain('title="Mark as Size 11"');
  expect(html).not.toContain(`data-size11-style="${style}"`);
}

beforeEach(() =>
  Object.assign(fixture, {
    rawSkus: [],
    skuMeta: [],
    customStyleRows: [],
    cancelledSet: new Set<string>(),
    quantities: {},
    filter: "all",
    newness: "All",
    size11Only: false,
    expandedStyle: null,
    stateCall: 0,
    skuQueryCalls: [],
  })
);

describe("By Style saved Size 11 badge UI", () => {
  it("renders a visible blue SIZE 11 badge beside a collapsed style confirmed in every colourway", () => {
    fixture.rawSkus = [
      rawSku("CONFIRMED", "BLACK"),
      rawSku("CONFIRMED", "DOVE", false),
    ];
    fixture.skuMeta = fixture.rawSkus.map(sku => savedMeta(sku, true));

    const html = render();
    expectBadge(html, "CONFIRMED");
    expect(html.match(/data-size11-style="CONFIRMED"/g)).toHaveLength(1);
    const badge = html.match(
      /<span\b[^>]*data-size11-style="CONFIRMED"[^>]*>SIZE 11<\/span>/
    )?.[0];
    expect(badge).toContain("color:oklch(0.45 0.14 240)");
    expect(badge).not.toMatch(
      /aria-hidden="true"|display:none|visibility:hidden/
    );
    expect(html).not.toContain("Add colour");
  });

  it.each(["missing", "false", "null"] as const)(
    "leaves an unmarked style visible without a badge when saved metadata is %s",
    state => {
      fixture.rawSkus = [rawSku("UNMARKED", "BLACK")];
      fixture.skuMeta =
        state === "missing"
          ? []
          : [savedMeta(fixture.rawSkus[0], state === "false" ? false : null)];
      expectNoBadge(render(), "UNMARKED");
    }
  );

  it.each(["missing", "false", "null"] as const)(
    "does not badge a mixed style with one confirmed colourway and one %s colourway",
    state => {
      fixture.rawSkus = [rawSku("MIXED", "BLACK"), rawSku("MIXED", "DOVE")];
      fixture.skuMeta = [savedMeta(fixture.rawSkus[0], true)];
      if (state !== "missing")
        fixture.skuMeta.push(
          savedMeta(fixture.rawSkus[1], state === "false" ? false : null)
        );
      expectNoBadge(render(), "MIXED");
    }
  );

  it.each([
    { filter: "bought", newness: "All" },
    { filter: "unbought", newness: "All" },
    { filter: "bought", newness: "Has New SKUs" },
    { filter: "unbought", newness: "Has New SKUs" },
  ])(
    "does not infer eligibility from the reduced $filter / $newness colourway view",
    ({ filter, newness }) => {
      fixture.filter = filter;
      fixture.newness = newness;
      fixture.expandedStyle = "FILTERED-MIXED";
      const confirmed = rawSku("FILTERED-MIXED", "CONFIRMED-COLOUR");
      const unconfirmed = rawSku("FILTERED-MIXED", "UNCONFIRMED-COLOUR", false);
      fixture.rawSkus = [confirmed, unconfirmed];
      fixture.skuMeta = [
        savedMeta(confirmed, true),
        savedMeta(unconfirmed, false),
      ];
      const bought = filter === "bought" ? confirmed : unconfirmed;
      fixture.quantities[
        getSkuCompositeIdentity(bought.style, bought.colour, bought.leather)
      ] = { totalAu: 4 };

      const html = render();
      expect(html).toContain("Add colour"); // The real expanded colourway view is rendered.
      expect(html).toContain(">CONFIRMED-COLOUR</span>");
      expect(html).not.toContain(">UNCONFIRMED-COLOUR</span>");
      expectNoBadge(html, "FILTERED-MIXED");
    }
  );

  it("honours an explicit saved parent true even when child metadata is false or missing", () => {
    fixture.rawSkus = [
      rawSku("PARENT-TRUE", "BLACK"),
      rawSku("PARENT-TRUE", "DOVE"),
    ];
    fixture.skuMeta = [savedMeta(fixture.rawSkus[0], false)];
    fixture.customStyleRows = [savedParent("PARENT-TRUE", true)];
    expectBadge(render(), "PARENT-TRUE");
  });

  it("honours an explicit saved parent false even when all child colourways are confirmed", () => {
    fixture.rawSkus = [
      rawSku("PARENT-FALSE", "BLACK"),
      rawSku("PARENT-FALSE", "DOVE"),
    ];
    fixture.skuMeta = fixture.rawSkus.map(sku => savedMeta(sku, true));
    fixture.customStyleRows = [savedParent("PARENT-FALSE", false)];
    expectNoBadge(render(), "PARENT-FALSE");
  });

  it("falls back to every child colourway when the saved parent flag is null", () => {
    fixture.rawSkus = [
      rawSku("PARENT-NULL", "BLACK"),
      rawSku("PARENT-NULL", "DOVE"),
    ];
    fixture.skuMeta = fixture.rawSkus.map(sku => savedMeta(sku, true));
    fixture.customStyleRows = [savedParent("PARENT-NULL", null)];
    expectBadge(render(), "PARENT-NULL");
    fixture.skuMeta[1].isSize11 = false;
    expectNoBadge(render(), "PARENT-NULL");
  });

  it("honours a saved parent true for a custom style without colourways, but does not infer an empty style", () => {
    fixture.customStyleRows = [
      savedParent("EMPTY-CONFIRMED", true),
      { ...savedParent("EMPTY-UNMARKED", null), id: 2 },
    ];
    const html = render();
    expectBadge(html, "EMPTY-CONFIRMED");
    expectNoBadge(html, "EMPTY-UNMARKED");
  });

  it.each([true, false])(
    "resolves a corrected colour and leather against the original saved identity (saved %s)",
    isSize11 => {
      const corrected = {
        ...rawSku("CORRECTED", "IVORY"),
        leather: "SUEDE",
        _sourceColour: "BLACK",
        _sourceLeather: "NAPPA",
      };
      fixture.rawSkus = [corrected];
      fixture.skuMeta = [
        { style: "CORRECTED", colour: "BLACK", leather: "NAPPA", isSize11 },
        {
          style: "CORRECTED",
          colour: "IVORY",
          leather: "SUEDE",
          isSize11: !isSize11,
        },
      ];
      const html = render();
      if (isSize11) expectBadge(html, "CORRECTED");
      else expectNoBadge(html, "CORRECTED");
    }
  );

  it("excludes cancelled styles from both the rendered rows and the saved Size 11 badges", () => {
    fixture.rawSkus = [
      rawSku("LIVE", "BLACK"),
      rawSku("CANCELLED-SKU", "BLACK"),
      rawSku("CANCELLED-PARENT", "BLACK"),
    ];
    fixture.skuMeta = fixture.rawSkus.map(sku => savedMeta(sku, true));
    fixture.customStyleRows = [savedParent("CANCELLED-PARENT", true)];
    fixture.cancelledSet = new Set(["CANCELLED-SKU", "CANCELLED-PARENT"]);
    const html = render();
    expectBadge(html, "LIVE");
    for (const style of fixture.cancelledSet) {
      expect(html).not.toContain(`>${style}</span>`);
      expect(html).not.toContain(`data-size11-style="${style}"`);
    }
  });

  it("uses the same saved resolution for Size 11-only filtering and the name badge", () => {
    fixture.rawSkus = [
      rawSku("ALL-CONFIRMED", "BLACK"),
      rawSku("MIXED", "BLACK"),
      rawSku("MIXED", "DOVE"),
      rawSku("PARENT-OFF", "BLACK"),
    ];
    fixture.skuMeta = fixture.rawSkus.map(sku =>
      savedMeta(sku, sku.colour !== "DOVE")
    );
    fixture.customStyleRows = [savedParent("PARENT-OFF", false)];
    fixture.size11Only = true;
    const html = render();
    expectBadge(html, "ALL-CONFIRMED");
    expect(html).not.toContain(">MIXED</span>");
    expect(html).not.toContain(">PARENT-OFF</span>");
  });

  it("requests fresh authoritative metadata on mount and window focus", () => {
    render();
    expect(fixture.skuQueryCalls).toEqual([
      {
        input: undefined,
        options: {
          staleTime: 0,
          refetchOnMount: "always",
          refetchOnWindowFocus: "always",
        },
      },
    ]);
  });
});
