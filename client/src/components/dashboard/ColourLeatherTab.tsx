/**
 * Colour/Leather Tab
 * Design: Refined Analytical Dashboard — warm off-white, Sora + Inter typography, amber accents
 * Groups all SKUs by their colour+leather combination (e.g. "TURQUOISE SUEDE"),
 * sorted alphabetically. Each row is collapsible to show all styles using that combo,
 * with shoe image thumbnails and New/Existing badges.
 */
import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, Star } from "lucide-react";
import { skuData } from "@/lib/skuData";
import { trpc } from "@/lib/trpc";

interface ComboSku {
  style: string;
  category: string;
  last: string;
  isNew: boolean;
  imageUrl: string;
}

interface Combo {
  key: string;
  colour: string;
  leather: string;
  totalCount: number;
  newCount: number;
  existingCount: number;
  skus: ComboSku[];
}

function buildCombos(): Combo[] {
  const map = new Map<string, Combo>();

  for (const style of skuData.styles) {
    for (const sku of (style as any).rawSkus ?? []) {
      const col: string = sku.colour ?? "";
      const lth: string = sku.leather ?? "";
      const key = `${col} ${lth}`.trim();
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, {
          key,
          colour: col,
          leather: lth,
          totalCount: 0,
          newCount: 0,
          existingCount: 0,
          skus: [],
        });
      }
      const combo = map.get(key)!;
      combo.totalCount++;
      if (sku.isNew) combo.newCount++;
      else combo.existingCount++;
      combo.skus.push({
        style: style.style,
        category: style.category,
        last: style.last,
        isNew: sku.isNew,
        imageUrl: style.imageUrl ?? "",
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

// Build combos from rawSkus embedded in skuData
function buildCombosFromRaw(): Combo[] {
  const map = new Map<string, Combo>();
  const rawSkus: Array<{
    style: string; category: string; last: string;
    colour: string; leather: string; is_new: boolean;
  }> = (skuData as any).rawSkus ?? [];

  // Build a quick imageUrl lookup
  const imageMap = new Map<string, string>();
  for (const s of skuData.styles) {
    imageMap.set(s.style, (s as any).imageUrl ?? "");
  }

  for (const sku of rawSkus) {
    const col = sku.colour ?? "";
    const lth = sku.leather ?? "";
    const key = `${col} ${lth}`.trim();
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, {
        key,
        colour: col,
        leather: lth,
        totalCount: 0,
        newCount: 0,
        existingCount: 0,
        skus: [],
      });
    }
    const combo = map.get(key)!;
    combo.totalCount++;
      if (sku.is_new) combo.newCount++;
      else combo.existingCount++;
      combo.skus.push({
        style: sku.style,
        category: sku.category,
        last: sku.last,
        isNew: sku.is_new,
      imageUrl: imageMap.get(sku.style) ?? "",
    });
  }

  return Array.from(map.values()).sort((a, b) => b.totalCount - a.totalCount || a.key.localeCompare(b.key));
}

// ALL_COMBOS is now built dynamically inside the component to include custom SKUs

export default function ColourLeatherTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "existing">("all");
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  // Fetch custom SKUs from DB so they appear like regular SKUs
  const { data: customSkusRaw = [] } = trpc.customSku.getAll.useQuery();

  // Fetch cancelled styles and cancelled SKUs so they can be filtered out
  const { data: cancelledStylesRaw = [] } = trpc.styles.listCancelled.useQuery();
  const { data: cancelledSkusRaw = [] } = trpc.cancelledSku.list.useQuery();

  const cancelledStyleSet = useMemo(
    () => new Set((cancelledStylesRaw as any[]).map((r: any) => r.style as string)),
    [cancelledStylesRaw]
  );

  const cancelledSkuSet = useMemo(
    () =>
      new Set(
        (cancelledSkusRaw as Array<{ style: string; colour: string; leather: string }>).map(
          (s) => `${s.style}|${s.colour}|${s.leather}`
        )
      ),
    [cancelledSkusRaw]
  );

  // Build combos dynamically, merging custom SKUs into the static data
  const ALL_COMBOS = useMemo(() => {
    // Build image map from static styles
    const imageMap = new Map<string, string>();
    for (const s of skuData.styles) imageMap.set(s.style, (s as any).imageUrl ?? "");

    // Build style info map for category/last
    const styleInfoMap = new Map<string, { category: string; last: string }>();
    for (const s of skuData.styles) styleInfoMap.set(s.style, { category: s.category, last: s.last });

    // Combine static rawSkus + custom SKUs, then filter cancelled styles and cancelled SKUs
    const existingKeys = new Set(skuData.rawSkus.map((s) => `${s.style}|${s.colour}|${s.leather}`));
    const customEntries = (customSkusRaw as Array<{ style: string; colour: string; leather: string }>)
      .filter((c) => !existingKeys.has(`${c.style}|${c.colour}|${c.leather}`))
      .map((c) => ({ style: c.style, colour: c.colour, leather: c.leather, is_new: true as const }));
    const allRawSkus = [
      ...(skuData.rawSkus as unknown as Array<{ style: string; colour: string; leather: string; is_new: boolean }>),
      ...customEntries,
    ].filter(
      (sku) =>
        !cancelledStyleSet.has(sku.style) &&
        !cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`)
    );

    const map = new Map<string, Combo>();
    for (const sku of allRawSkus) {
      const col = sku.colour ?? "";
      const lth = sku.leather ?? "";
      const key = `${col} ${lth}`.trim();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { key, colour: col, leather: lth, totalCount: 0, newCount: 0, existingCount: 0, skus: [] });
      }
      const combo = map.get(key)!;
      combo.totalCount++;
      if (sku.is_new) combo.newCount++;
      else combo.existingCount++;
      const info = styleInfoMap.get(sku.style);
      combo.skus.push({
        style: sku.style,
        category: info?.category ?? "",
        last: info?.last ?? "",
        isNew: sku.is_new,
        imageUrl: imageMap.get(sku.style) ?? "",
      });
    }
    return Array.from(map.values()).sort((a, b) => b.totalCount - a.totalCount || a.key.localeCompare(b.key));
  }, [customSkusRaw, cancelledStyleSet, cancelledSkuSet]);

  const filtered = useMemo(() => {
    const results = ALL_COMBOS.filter((combo) => {
      const matchesSearch =
        !search ||
        combo.key.toLowerCase().includes(search.toLowerCase()) ||
        combo.colour.toLowerCase().includes(search.toLowerCase()) ||
        combo.leather.toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === "all" ||
        (filter === "new" && combo.newCount > 0) ||
        (filter === "existing" && combo.existingCount > 0);

      return matchesSearch && matchesFilter;
    });
    // Re-sort based on active filter
    if (filter === "new") {
      results.sort((a, b) => b.newCount - a.newCount || a.key.localeCompare(b.key));
    } else if (filter === "existing") {
      results.sort((a, b) => b.existingCount - a.existingCount || a.key.localeCompare(b.key));
    }
    // filter === "all" keeps the default totalCount order from ALL_COMBOS
    return results;
  }, [search, filter]);

  const toggleKey = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setOpenKeys(new Set(filtered.map((c) => c.key)));
  const collapseAll = () => setOpenKeys(new Set());

  const totalNew = useMemo(() => ALL_COMBOS.reduce((s, c) => s + c.newCount, 0), [ALL_COMBOS]);
  const totalExisting = useMemo(() => ALL_COMBOS.reduce((s, c) => s + c.existingCount, 0), [ALL_COMBOS]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Sora', sans-serif" }}>
            Colour / Leather
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ALL_COMBOS.length} combinations · {totalNew} new SKUs · {totalExisting} existing
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "new", "existing"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                filter === f
                  ? f === "new"
                    ? "bg-amber-500 text-white border-amber-500"
                    : f === "existing"
                    ? "bg-slate-600 text-white border-slate-600"
                    : "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/40"
              }`}
            >
              {f === "all" ? "All SKUs" : f === "new" ? "New Only" : "Existing Only"}
            </button>
          ))}
        </div>
      </div>

      {/* Search + expand/collapse */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search colour or leather…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:border-foreground/30"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:border-foreground/30"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Results count */}
      {search && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {ALL_COMBOS.length} combinations
        </p>
      )}

      {/* Combo list */}
      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No combinations match your search.
          </div>
        )}

        {filtered.map((combo) => {
          const isOpen = openKeys.has(combo.key);
          // When filter=new, only show new skus in dropdown; when filter=existing, only existing
          const visibleSkus =
            filter === "new"
              ? combo.skus.filter((s) => s.isNew)
              : filter === "existing"
              ? combo.skus.filter((s) => !s.isNew)
              : combo.skus;

          const displayCount =
            filter === "new"
              ? combo.newCount
              : filter === "existing"
              ? combo.existingCount
              : combo.totalCount;

          return (
            <div
              key={combo.key}
              className="rounded-xl border border-border overflow-hidden bg-card transition-shadow hover:shadow-sm"
            >
              {/* Header row */}
              <button
                onClick={() => toggleKey(combo.key)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
              >
                <span className="text-muted-foreground flex-shrink-0">
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>

                {/* Combo name */}
                <span
                  className="font-semibold text-sm text-foreground flex-1 min-w-0"
                  style={{ fontFamily: "'Sora', sans-serif" }}
                >
                  {combo.key}
                </span>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Total usage count */}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-foreground/10 text-foreground border border-border">
                    {displayCount} SKU{displayCount !== 1 ? "s" : ""}
                  </span>
                  {combo.newCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white">
                      <Star className="w-2.5 h-2.5" />
                      {combo.newCount} new
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                      0 new
                    </span>
                  )}
                  {combo.existingCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {combo.existingCount} existing
                    </span>
                  )}
                  {/* Mini image strip (up to 4 thumbnails) */}
                  <div className="hidden sm:flex -space-x-2">
                    {Array.from(
                      new Map(
                        combo.skus.map((s) => [s.style, s.imageUrl])
                      ).values()
                    )
                      .filter(Boolean)
                      .slice(0, 4)
                      .map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border-2 border-background bg-muted"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ))}
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t border-border bg-muted/20 px-4 py-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {visibleSkus.map((sku, i) => (
                      <div
                        key={`${sku.style}-${i}`}
                        className={`rounded-lg border p-2.5 flex flex-col items-center gap-2 text-center transition-all ${
                          sku.isNew
                            ? "border-amber-300 bg-amber-50"
                            : "border-border bg-background"
                        }`}
                      >
                        {/* Shoe image */}
                        {sku.imageUrl ? (
                          <div className="w-full aspect-[4/3] rounded-md overflow-hidden bg-muted flex items-center justify-center">
                            <img
                              src={sku.imageUrl}
                              alt={sku.style}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-full aspect-[4/3] rounded-md bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">No image</span>
                          </div>
                        )}

                        {/* Style name */}
                        <span
                          className="text-xs font-semibold text-foreground leading-tight"
                          style={{ fontFamily: "'Sora', sans-serif" }}
                        >
                          {sku.style}
                        </span>

                        {/* Category */}
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {sku.category}
                        </span>

                        {/* New/Existing badge */}
                        {sku.isNew ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500 text-white">
                            <Star className="w-2 h-2" />
                            NEW
                          </span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            Existing
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
