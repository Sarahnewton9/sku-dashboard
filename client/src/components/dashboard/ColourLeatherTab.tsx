/**
 * Colour/Leather Tab
 * Design: Refined Analytical Dashboard — warm off-white, Sora + Inter typography, amber accents
 * Groups all SKUs by their colour+leather combination (e.g. "TURQUOISE SUEDE"),
 * sorted alphabetically. Each row is collapsible to show all styles using that combo,
 * with shoe image thumbnails and New/Existing badges.
 */
import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, Star } from "lucide-react";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { trpc } from "@/lib/trpc";
import { useSeason } from "@/contexts/SeasonContext";
import {
  buildColourLeatherMaterialGroups,
  type ColourLeatherMaterialGroup,
  type ColourLeatherMaterialUsage,
} from "@shared/colourLeatherGroups";

interface ComboSku extends ColourLeatherMaterialUsage {
  category: string;
  last: string;
  imageUrl: string;
}

interface Combo extends Omit<ColourLeatherMaterialGroup, "skus"> {
  skus: ComboSku[];
}

export default function ColourLeatherTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "existing">("all");
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const { season } = useSeason();

  const { mergedRawSkus, mergedStyles } = useCustomSkus();

  // Fetch cancelled styles and cancelled SKUs so they can be filtered out
  const { data: cancelledStylesRaw = [] } = trpc.styles.listCancelled.useQuery({ season });
  const { data: cancelledSkusRaw = [] } = trpc.cancelledSku.list.useQuery({ season });

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

  // Build material groups dynamically from the active physical SKU range. Each
  // secondary upper is a first-class material group, not just a label below a
  // primary-upper group.
  const materialData = useMemo(() => {
    const imageMap = new Map<string, string>();
    for (const s of mergedStyles) imageMap.set(s.style, (s as any).imageUrl ?? "");

    const styleInfoMap = new Map<string, { category: string; last: string }>();
    for (const s of mergedStyles) styleInfoMap.set(s.style, { category: s.category, last: s.last });

    const allRawSkus = (mergedRawSkus as unknown as Array<{
      style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null; is_new: boolean;
    }>).filter(
      (sku) =>
        !cancelledStyleSet.has(sku.style) &&
        !cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`)
    );

    const grouped = buildColourLeatherMaterialGroups(allRawSkus.map((sku) => ({
      ...sku,
      isNew: sku.is_new,
    })));

    return {
      ...grouped,
      groups: grouped.groups.map<Combo>((group) => ({
        ...group,
        skus: group.skus.map((sku) => {
          const info = styleInfoMap.get(sku.style);
          return {
            ...sku,
            category: info?.category ?? "",
            last: info?.last ?? "",
            imageUrl: imageMap.get(sku.style) ?? "",
          };
        }),
      })),
    };
  }, [mergedRawSkus, mergedStyles, cancelledStyleSet, cancelledSkuSet]);
  const ALL_COMBOS = materialData.groups;
  const normalizedSearch = search.trim().toLocaleLowerCase();

  const filtered = useMemo(() => {
    const results = ALL_COMBOS.filter((combo) => {
      const matchingSkus = combo.skus;
      const matchesSearch = !normalizedSearch || combo.key.toLocaleLowerCase().includes(normalizedSearch);

      const matchesFilter =
        filter === "all" ||
        (filter === "new" && matchingSkus.some((sku) => sku.isNew)) ||
        (filter === "existing" && matchingSkus.some((sku) => !sku.isNew));

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
  }, [normalizedSearch, filter, ALL_COMBOS]);

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

  const totalNew = materialData.newSkus;
  const totalExisting = materialData.existingSkus;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Sora', sans-serif" }}>
            Colour / Leather
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ALL_COMBOS.length} materials · {totalNew} new SKUs · {totalExisting} existing
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
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[18rem] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Upper 1 or Upper 2…"
            aria-label="Search Colour Leather results by Upper 1 or Upper 2"
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
          Showing {filtered.length} of {ALL_COMBOS.length} materials used in either Upper 1 or Upper 2.
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
          const matchingSkus = combo.skus;
          // Each card represents one physical SKU using this material in the
          // labelled upper position.
          const visibleSkus =
            filter === "new"
              ? matchingSkus.filter((s) => s.isNew)
              : filter === "existing"
              ? matchingSkus.filter((s) => !s.isNew)
              : matchingSkus;

          const displayCount = visibleSkus.length;
          const matchingNewCount = matchingSkus.filter((sku) => sku.isNew).length;
          const matchingExistingCount = matchingSkus.length - matchingNewCount;

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
                  {matchingNewCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white">
                      <Star className="w-2.5 h-2.5" />
                      {matchingNewCount} new
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                      0 new
                    </span>
                  )}
                  {matchingExistingCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {matchingExistingCount} existing
                    </span>
                  )}
                  {/* Mini image strip (up to 4 thumbnails) */}
                  <div className="hidden sm:flex -space-x-2">
                    {Array.from(
                      new Map(
                        visibleSkus.map((s) => [s.style, s.imageUrl])
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
                    {visibleSkus.map((sku) => (
                      <div
                        key={sku.identity}
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

                        <span className="text-[10px] font-medium leading-tight text-purple-700">
                          {sku.upperRole} · {combo.key}
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
