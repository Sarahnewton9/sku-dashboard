/**
 * ColoursTab — all colours with usage counts, toggleable All/New Only
 */

import { useState, useMemo } from "react";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { trpc } from "@/lib/trpc";

// Map colour names to approximate hex values for visual swatches
const COLOUR_SWATCHES: Record<string, string> = {
  BLACK: "#1a1a1a",
  CHOC: "#5c3317",
  CHOCOLATE: "#5c3317",
  WHITE: "#f5f5f5",
  MILK: "#f0e8d8",
  IVORY: "#fffff0",
  VANILLA: "#f3e5ab",
  CREAM: "#fffdd0",
  BONE: "#e8dcc8",
  TAN: "#d2b48c",
  CARAMEL: "#c68642",
  COGNAC: "#9a4722",
  ESPRESSO: "#3c1a0e",
  VINO: "#722f37",
  BORDEAUX: "#722f37",
  RED: "#cc0000",
  SCARLET: "#ff2400",
  CHERRY: "#de3163",
  TOMATO: "#ff6347",
  CINNABAR: "#e34234",
  FUCHSIA: "#ff00ff",
  PETAL: "#ffd1dc",
  BLUSH: "#ffb6c1",
  PINK: "#ffc0cb",
  ROSE: "#ff007f",
  BLOSSOM: "#ffb7c5",
  CORAL: "#ff7f50",
  PEACH: "#ffcba4",
  AMBER: "#ffbf00",
  GOLD: "#ffd700",
  BRONZE: "#cd7f32",
  COPPER: "#b87333",
  SILVER: "#c0c0c0",
  PEWTER: "#899499",
  STEEL: "#71797e",
  GREY: "#808080",
  STONE: "#928e85",
  TAUPE: "#483c32",
  DOVE: "#d5d5d5",
  ASHEN: "#b2beb5",
  CEMENTO: "#8f8f8f",
  SLATE: "#708090",
  DENIM: "#1560bd",
  SKY: "#87ceeb",
  BLUE: "#0000ff",
  NAVY: "#000080",
  COBALT: "#0047ab",
  TEAL: "#008080",
  MINT: "#98ff98",
  SAGE: "#bcb88a",
  GREEN: "#008000",
  OLIVE: "#808000",
  JADE: "#00a86b",
  WILLOW: "#a2b87e",
  WHEAT: "#f5deb3",
  OAT: "#c8a97e",
  BISCUIT: "#d4a373",
  BISQUE: "#ffe4c4",
  PERU: "#cd853f",
  SKIN: "#ffdbac",
  NUDE: "#f5cba7",
  ECRU: "#c2b280",
  SAND: "#c2b280",
  LATTE: "#c8a97e",
  BROWN: "#964b00",
  PURPLE: "#800080",
  VIOLET: "#ee82ee",
  PLUM: "#dda0dd",
  MAUVE: "#e0b0ff",
  CLEAR: "#e8e8e8",
  MULTI: "#ff69b4",
};

function ColourSwatch({ colour }: { colour: string }) {
  const hex = COLOUR_SWATCHES[colour.toUpperCase()] ?? "#d4d4d4";
  const isLight = hex === "#f5f5f5" || hex === "#f0e8d8" || hex === "#fffff0" || hex === "#f3e5ab" || hex === "#fffdd0" || hex === "#e8dcc8";
  return (
    <span
      className="inline-block w-4 h-4 rounded-full flex-shrink-0 border"
      style={{
        background: hex,
        borderColor: isLight ? "oklch(0.80 0.01 80)" : "transparent",
      }}
    />
  );
}

export default function ColoursTab() {
  const [showNewOnly, setShowNewOnly] = useState(false);

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

  const { mergedRawSkus } = useCustomSkus();

  // Rebuild colour counts dynamically from mergedRawSkus (includes custom SKUs)
  const data = useMemo(() => {
    const colourMap = new Map<string, { name: string; allCount: number; newCount: number }>();
    for (const sku of (mergedRawSkus as unknown as Array<{ style: string; colour: string; leather: string; is_new: boolean }>)) {
      if (cancelledStyleSet.has(sku.style)) continue;
      if (cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`)) continue;
      if (!sku.colour) continue;
      if (!colourMap.has(sku.colour)) colourMap.set(sku.colour, { name: sku.colour, allCount: 0, newCount: 0 });
      const entry = colourMap.get(sku.colour)!;
      entry.allCount++;
      if (sku.is_new) entry.newCount++;
    }
    return Array.from(colourMap.values())
      .map((c) => ({ ...c, displayCount: showNewOnly ? c.newCount : c.allCount }))
      .filter((c) => c.displayCount > 0)
      .sort((a, b) => b.displayCount - a.displayCount);
  }, [mergedRawSkus, cancelledStyleSet, cancelledSkuSet, showNewOnly]);

  const maxCount = data[0]?.displayCount ?? 1;

  return (
    <div className="space-y-5">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-base text-foreground">
            Colours
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.length} colours · {showNewOnly ? "new SKUs only" : "all SKUs"}
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
          {data.map((colour, i) => {
            const pct = (colour.displayCount / maxCount) * 100;
            return (
              <div
                key={colour.name}
                className="px-5 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors"
              >
                {/* Rank */}
                <span className="text-xs tabular-nums text-muted-foreground w-6 text-right flex-shrink-0">
                  {i + 1}
                </span>

                {/* Swatch */}
                <ColourSwatch colour={colour.name} />

                {/* Name */}
                <span className="font-medium text-foreground text-sm w-32 flex-shrink-0 truncate">
                  {colour.name}
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
                  {colour.displayCount}
                </span>

                {/* New badge (only when showing all) */}
                {!showNewOnly && colour.newCount > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}
                  >
                    {colour.newCount} new
                  </span>
                )}
                {!showNewOnly && colour.newCount === 0 && (
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
