/**
 * LeathersTab — leather types with usage counts + leather usage calculator
 */

import { useState, useMemo } from "react";
import { skuData } from "@/lib/skuData";
import { trpc } from "@/lib/trpc";
import { Calculator } from "lucide-react";

// Footage rates per category (sq ft per pair)
const FOOTAGE_RATES: Record<string, number> = {
  "Dress Sandal": 1.5,
  "Court Shoe": 1.7,
  "Dress Shoe": 1.7,
  "Ankle Boot": 2.5,
  "Calf Boot": 4.5,
  "Sandal": 1.0,
  "Ballet Flat": 1.5,
  "Loafer": 1.7,
  "Wedge": 1.5,
};

export default function LeathersTab() {
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [useOrderQty, setUseOrderQty] = useState(false);

  // Fetch SKU meta for order quantities
  const { data: skuMetaList = [] } = trpc.sku.getAll.useQuery();

  const skuMetaMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of skuMetaList) {
      const key = `${m.style}|${m.colour}|${m.leather}`;
      map[key] = m.orderQty ?? 0;
    }
    return map;
  }, [skuMetaList]);

  const data = skuData.leathers
    .map((l) => ({ ...l, displayCount: showNewOnly ? l.newCount : l.allCount }))
    .filter((l) => l.displayCount > 0)
    .sort((a, b) => b.displayCount - a.displayCount);

  const maxCount = data[0]?.displayCount ?? 1;

  // Build style lookup for category
  const styleLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of skuData.styles) {
      map[s.style] = s.category;
    }
    return map;
  }, []);

  // Calculate leather usage — by colour+leather combo, new SKUs only
  const leatherUsage = useMemo(() => {
    if (!showCalculator) return [];

    // Group rawSkus by colour+leather combo — always new SKUs only for ordering purposes
    const comboMap: Record<string, { skuCount: number; footage: number; weightedFootage: number }> = {};

    for (const sku of (skuData.rawSkus as unknown as Array<{ style: string; colour: string; leather: string; is_new: boolean }>)) {
      if (!sku.is_new) continue; // Always new SKUs only — carry-overs don't need fresh leather
      if (!sku.leather) continue;

      const category = styleLookup[sku.style] ?? "Dress Shoe";
      const rate = FOOTAGE_RATES[category] ?? 1.7;
      const skuKey = `${sku.style}|${sku.colour}|${sku.leather}` as string;
      const orderQty = useOrderQty ? (skuMetaMap[skuKey] ?? 0) : 1;

      const comboKey = `${sku.colour} / ${sku.leather}`;
      if (!comboMap[comboKey]) {
        comboMap[comboKey] = { skuCount: 0, footage: 0, weightedFootage: 0 };
      }
      comboMap[comboKey].skuCount++;
      comboMap[comboKey].footage += rate;
      comboMap[comboKey].weightedFootage += rate * orderQty;
    }

    return Object.entries(comboMap)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.footage - a.footage);
  }, [showCalculator, useOrderQty, skuMetaMap, styleLookup]);

  const totalFootage = useMemo(() => leatherUsage.reduce((sum, l) => sum + (useOrderQty ? l.weightedFootage : l.footage), 0), [leatherUsage, useOrderQty]);

  return (
    <div className="space-y-5">
      {/* Header + Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-base text-foreground">
            Leather Types
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.length} leather types · {showNewOnly ? "new SKUs only" : "all SKUs"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
            style={{
              background: showCalculator ? "oklch(0.96 0.08 65)" : "transparent",
              borderColor: showCalculator ? "oklch(0.88 0.10 65)" : "var(--border)",
              color: showCalculator ? "oklch(0.50 0.14 55)" : "var(--muted-foreground)",
            }}
          >
            <Calculator className="w-4 h-4" />
            Calculator
          </button>
          <div className="flex items-center gap-1 p-1 rounded-lg border bg-card" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setShowNewOnly(false)}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
              style={{
                background: !showNewOnly ? "var(--foreground)" : "transparent",
                color: !showNewOnly ? "var(--background)" : "var(--muted-foreground)",
              }}
            >
              All SKUs
            </button>
            <button
              onClick={() => setShowNewOnly(true)}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
              style={{
                background: showNewOnly ? "#f59e0b" : "transparent",
                color: showNewOnly ? "white" : "var(--muted-foreground)",
              }}
            >
              New Only
            </button>
          </div>
        </div>
      </div>

      {/* Leather Usage Calculator */}
      {showCalculator && (
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: "oklch(0.88 0.10 65)", background: "oklch(0.98 0.03 65 / 0.5)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-display font-semibold text-sm text-foreground">Leather Usage Calculator</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Estimated sq ft per colour / leather combination · new SKUs only
                {useOrderQty ? " (weighted by order qty)" : " (1 unit per SKU)"}
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted-foreground">Weight by order qty</span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={useOrderQty}
                  onChange={(e) => setUseOrderQty(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                  style={{ background: useOrderQty ? "#f59e0b" : "var(--muted)" }} />
              </div>
            </label>
          </div>

          {/* Footage rates reference */}
          <div className="text-xs text-muted-foreground rounded-lg p-3" style={{ background: "var(--muted)" }}>
            <strong>Footage rates:</strong> Dress Sandal 1.5 ft · Dress Shoe/Loafer 1.7 ft · Ballet Flat/Wedge 1.5 ft · Sandal 1.0 ft · Ankle Boot 2.5 ft · Calf Boot 4.5 ft
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4">
            <div className="rounded-lg px-4 py-3 flex-1 text-center" style={{ background: "oklch(0.96 0.08 65)", border: "1px solid oklch(0.88 0.10 65)" }}>
              <p className="text-2xl font-display font-bold" style={{ color: "oklch(0.45 0.14 55)" }}>
                {totalFootage.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">Total sq ft</p>
            </div>
            <div className="rounded-lg px-4 py-3 flex-1 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-2xl font-display font-bold text-foreground">{leatherUsage.length}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">Leather types</p>
            </div>
            <div className="rounded-lg px-4 py-3 flex-1 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-2xl font-display font-bold text-foreground">
                {leatherUsage.reduce((s, l) => s + l.skuCount, 0)}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">SKUs included</p>
            </div>
          </div>

          {/* Per-leather table */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--muted)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Colour / Leather</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">SKUs</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {useOrderQty ? "Weighted Footage" : "Est. Footage"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {leatherUsage.map((l) => (
                  <tr key={l.name} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2 font-medium text-foreground">{l.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{l.skuCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold" style={{ color: "oklch(0.50 0.14 55)" }}>
                      {(useOrderQty ? l.weightedFootage : l.footage).toLocaleString(undefined, { maximumFractionDigits: 1 })} ft²
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bar list */}
      <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {data.map((leather, i) => {
            const pct = (leather.displayCount / maxCount) * 100;
            return (
              <div
                key={leather.name}
                className="px-5 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors"
              >
                <span className="text-xs tabular-nums text-muted-foreground w-6 text-right flex-shrink-0">
                  {i + 1}
                </span>
                <span className="font-medium text-foreground text-sm w-40 flex-shrink-0 truncate">
                  {leather.name}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: showNewOnly
                        ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                        : "linear-gradient(90deg, oklch(0.55 0.012 60), oklch(0.70 0.010 60))",
                    }}
                  />
                </div>
                <span
                  className="text-sm font-semibold tabular-nums w-8 text-right flex-shrink-0"
                  style={{ color: showNewOnly ? "oklch(0.55 0.14 55)" : "var(--foreground)" }}
                >
                  {leather.displayCount}
                </span>
                {!showNewOnly && leather.newCount > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}
                  >
                    {leather.newCount} new
                  </span>
                )}
                {!showNewOnly && leather.newCount === 0 && (
                  <span className="w-16 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
