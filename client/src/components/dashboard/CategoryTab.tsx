/**
 * CategoryTab — shows each category as a card with SKU breakdown.
 * Ballet Flat and Loafer are merged under "Casual Flat" with trend tags.
 * A separate Trends section shows MESH, SLINGBACK, TOE CAP, ROSETTE, etc.
 * "Other" is excluded from categories — those styles appear only in Trends.
 */

import { useMemo } from "react";
import { skuData } from "@/lib/skuData";
import { useStyleCategories } from "@/hooks/useStyleCategories";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { trpc } from "@/lib/trpc";

const BOOT_COLOUR = "#290008";        // Back Bean — all boots
const WEDGE_COLOUR = "#123622";       // Dark Green — all wedges
const SANDAL_COLOUR = "#A7C2D5";      // Powder Blue — dress sandal
const FLAT_SANDAL_COLOUR = "#c5d8e8"; // lighter Powder Blue — flat/casual sandal

const CATEGORY_COLOURS: Record<string, string> = {
  // Shoes
  "DRESS SHOE": "#FFCCDF",   // Fairy Tale
  "CASUAL SHOE": "#ffd9e8",  // lighter Fairy Tale
  // Sandals
  "DRESS SANDAL": SANDAL_COLOUR,
  "SANDAL": SANDAL_COLOUR,
  "FLAT SANDAL": FLAT_SANDAL_COLOUR,
  "CASUAL SANDAL": FLAT_SANDAL_COLOUR,
  // Flats
  "CASUAL FLAT": "#123622",  // Dark Green
  // Wedges — all one colour
  "CASUAL WEDGE": WEDGE_COLOUR,
  "DRESS WEDGE": WEDGE_COLOUR,
  "WEDGE": WEDGE_COLOUR,
  // Boots — all one colour
  "DRESS ANKLE BOOT": BOOT_COLOUR,
  "ANKLE BOOT": BOOT_COLOUR,
  "DRESS BOOT ANKLE": BOOT_COLOUR,
  "CASUAL BOOT ANKLE": BOOT_COLOUR,
  "DRESS CALF BOOT": BOOT_COLOUR,
  "CALF BOOT": BOOT_COLOUR,
  "DRESS BOOT CALF": BOOT_COLOUR,
  "CASUAL BOOT CALF": BOOT_COLOUR,
  "DRESS BOOT LONG": BOOT_COLOUR,
  "CASUAL BOOT LONG": BOOT_COLOUR,
};

const CATEGORY_ICONS: Record<string, string> = {
  "DRESS SHOE": "👠",
  "CASUAL SHOE": "👟",
  "DRESS SANDAL": "👡",
  "SANDAL": "🩴",
  "FLAT SANDAL": "🩴",
  "CASUAL SANDAL": "🩴",
  "CASUAL FLAT": "🩰",
  "CASUAL WEDGE": "👢",
  "DRESS WEDGE": "👢",
  "WEDGE": "👢",
  "DRESS ANKLE BOOT": "👢",
  "ANKLE BOOT": "👢",
  "DRESS BOOT ANKLE": "👢",
  "CASUAL BOOT ANKLE": "👢",
  "DRESS CALF BOOT": "👢",
  "CALF BOOT": "👢",
  "DRESS BOOT CALF": "👢",
  "CASUAL BOOT CALF": "👢",
  "DRESS BOOT LONG": "👢",
  "CASUAL BOOT LONG": "👢",
};

const TREND_COLOURS: Record<string, string> = {
  "MESH": "#A7C2D5",      // Powder Blue
  "SLINGBACK": "#FFCCDF", // Fairy Tale
  "TOE CAP": "#123622",   // Dark Green
  "ROSETTE": "#290008",   // Back Bean
  "BALLET": "#A7C2D5",    // Powder Blue
  "LOAFER": "#123622",    // Dark Green
};

const TREND_ICONS: Record<string, string> = {
  "MESH": "🕸️",
  "SLINGBACK": "👡",
  "TOE CAP": "👟",
  "ROSETTE": "🌸",
  "BALLET": "🩰",
  "LOAFER": "🥿",
};

