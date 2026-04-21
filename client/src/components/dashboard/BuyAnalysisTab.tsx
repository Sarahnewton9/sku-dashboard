/**
 * BuyAnalysisTab — analysis of pairs bought per session
 * Breakdowns by category, leather, and colour+leather combination
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { BarChart3, ChevronDown, Package } from "lucide-react";

export default function BuyAnalysisTab() {
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [showSessionPicker, setShowSessionPicker] = useState(false);

  const { data: allSessions = [] } = trpc.buy.getSessions.useQuery();
  const { data: activeSession } = trpc.buy.getActive.useQuery();
  const { data: sessionItems = [] } = trpc.buy.getItems.useQuery(
    { sessionId: selectedSessionId ?? 0 },
    { enabled: selectedSessionId !== null }
  );

  // Auto-select active session
  useMemo(() => {
    if (activeSession && selectedSessionId === null) {
      setSelectedSessionId(activeSession.id);
    }
  }, [activeSession]);

  // Build style info lookup
  const styleInfoMap = useMemo((): Record<string, { category: string; last: string }> => {
    const map: Record<string, { category: string; last: string }> = {};
    const styles = (skuData.styles as unknown) as Array<{ style: string; category: string; last: string }>;
    styles.forEach((s) => { map[s.style] = { category: s.category, last: s.last }; });
    return map;
  }, []);

  // Build raw SKU lookup for is_new per SKU
  const rawSkuMap = useMemo((): Record<string, boolean> => {
    const map: Record<string, boolean> = {};
    const rawSkus = (skuData.rawSkus as unknown) as Array<{ style: string; colour: string; leather: string; is_new: boolean }>;
    rawSkus.forEach((sku) => {
      map[`${sku.style}|${sku.colour}|${sku.leather}`] = sku.is_new;
    });
    return map;
  }, []);

  // Only items with qty > 0
  const boughtItems = useMemo(() => sessionItems.filter((i) => (i.qty ?? 0) > 0), [sessionItems]);
  const totalPairs = useMemo(() => boughtItems.reduce((s, i) => s + (i.qty ?? 0), 0), [boughtItems]);

  // By category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of boughtItems) {
      const cat = styleInfoMap[item.style]?.category ?? "Unknown";
      map[cat] = (map[cat] ?? 0) + (item.qty ?? 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [boughtItems, styleInfoMap]);

  // By leather
  const byLeather = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of boughtItems) {
      const leather = item.leather || "Unknown";
      map[leather] = (map[leather] ?? 0) + (item.qty ?? 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [boughtItems]);

  // By colour+leather combo (new SKUs only)
  const byColourLeather = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of boughtItems) {
      const isNew = rawSkuMap[`${item.style}|${item.colour}|${item.leather}`] ?? false;
      if (!isNew) continue;
      const combo = `${item.colour} / ${item.leather || "—"}`;
      map[combo] = (map[combo] ?? 0) + (item.qty ?? 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [boughtItems, rawSkuMap]);

  const newPairs = useMemo(() => boughtItems.filter((i) => rawSkuMap[`${i.style}|${i.colour}|${i.leather}`]).reduce((s, i) => s + (i.qty ?? 0), 0), [boughtItems, rawSkuMap]);

  const selectedSession = allSessions.find((s) => s.id === selectedSessionId);

  function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-foreground w-40 truncate flex-shrink-0">{label}</span>
        <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color ?? "#f59e0b" }}
          />
        </div>
        <span className="text-sm font-bold tabular-nums w-12 text-right" style={{ color: color ?? "oklch(0.50 0.14 55)" }}>{value}</span>
        <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Buy Analysis</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Breakdown of pairs bought per session</p>
        </div>

        {/* Session picker */}
        <div className="relative">
          <button
            onClick={() => setShowSessionPicker(!showSessionPicker)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-muted/50"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            {selectedSession ? selectedSession.name : "Select session"}
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
                <div className="max-h-56 overflow-y-auto">
                  {[...allSessions].reverse().map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedSessionId(s.id); setShowSessionPicker(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 transition-colors"
                      style={{ background: selectedSessionId === s.id ? "oklch(0.97 0.04 65 / 0.6)" : undefined }}
                    >
                      <span className="flex-1 truncate font-medium text-foreground">{s.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(s.createdAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                      </span>
                      {s.isLocked && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                          style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>Locked</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!selectedSession ? (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No session selected</p>
          <p className="text-xs text-muted-foreground mt-1">Select a buy session above to view its analysis.</p>
        </div>
      ) : boughtItems.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No items in this session</p>
          <p className="text-xs text-muted-foreground mt-1">Enter quantities in the By Style tab to see analysis here.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Pairs", value: totalPairs, sub: "across all SKUs" },
              { label: "New SKU Pairs", value: newPairs, sub: "new styles only" },
              { label: "Carry-over Pairs", value: totalPairs - newPairs, sub: "existing styles" },
              { label: "SKUs Bought", value: boughtItems.length, sub: "distinct SKUs" },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <p className="text-2xl font-bold tabular-nums" style={{ color: "oklch(0.50 0.14 55)" }}>{card.value}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{card.label}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Category */}
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <h3 className="text-sm font-bold text-foreground mb-4">Pairs by Category</h3>
              <div className="space-y-2.5">
                {byCategory.map(([cat, qty]) => (
                  <BarRow key={cat} label={cat} value={qty} max={totalPairs} color="#f59e0b" />
                ))}
              </div>
            </div>

            {/* By Leather */}
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <h3 className="text-sm font-bold text-foreground mb-4">Pairs by Leather</h3>
              <div className="space-y-2.5">
                {byLeather.map(([leather, qty]) => (
                  <BarRow key={leather} label={leather} value={qty} max={totalPairs} color="oklch(0.60 0.14 200)" />
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
              <p className="text-sm text-muted-foreground">No new SKUs with quantities in this session.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {byColourLeather.map(([combo, qty]) => (
                  <BarRow key={combo} label={combo} value={qty} max={newPairs} color="oklch(0.55 0.16 155)" />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
