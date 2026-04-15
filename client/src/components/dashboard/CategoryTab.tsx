/**
 * CategoryTab — shows each category as a card with SKU breakdown
 */

import { skuData } from "@/lib/skuData";

const CATEGORY_COLOURS: Record<string, string> = {
  "Dress Shoe": "#f59e0b",
  "Dress Sandal": "#10b981",
  "Ballet Flat": "#8b5cf6",
  "Loafer": "#3b82f6",
  "Wedge": "#f97316",
  "Sandal": "#06b6d4",
  "Ankle Boot": "#ec4899",
  "Calf Boot": "#6b7280",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Dress Shoe": "👠",
  "Dress Sandal": "👡",
  "Ballet Flat": "🩰",
  "Loafer": "🥿",
  "Wedge": "👢",
  "Sandal": "🩴",
  "Ankle Boot": "👢",
  "Calf Boot": "👢",
};

export default function CategoryTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
        {skuData.categories.map((cat) => {
          const colour = CATEGORY_COLOURS[cat.category] ?? "#6b7280";
          const icon = CATEGORY_ICONS[cat.category] ?? "👟";
          const pctNew = cat.pctNew;

          return (
            <div
              key={cat.category}
              className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
              style={{ borderColor: "var(--border)" }}
            >
              {/* Colour bar top */}
              <div className="h-1" style={{ background: colour }} />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-2xl">{icon}</span>
                    <h3 className="font-display font-semibold text-base text-foreground mt-1">
                      {cat.category}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cat.totalStyles} {(cat.totalStyles as number) === 1 ? "style" : "styles"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-display font-bold tabular-nums text-foreground">
                      {cat.totalSKUs}
                    </div>
                    <div className="text-xs text-muted-foreground">total SKUs</div>
                  </div>
                </div>

                {/* New vs Existing breakdown */}
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

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">% New SKUs</span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: colour }}>
                      {pctNew}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                    <div
                      className="h-full rounded-full bar-fill"
                      style={{ width: `${pctNew}%`, background: colour }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
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
              {skuData.categories
                .slice()
                .sort((a, b) => b.totalSKUs - a.totalSKUs)
                .map((cat) => {
                  const colour = CATEGORY_COLOURS[cat.category] ?? "#6b7280";
                  const avg = cat.totalStyles > 0 ? (cat.totalSKUs / cat.totalStyles).toFixed(1) : "0";
                  return (
                    <tr
                      key={cat.category}
                      className="border-b transition-colors hover:bg-muted/40"
                      style={{ borderColor: "var(--border)" }}
                    >
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
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${cat.pctNew}%`, background: colour }}
                            />
                          </div>
                          <span className="text-xs tabular-nums font-medium text-muted-foreground w-10 text-right">
                            {cat.pctNew}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
