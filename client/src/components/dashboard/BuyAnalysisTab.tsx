/**
 * BuyAnalysisTab — analysis of pairs bought per session
 * Supports multi-session selection, AU/USA qty split, and runtime category overrides
 */

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useStyleCategories } from "@/hooks/useStyleCategories";
import { BarChart3, ChevronDown, Package, Check } from "lucide-react";

export default function BuyAnalysisTab() {
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [showSessionPicker, setShowSessionPicker] = useState(false);

  const { data: allSessions = [] } = trpc.buy.getSessions.useQuery();
  const { data: activeSession } = trpc.buy.getActive.useQuery();
  const { getCategory } = useStyleCategories();

  // Auto-select active session on first load
  useEffect(() => {
    if (activeSession && selectedSessionIds.length === 0) {
      setSelectedSessionIds([activeSession.id]);
    }
  }, [activeSession]);

  // Fetch items for all selected sessions
  const sessionQueries = trpc.useQueries((t) =>
    selectedSessionIds.map((id) => t.buy.getItems({ sessionId: id }))
  );

  // Merge all items across selected sessions, summing AU+USA qtys per SKU
  const mergedItems = useMemo(() => {
    const map = new Map<string, { style: string; colour: string; leather: string; auQty: number; usaQty: number }>();
    for (const query of sessionQueries) {
      const items = (query.data ?? []) as Array<{ style: string; colour: string; leather: string; auQty?: number; usaQty?: number; qty?: number }>;
      for (const item of items) {
        const key = `${item.style}|${item.colour}|${item.leather}`;
        const existing = map.get(key) ?? { style: item.style, colour: item.colour, leather: item.leather, auQty: 0, usaQty: 0 };
        existing.auQty += item.auQty ?? 0;
        existing.usaQty += item.usaQty ?? 0;
        map.set(key, existing);
      }
    }
    return Array.from(map.values());
  }, [sessionQueries]);

  // Build style info lookup with runtime category overrides
  const styleInfoMap = useMemo((): Record<string, { category: string; last: string }> => {
    const map: Record<string, { category: string; last: string }> = {};
    const styles = (skuData.styles as unknown) as Array<{ style: string; category: string; last: string }>;
    styles.forEach((s) => {
      map[s.style] = { category: getCategory(s.style, s.category), last: s.last };
    });
    return map;
  }, [getCategory]);

  // Build raw SKU lookup for is_new per SKU
  const rawSkuMap = useMemo((): Record<string, boolean> => {
    const map: Record<string, boolean> = {};
    const rawSkus = (skuData.rawSkus as unknown) as Array<{ style: string; colour: string; leather: string; is_new: boolean }>;
    rawSkus.forEach((sku) => {
      map[`${sku.style}|${sku.colour}|${sku.leather}`] = sku.is_new;
    });
    return map;
  }, []);

  // Only items with any qty
  const boughtItems = useMemo(() => mergedItems.filter((i) => i.auQty + i.usaQty > 0), [mergedItems]);
  const totalAU = useMemo(() => boughtItems.reduce((s, i) => s + i.auQty, 0), [boughtItems]);
  const totalUSA = useMemo(() => boughtItems.reduce((s, i) => s + i.usaQty, 0), [boughtItems]);
  const totalPairs = totalAU + totalUSA;

  // By category — show AU and USA separately
  const byCategory = useMemo(() => {
    const map: Record<string, { au: number; usa: number }> = {};
    for (const item of boughtItems) {
      const cat = styleInfoMap[item.style]?.category ?? "Unknown";
      if (!map[cat]) map[cat] = { au: 0, usa: 0 };
      map[cat].au += item.auQty;
      map[cat].usa += item.usaQty;
    }
    return Object.entries(map)
      .map(([cat, v]) => ({ cat, au: v.au, usa: v.usa, total: v.au + v.usa }))
      .sort((a, b) => b.total - a.total);
  }, [boughtItems, styleInfoMap]);

  // By leather — show AU and USA separately
  const byLeather = useMemo(() => {
    const map: Record<string, { au: number; usa: number }> = {};
    for (const item of boughtItems) {
      const leather = item.leather || "Unknown";
      if (!map[leather]) map[leather] = { au: 0, usa: 0 };
      map[leather].au += item.auQty;
      map[leather].usa += item.usaQty;
    }
    return Object.entries(map)
      .map(([leather, v]) => ({ leather, au: v.au, usa: v.usa, total: v.au + v.usa }))
      .sort((a, b) => b.total - a.total);
  }, [boughtItems]);

  // By colour+leather combo (new SKUs only)
  const byColourLeather = useMemo(() => {
    const map: Record<string, { au: number; usa: number }> = {};
    for (const item of boughtItems) {
      const isNew = rawSkuMap[`${item.style}|${item.colour}|${item.leather}`] ?? false;
      if (!isNew) continue;
      const combo = `${item.colour} / ${item.leather || "—"}`;
      if (!map[combo]) map[combo] = { au: 0, usa: 0 };
      map[combo].au += item.auQty;
      map[combo].usa += item.usaQty;
    }
    return Object.entries(map)
      .map(([combo, v]) => ({ combo, au: v.au, usa: v.usa, total: v.au + v.usa }))
      .sort((a, b) => b.total - a.total);
  }, [boughtItems, rawSkuMap]);

  const newPairs = useMemo(() =>
    boughtItems.filter((i) => rawSkuMap[`${i.style}|${i.colour}|${i.leather}`]).reduce((s, i) => s + i.auQty + i.usaQty, 0),
    [boughtItems, rawSkuMap]
  );

  const selectedSessionNames = allSessions
    .filter((s) => selectedSessionIds.includes(s.id))
    .map((s) => s.name);

  function toggleSession(id: number) {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function BarRow({ label, au, usa, max }: { label: string; au: number; usa: number; max: number }) {
    const total = au + usa;
    const pct = max > 0 ? (total / max) * 100 : 0;
    const auPct = total > 0 ? (au / total) * 100 : 0;
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-foreground w-40 truncate flex-shrink-0">{label}</span>
        <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
          <div className="h-full flex rounded-full overflow-hidden" style={{ width: `${pct}%` }}>
            <div className="h-full transition-all duration-500" style={{ width: `${auPct}%`, background: "#f59e0b" }} />
            <div className="h-full transition-all duration-500" style={{ width: `${100 - auPct}%`, background: "oklch(0.60 0.14 200)" }} />
          </div>
        </div>
        <div className="flex gap-1 items-center text-xs tabular-nums w-28 justify-end">
          <span className="font-bold" style={{ color: "#f59e0b" }}>{au}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-bold" style={{ color: "oklch(0.60 0.14 200)" }}>{usa}</span>
          <span className="text-muted-foreground text-xs">({pct.toFixed(0)}%)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Buy Analysis</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Breakdown of pairs bought — select one or more sessions</p>
        </div>

        {/* Multi-session picker */}
        <div className="relative">
          <button
            onClick={() => setShowSessionPicker(!showSessionPicker)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-muted/50"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            {selectedSessionIds.length === 0
              ? "Select sessions"
              : selectedSessionIds.length === 1
              ? selectedSessionNames[0]
              : `${selectedSessionIds.length} sessions`}
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {showSessionPicker && (
            <div
              className="absolute top-full right-0 mt-1 w-72 rounded-xl border shadow-lg z-20 overflow-hidden"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              {allSessions.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">No sessions yet</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {[...allSessions].reverse().map((s) => {
                    const isSelected = selectedSessionIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleSession(s.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 transition-colors"
                        style={{ background: isSelected ? "oklch(0.97 0.04 65 / 0.6)" : undefined }}
                      >
                        <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                          style={{
                            borderColor: isSelected ? "oklch(0.55 0.14 55)" : "var(--border)",
                            background: isSelected ? "oklch(0.55 0.14 55)" : "transparent",
                          }}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="flex-1 truncate font-medium text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(s.createdAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                        </span>
                        {s.isLocked && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>Locked</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="px-4 py-2 border-t text-xs text-muted-foreground" style={{ borderColor: "var(--border)" }}>
                Click sessions to toggle. Multiple sessions are combined.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AU / USA legend */}
      {selectedSessionIds.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#f59e0b" }} />
            AU
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: "oklch(0.60 0.14 200)" }} />
            USA
          </span>
          <span className="text-muted-foreground">Bar = AU (amber) + USA (blue)</span>
        </div>
      )}

      {selectedSessionIds.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No session selected</p>
          <p className="text-xs text-muted-foreground mt-1">Select one or more buy sessions above to view analysis.</p>
        </div>
      ) : boughtItems.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No items in selected sessions</p>
          <p className="text-xs text-muted-foreground mt-1">Enter quantities in the By Style tab to see analysis here.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Pairs", value: totalPairs, sub: "AU + USA combined" },
              { label: "AU Pairs", value: totalAU, sub: "Australia", color: "#f59e0b" },
              { label: "USA Pairs", value: totalUSA, sub: "United States", color: "oklch(0.60 0.14 200)" },
              { label: "New SKU Pairs", value: newPairs, sub: "new styles only" },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <p className="text-2xl font-bold tabular-nums" style={{ color: card.color ?? "oklch(0.50 0.14 55)" }}>{card.value}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{card.label}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Category */}
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <h3 className="text-sm font-bold text-foreground mb-1">Pairs by Category</h3>
              <p className="text-xs text-muted-foreground mb-4">Amber = AU · Blue = USA</p>
              <div className="space-y-2.5">
                {byCategory.map(({ cat, au, usa, total }) => (
                  <BarRow key={cat} label={cat} au={au} usa={usa} max={totalPairs} />
                ))}
              </div>
            </div>

            {/* By Leather */}
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <h3 className="text-sm font-bold text-foreground mb-1">Pairs by Leather</h3>
              <p className="text-xs text-muted-foreground mb-4">Amber = AU · Blue = USA</p>
              <div className="space-y-2.5">
                {byLeather.map(({ leather, au, usa }) => (
                  <BarRow key={leather} label={leather} au={au} usa={usa} max={totalPairs} />
                ))}
              </div>
            </div>
          </div>

          {/* By Colour + Leather combo — new SKUs only */}
          <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-foreground">Pairs by Colour / Leather Combination</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>
                New SKUs only
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Only new SKUs are shown — carry-over styles don't require a fresh leather order.
            </p>
            {byColourLeather.length === 0 ? (
              <p className="text-sm text-muted-foreground">No new SKUs with quantities in selected sessions.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {byColourLeather.map(({ combo, au, usa }) => (
                  <BarRow key={combo} label={combo} au={au} usa={usa} max={newPairs} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
