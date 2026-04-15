/**
 * LeathersTab — all leather types with usage counts, toggleable All/New Only
 */

import { useState } from "react";
import { skuData } from "@/lib/skuData";

export default function LeathersTab() {
  const [showNewOnly, setShowNewOnly] = useState(false);

  const data = skuData.leathers
    .map((l) => ({ ...l, displayCount: showNewOnly ? l.newCount : l.allCount }))
    .filter((l) => l.displayCount > 0)
    .sort((a, b) => b.displayCount - a.displayCount);

  const maxCount = data[0]?.displayCount ?? 1;

  return (
    <div className="space-y-5">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-base text-foreground">
            Leather Types
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.length} leather types · {showNewOnly ? "new SKUs only" : "all SKUs"}
          </p>
        </div>
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

      {/* Bar list */}
      <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {data.map((leather, i) => {
            const pct = (leather.displayCount / maxCount) * 100;
            const newPct = leather.allCount > 0 ? (leather.newCount / leather.allCount) * 100 : 0;
            return (
              <div
                key={leather.name}
                className="px-5 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors"
              >
                {/* Rank */}
                <span className="text-xs tabular-nums text-muted-foreground w-6 text-right flex-shrink-0">
                  {i + 1}
                </span>

                {/* Name */}
                <span className="font-medium text-foreground text-sm w-40 flex-shrink-0 truncate">
                  {leather.name}
                </span>

                {/* Bar */}
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

                {/* Count */}
                <span
                  className="text-sm font-semibold tabular-nums w-8 text-right flex-shrink-0"
                  style={{ color: showNewOnly ? "oklch(0.55 0.14 55)" : "var(--foreground)" }}
                >
                  {leather.displayCount}
                </span>

                {/* New badge (only when showing all) */}
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