export default function CategoryTab() {
  const { getCategory, getTrendFlag, getTrends, allTrends } = useStyleCategories();
  const { mergedRawSkus, mergedStyles } = useCustomSkus();

  // Fetch cancelled styles and SKUs
  const { data: cancelledStylesRaw = [] } = trpc.styles.listCancelled.useQuery();
  const { data: cancelledSkusRaw = [] } = trpc.cancelledSku.list.useQuery();

  const cancelledStyleSet = useMemo(
    () => new Set((cancelledStylesRaw as any[]).map((r: any) => r.style as string)),
    [cancelledStylesRaw]
  );
  const cancelledSkuSet = useMemo(
    () => new Set((cancelledSkusRaw as any[]).map((r: any) => `${r.style}|${r.colour}|${r.leather}`)),
    [cancelledSkusRaw]
  );

  // Build merged category stats using resolved categories
  const { mergedCategories, trendStats } = useMemo(() => {
    type CatStats = {
      category: string;
      totalStyles: number;
      totalSKUs: number;
      newSKUs: number;
      existingSKUs: number;
      images: string[];
      trendBreakdown: Record<string, number>;
    };

    type TrendStats = {
      trend: string;
      totalStyles: number;
      totalSKUs: number;
      newSKUs: number;
      existingSKUs: number;
      images: string[];
    };

    const catMap = new Map<string, CatStats>();
    const trendMap = new Map<string, TrendStats>();

    // Build a lookup of style -> imageUrl from mergedStyles (includes custom SKU styles)
    const styleImageMap: Record<string, string> = {};
    for (const s of mergedStyles) {
      if ((s as any).imageUrl) styleImageMap[s.style] = (s as any).imageUrl;
    }

    // Group mergedRawSkus by style first
    const skusByStyle: Record<string, Array<{ colour: string; leather: string; is_new: boolean }>> = {};
    for (const sku of mergedRawSkus) {
      if (!skusByStyle[sku.style]) skusByStyle[sku.style] = [];
      skusByStyle[sku.style].push(sku);
    }

    // Collect all active style names
    const activeStyles = new Set<string>();
    for (const sku of mergedRawSkus) {
      if (!cancelledStyleSet.has(sku.style)) activeStyles.add(sku.style);
    }

    // Build a category lookup from skuData.styles
    const styleCatMap: Record<string, string> = {};
    for (const s of skuData.styles) styleCatMap[s.style] = s.category;

    for (const styleName of Array.from(activeStyles)) {
      const baseCategory = styleCatMap[styleName] ?? "Other";
      const resolvedCat = getCategory(styleName, baseCategory).toUpperCase();
      const trendFlag = getTrendFlag(styleName);
      const trends = getTrends(styleName);

      // Count SKUs for this style (excluding individually cancelled SKUs)
      const styleSKUs = (skusByStyle[styleName] ?? []).filter(
        (s) => !cancelledSkuSet.has(`${styleName}|${s.colour}|${s.leather}`)
      );
      const newCount = styleSKUs.filter((s) => s.is_new).length;
      const existingCount = styleSKUs.filter((s) => !s.is_new).length;
      const imageUrl = styleImageMap[styleName];

      // --- Category stats (skip "OTHER") ---
      if (resolvedCat !== "OTHER") {
        if (!catMap.has(resolvedCat)) {
          catMap.set(resolvedCat, {
            category: resolvedCat,
            totalStyles: 0,
            totalSKUs: 0,
            newSKUs: 0,
            existingSKUs: 0,
            images: [],
            trendBreakdown: {},
          });
        }
        const entry = catMap.get(resolvedCat)!;
        entry.totalStyles += 1;
        entry.totalSKUs += styleSKUs.length;
        entry.newSKUs += newCount;
        entry.existingSKUs += existingCount;
        if (imageUrl && entry.images.length < 6) entry.images.push(imageUrl);
        if (trendFlag) {
          entry.trendBreakdown[trendFlag] = (entry.trendBreakdown[trendFlag] ?? 0) + 1;
        }
      }

      // --- Trend stats (all styles with any trend flag) ---
      for (const t of trends) {
        if (!trendMap.has(t)) {
          trendMap.set(t, { trend: t, totalStyles: 0, totalSKUs: 0, newSKUs: 0, existingSKUs: 0, images: [] });
        }
        const te = trendMap.get(t)!;
        te.totalStyles += 1;
        te.totalSKUs += styleSKUs.length;
        te.newSKUs += newCount;
        te.existingSKUs += existingCount;
        if (imageUrl && te.images.length < 6) te.images.push(imageUrl);
      }
    }

    return {
      mergedCategories: Array.from(catMap.values()).sort((a, b) => a.category.localeCompare(b.category)),
      trendStats: Array.from(trendMap.values()).sort((a, b) => b.totalSKUs - a.totalSKUs),
    };
  }, [getCategory, getTrendFlag, getTrends, cancelledStyleSet, cancelledSkuSet, mergedRawSkus, mergedStyles]);

  return (
    <div className="space-y-8">
      {/* Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
        {mergedCategories.map((cat) => {
          const colour = CATEGORY_COLOURS[cat.category] ?? "#6b7280";
          const icon = CATEGORY_ICONS[cat.category] ?? "👟";
          const pctNew = cat.totalSKUs > 0 ? Math.round((cat.newSKUs / cat.totalSKUs) * 100) : 0;

          return (
            <div
              key={cat.category}
              className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="h-1" style={{ background: colour }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-2xl">{icon}</span>
                    <h3 className="font-display font-semibold text-base text-foreground mt-1">
                      {cat.category}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cat.totalStyles} {cat.totalStyles === 1 ? "style" : "styles"}
                    </p>

                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-display font-bold tabular-nums text-foreground">
                      {cat.totalSKUs}
                    </div>
                    <div className="text-xs text-muted-foreground">total SKUs</div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      <span className="text-muted-foreground">New</span>
                    </span>
                    <span className="font-semibold tabular-nums" style={{ color: "oklch(0.55 0.14 55)" }}>
                      {cat.newSKUs}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: "oklch(0.80 0.01 80)" }} />
                      <span className="text-muted-foreground">Existing</span>
                    </span>
                    <span className="font-medium tabular-nums text-muted-foreground">
                      {cat.existingSKUs}
                    </span>
                  </div>
                </div>

                {cat.images.length > 0 && (
                  <div className="flex gap-1.5 mb-4 flex-wrap">
                    {cat.images.slice(0, 6).map((url, i) => (
                      <div
                        key={i}
                        className="w-12 h-9 rounded overflow-hidden flex items-center justify-center flex-shrink-0"
                        style={{ background: "var(--muted)" }}
                      >
                        <img src={url} alt="" className="w-full h-full object-contain" loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">% New SKUs</span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: colour }}>
                      {pctNew}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                    <div className="h-full rounded-full bar-fill" style={{ width: `${pctNew}%`, background: colour }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Category comparison table */}
      <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-display font-semibold text-base text-foreground">Category Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Category</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Styles</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Total SKUs</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">New</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Existing</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Avg SKUs/Style</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide w-40">% New</th>
              </tr>
            </thead>
            <tbody>
              {mergedCategories.map((cat) => {
                const colour = CATEGORY_COLOURS[cat.category] ?? "#6b7280";
                const avg = cat.totalStyles > 0 ? (cat.totalSKUs / cat.totalStyles).toFixed(1) : "0";
                const pctNew = cat.totalSKUs > 0 ? Math.round((cat.newSKUs / cat.totalSKUs) * 100) : 0;
                return (
                  <tr key={cat.category} className="border-b transition-colors hover:bg-muted/40" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colour }} />
                        <span className="font-medium text-foreground">{cat.category}</span>

                      </div>
                    </td>
                    <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{cat.totalStyles}</td>
                    <td className="text-right px-4 py-3 tabular-nums font-semibold text-foreground">{cat.totalSKUs}</td>
                    <td className="text-right px-4 py-3 tabular-nums font-semibold" style={{ color: "oklch(0.55 0.14 55)" }}>{cat.newSKUs}</td>
                    <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{cat.existingSKUs}</td>
                    <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{avg}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pctNew}%`, background: colour }} />
                        </div>
                        <span className="text-xs tabular-nums font-medium text-muted-foreground w-10 text-right">{pctNew}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trends section */}
      {trendStats.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="font-display font-semibold text-base text-foreground">Trends</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Styles tagged with a trend direction — a style may appear in multiple trends</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {trendStats.map((t) => {
              const colour = TREND_COLOURS[t.trend] ?? "#6b7280";
              const icon = TREND_ICONS[t.trend] ?? "✨";
              const pctNew = t.totalSKUs > 0 ? Math.round((t.newSKUs / t.totalSKUs) * 100) : 0;
              return (
                <div
                  key={t.trend}
                  className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="h-1" style={{ background: colour }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="text-2xl">{icon}</span>
                        <h3 className="font-display font-semibold text-base text-foreground mt-1">
                          {t.trend}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.totalStyles} {t.totalStyles === 1 ? "style" : "styles"}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-display font-bold tabular-nums text-foreground">
                          {t.totalSKUs}
                        </div>
                        <div className="text-xs text-muted-foreground">total SKUs</div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                          <span className="text-muted-foreground">New</span>
                        </span>
                        <span className="font-semibold tabular-nums" style={{ color: "oklch(0.55 0.14 55)" }}>
                          {t.newSKUs}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: "oklch(0.80 0.01 80)" }} />
                          <span className="text-muted-foreground">Existing</span>
                        </span>
                        <span className="font-medium tabular-nums text-muted-foreground">
                          {t.existingSKUs}
                        </span>
                      </div>
                    </div>

                    {t.images.length > 0 && (
                      <div className="flex gap-1.5 mb-4 flex-wrap">
                        {t.images.slice(0, 6).map((url, i) => (
                          <div
                            key={i}
                            className="w-12 h-9 rounded overflow-hidden flex items-center justify-center flex-shrink-0"
                            style={{ background: "var(--muted)" }}
                          >
                            <img src={url} alt="" className="w-full h-full object-contain" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">% New SKUs</span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: colour }}>
                          {pctNew}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                        <div className="h-full rounded-full bar-fill" style={{ width: `${pctNew}%`, background: colour }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
