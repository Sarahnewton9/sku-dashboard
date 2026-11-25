import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  season: "SS26",
  rawSkus: [] as any[],
  styles: [] as any[],
  data: {} as Record<string, any[]>,
  queries: [] as Array<{ name: string; input: unknown; options: any }>,
  memoIndex: 0,
  memos: [] as Array<{ dependencies: readonly unknown[]; value: unknown }>,
}));
// Model React's useMemo dependency comparison across hook evaluations without a
// DOM or live tRPC client. This also catches stale derived metadata lookups.
vi.mock("react", () => ({ useMemo: (compute: () => unknown, dependencies: readonly unknown[]) => {
  const index = fixture.memoIndex++;
  const previous = fixture.memos[index];
  if (previous && dependencies.length === previous.dependencies.length && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return previous.value;
  const value = compute();
  fixture.memos[index] = { dependencies, value };
  return value;
} }));
vi.mock("@/contexts/SeasonContext", () => ({ useSeason: () => ({ season: fixture.season }) }));
vi.mock("@/lib/skuData", () => ({ skuData: {
  get rawSkus() { return fixture.rawSkus; },
  get styles() { return fixture.styles; },
} }));
vi.mock("@/lib/trpc", () => {
  const endpoint = (path: string[] = []): any => new Proxy({}, { get: (_, key: string) => {
    if (key === "useQuery") return (input: unknown, options: unknown) => {
      const name = path.join(".");
      fixture.queries.push({ name, input, options });
      return { data: fixture.data[name] ?? [], isLoading: false, refetch: vi.fn() };
    };
    return endpoint([...path, key]);
  } });
  return { trpc: endpoint() };
});

import { useCustomSkus } from "../client/src/hooks/useCustomSkus";
const single = { style: "RORY", colour: "VANILLA", leather: "NAPPA", is_new: true };
const royal = { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE", is_new: true };
const lipstick = { ...royal, colour2: "LIPSTICK" };
const runHook = () => { fixture.memoIndex = 0; return useCustomSkus(); };

beforeEach(() => {
  fixture.season = "SS26";
  fixture.rawSkus = [single];
  fixture.styles = [{ style: "RORY", last: "TEST", category: "DRESS SHOE" }];
  fixture.data = Object.fromEntries(["customSku.getAll", "markdown.list", "cancelledSku.list", "cancelledSku.listExact", "styleImage.getAll", "skuNewOverride.getAll", "sku.getAll", "customStyle.getAll", "style.getAll", "style.getImages"].map(name => [name, []]));
  fixture.queries = [];
  fixture.memos = [];
  fixture.memoIndex = 0;
});

describe("useCustomSkus CORE enrichment", () => {
  it("adds a strict boolean to every row; CORE overrides effective newness and style counts only", () => {
    const meta = [{ ...single, isCore: true }];
    const overrides = [{ style: "RORY", colour: "__all__", leather: "", isNew: true }];
    fixture.data["sku.getAll"] = meta;
    fixture.data["skuNewOverride.getAll"] = overrides;
    const result = runHook();
    expect(result.mergedRawSkus).toEqual([{ ...single, is_core: true, is_new: false }]);
    expect(result.mergedStyles[0]).toMatchObject({ totalSKUs: 1, newSKUs: 0, hasNew: false, isAllNew: false });
    expect(single.is_new).toBe(true);
    expect(meta[0].isCore).toBe(true);
    expect(overrides[0].isNew).toBe(true);
  });

  it("keeps non-core false and existing new/seasonal override behavior unchanged", () => {
    expect(runHook().mergedRawSkus[0]).toMatchObject({ is_core: false, is_new: true });
    fixture.season = "W27";
    expect(runHook().mergedRawSkus[0]).toMatchObject({ is_core: false, is_new: false });
    fixture.data["skuNewOverride.getAll"] = [{ ...single, isNew: true }];
    expect(runHook().mergedRawSkus[0]).toMatchObject({ is_core: false, is_new: true });
  });

  it("classifies custom CORE SKUs without changing raw isNew or adding metadata-only rows", () => {
    const custom = { id: 7, style: "RORY", colour: "BLACK", leather: "NAPPA", isNew: true };
    fixture.data["customSku.getAll"] = [custom];
    fixture.data["sku.getAll"] = [{ ...custom, isCore: true }, { style: "UNLISTED", colour: "BLACK", leather: "NAPPA", isCore: true }];
    const result = runHook();
    expect(result.mergedRawSkus).toHaveLength(2);
    expect(result.mergedRawSkus[1]).toMatchObject({ _customId: 7, is_core: true, is_new: false });
    expect(result.customSkus[0].isNew).toBe(true);
    expect(result.mergedStyles[0]).toMatchObject({ totalSKUs: 2, newSKUs: 1 });
  });

  it("retains approved custom CORE through an identity correction via its stable row flag", () => {
    const old = { id: 8, style: "RORY", colour: "BLACK", leather: "NAPPA", isNew: true, isCore: true };
    fixture.data["customSku.getAll"] = [old];
    fixture.data["sku.getAll"] = [{ ...old, isCore: true }];
    expect(runHook().mergedRawSkus[1]).toMatchObject({ _customId: 8, is_core: true, is_new: false });
    fixture.data["customSku.getAll"] = [{ ...old, colour: "DOVE", leather: "SUEDE", colour2: "BLACK", leather2: "PATENT" }];
    const result = runHook();
    expect(result.mergedRawSkus[1]).toMatchObject({ _customId: 8, colour: "DOVE", leather: "SUEDE", colour2: "BLACK", leather2: "PATENT", is_core: true, is_new: false });
    expect(result.customSkus[0]).toMatchObject({ isCore: true, isNew: true });
    expect(result.mergedRawSkus).toHaveLength(2);
  });

  it("requires explicit boolean true for custom row CORE but can also use exact metadata", () => {
    for (const flag of [undefined, false, null, "true", 1]) {
      fixture.data["customSku.getAll"] = [{ id: 9, style: "RORY", colour: "BLACK", leather: "NAPPA", isNew: true, isCore: flag }];
      expect(runHook().mergedRawSkus[1]).toMatchObject({ is_core: false, is_new: true });
    }
    fixture.data["sku.getAll"] = [{ style: "RORY", colour: "BLACK", leather: "NAPPA", isCore: true }];
    expect(runHook().mergedRawSkus[1]).toMatchObject({ is_core: true, is_new: false });
  });

  it("never leaks a custom row CORE flag to a sibling Upper 2", () => {
    fixture.rawSkus = [];
    fixture.data["customSku.getAll"] = [{ ...royal, id: 1, isNew: true, isCore: true }, { ...lipstick, id: 2, isNew: true }];
    expect(runHook().mergedRawSkus.map(sku => [sku.colour2, sku.is_core, sku.is_new])).toEqual([["ROYAL", true, false], ["LIPSTICK", false, true]]);
  });

  it("resolves source-aware descriptions and a corrected display metadata key", () => {
    fixture.data["sku.getAll"] = [{ ...single, colourOverride: "PETAL", leatherOverride: "SUEDE", isCore: true }];
    expect(runHook().mergedRawSkus[0]).toMatchObject({ colour: "PETAL", leather: "SUEDE", _sourceColour: "VANILLA", _sourceLeather: "NAPPA", is_core: true, is_new: false });
    fixture.data["sku.getAll"] = [{ ...single, colourOverride: "PETAL", leatherOverride: "SUEDE" }, { ...single, colour: "PETAL", leather: "SUEDE", isCore: true }];
    // An unset saved source is strictly non-core, even if a display row is true.
    expect(runHook().mergedRawSkus[0].is_core).toBe(false);
  });

  it("does not collapse static Upper 2 siblings when exact CORE metadata arrives", () => {
    fixture.rawSkus = [royal, lipstick];
    fixture.styles = [{ style: "ROBYN", last: "TEST", category: "DRESS SHOE" }];
    fixture.data["sku.getAll"] = [{ ...royal, isCore: true }];
    const result = runHook();
    expect(result.mergedRawSkus.map(sku => [sku.colour2, sku.is_core, sku.is_new])).toEqual([["ROYAL", true, false], ["LIPSTICK", false, true]]);
    expect(result.mergedStyles[0]).toMatchObject({ totalSKUs: 2, newSKUs: 1 });
  });

  it("does not leak a single-upper flag to a sole Upper 2 or custom sibling", () => {
    fixture.rawSkus = [royal];
    fixture.data["customSku.getAll"] = [{ ...lipstick, id: 3, isNew: true }];
    fixture.data["sku.getAll"] = [{ style: royal.style, colour: royal.colour, leather: royal.leather, isCore: true }];
    expect(runHook().mergedRawSkus.map(sku => sku.is_core)).toEqual([false, false]);
  });

  it("rebuilds the effective flags and counts on metadata updates, including explicit reset", () => {
    expect(runHook().mergedRawSkus[0].is_core).toBe(false);
    fixture.data["sku.getAll"] = [{ ...single, isCore: true }];
    expect(runHook().mergedRawSkus[0]).toMatchObject({ is_core: true, is_new: false });
    fixture.data["sku.getAll"] = [{ ...single, isCore: false }];
    const result = runHook();
    expect(result.mergedRawSkus[0]).toMatchObject({ is_core: false, is_new: true });
    expect(result.mergedStyles[0].newSKUs).toBe(1);
  });

  it("does not revive markdown, cancelled physical SKUs or seasonally hidden styles", () => {
    fixture.season = "W27";
    const marked = { ...single, style: "MARKED" };
    const hidden = { ...single, style: "HIDDEN" };
    fixture.rawSkus = [single, royal, lipstick, marked, hidden];
    fixture.styles = [single, royal, marked, hidden].map(sku => ({ style: sku.style, last: "TEST", category: sku.style === "HIDDEN" ? "FLAT SANDAL" : "DRESS SHOE" }));
    fixture.data["sku.getAll"] = fixture.rawSkus.map(sku => ({ ...sku, isCore: true }));
    fixture.data["markdown.list"] = [{ styleCode: "MARKED", colour: "VANILLA NAPPA", status: "markdown" }];
    fixture.data["cancelledSku.listExact"] = [royal];
    const result = runHook();
    expect(result.mergedRawSkus.map(sku => [sku.style, sku.colour2])).toEqual([["RORY", undefined], ["ROBYN", "LIPSTICK"]]);
    expect(result.mergedRawSkus.every(sku => sku.is_core && !sku.is_new)).toBe(true);
  });

  it("retains exact deduplication and does not insert additional CORE copies", () => {
    fixture.rawSkus = [single, { ...single }];
    fixture.data["customSku.getAll"] = [{ ...single, id: 3, isNew: true }];
    fixture.data["sku.getAll"] = [{ ...single, isCore: true }, { ...single, colour2: null, leather2: null, isCore: true }];
    expect(runHook().mergedRawSkus).toHaveLength(1);
  });

  it("refreshes sku metadata on every mount and focus, even with warm cached data", () => {
    runHook();
    expect(fixture.queries.find(query => query.name === "sku.getAll")?.options).toMatchObject({ staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: "always" });
  });
});
