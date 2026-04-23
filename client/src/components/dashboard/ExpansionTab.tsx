/**
 * ExpansionTab — New SKU expansion analysis by Colour/Leather combination
 * Design: Refined Analytical Dashboard — warm off-white, Sora + Inter typography, amber accents
 * Uses rawSkus to compute how many styles each colour/leather combo appears in (new SKUs only).
 * Treats "BLACK VINTAGE" and "BLACK NAPPA" as distinct entries.
 */

import { useState, useMemo } from "react";
import { skuData } from "@/lib/skuData";
import { trpc } from "@/lib/trpc";
import { Search } from "lucide-react";

type BucketType = "Well covered" | "Good coverage" | "Expand" | "Priority expand";

const BUCKET_CONFIG: Record<BucketType, { label: string; range: string; colour: string; bg: string; description: string }> = {
  "Well covered": {
    label: "Well Covered",
    range: "10+ styles",
    colour: "#10b981",
    bg: "oklch(0.96 0.05 150)",
    description: "Maintain current range — strong representation",
  },
  "Good coverage": {
    label: "Good Coverage",
    range: "5–9 styles",
    colour: "#3b82f6",
    bg: "oklch(0.96 0.04 230)",
    description: "Consider selective additions",
  },
  "Expand": {
    label: "Expand",
    range: "3–4 styles",
    colour: "#f97316",
    bg: "oklch(0.97 0.05 55)",
    description: "Moderate coverage — expand to more styles",
  },
  "Priority expand": {
    label: "Priority Expand",
    range: "1–2 styles",
    colour: "#ef4444",
    bg: "oklch(0.97 0.04 25)",
    description: "Very few new SKUs — prioritise adding to more styles",
  },
};

function getBucket(styleCount: number): BucketType {
  if (styleCount >= 10) return "Well covered";
  if (styleCount >= 5) return "Good coverage";
  if (styleCount >= 3) return "Expand";
  return "Priority expand";
}

function getAction(bucket: BucketType): string {
  switch (bucket) {
    case "Well covered": return "Maintain current range";
    case "Good coverage": return "Consider selective additions";
    case "Expand": return "Expand to more styles";
    case "Priority expand": return "Prioritise adding to more styles";
  }
}

type ExpansionItem = {
  key: string;
  colour: string;
  leather: string;
  newStyleCount: number;
  totalStyleCount: number;
  newSkuCount: number;
  totalSkuCount: number;
  bucket: BucketType;
  action: string;
};

function buildExpansionData(
  cancelledStyleSet: Set<string>,
  cancelledSkuSet: Set<string>
): ExpansionItem[] {
  const raw = (skuData as any).rawSkus as Array<{
    style: string; colour: string; leather: string; is_new: boolean;
  }>;
  if (!raw) return [];

  // Count per combo: styles that have new SKUs, and total styles
  const newStylesMap = new Map<string, Set<string>>();
  const totalStylesMap = new Map<string, Set<string>>();
  const newSkuCount = new Map<string, number>();
  const totalSkuCount = new Map<string, number>();
  const comboMeta = new Map<string, { colour: string; leather: string }>();

  for (const r of raw) {
    // Skip cancelled styles and individually cancelled SKUs
    if (cancelledStyleSet.has(r.style)) continue;
    if (cancelledSkuSet.has(`${r.style}|${r.colour}|${r.leather}`)) continue;
    const key = (r.colour + (r.leather ? " " + r.leather : "")).trim();
    if (!key) continue;
    if (!comboMeta.has(key)) comboMeta.set(key, { colour: r.colour, leather: r.leather });

    if (!totalStylesMap.has(key)) totalStylesMap.set(key, new Set());
    totalStylesMap.get(key)!.add(r.style);
    totalSkuCount.set(key, (totalSkuCount.get(key) ?? 0) + 1);

    if (r.is_new) {
      if (!newStylesMap.has(key)) newStylesMap.set(key, new Set());
      newStylesMap.get(key)!.add(r.style);
      newSkuCount.set(key, (newSkuCount.get(key) ?? 0) + 1);
    }
  }

  const items: ExpansionItem[] = [];
  for (const [key, meta] of Array.from(comboMeta.entries())) {
    const newStyles = newStylesMap.get(key)?.size ?? 0;
    if (newStyles === 0) continue; // Only show combos that appear in at least one new SKU
    const totalStyles = totalStylesMap.get(key)?.size ?? 0;
    const bucket = getBucket(newStyles);
    items.push({
      key,
      colour: meta.colour,
      leather: meta.leather,
      newStyleCount: newStyles,
      totalStyleCount: totalStyles,
      newSkuCount: newSkuCount.get(key) ?? 0,
      totalSkuCount: totalSkuCount.get(key) ?? 0,
      bucket,
      action: getAction(bucket),
    });
  }

  // Sort by newStyleCount desc, then alphabetically
  return items.sort((a, b) => b.newStyleCount - a.newStyleCount || a.key.localeCompare(b.key));
}

function BucketSection({ bucket, items }: { bucket: BucketType; items: ExpansionItem[] }) {
  const config = BUCKET_CONFIG[bucket];
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ background: config.bg, borderBottom: `1px solid ${config.colour}30` }}
      >
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: config.colour }} />
          <div>
            <span className="font-display font-semibold text-sm" style={{ color: config.colour }}>
              {config.label}
            </span>
            <span className="text-xs text-muted-foreground ml-2">({config.range})</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{config.description}</span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: config.colour + "20", color: config.colour }}
          >
            {items.length} combos
          </span>
        </div>
      </div>
      <div className="bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
              style={{ borderColor: "var(--border)", background: "var(--muted)" }}
              title={`${item.newSkuCount} new SKUs · ${item.totalSkuCount} total SKUs`}
            >
              <span className="font-medium text-foreground">{item.key}</span>
              <span
                className="text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded"
                style={{ background: config.colour + "20", color: config.colour }}
              >
                {item.newStyleCount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ExpansionTab() {
  const [search, setSearch] = useState("");

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

  const allExpansion = useMemo(
    () => buildExpansionData(cancelledStyleSet, cancelledSkuSet),
    [cancelledStyleSet, cancelledSkuSet]
  );

  const filtered = useMemo(() => {
    if (!search) return allExpansion;
    const q = search.toLowerCase();
    return allExpansion.filter((i) => i.key.toLowerCase().includes(q));
  }, [search, allExpansion]);

  const buckets: Record<BucketType, ExpansionItem[]> = {
    "Well covered": filtered.filter((i) => i.bucket === "Well covered"),
    "Good coverage": filtered.filter((i) => i.bucket === "Good coverage"),
    "Expand": filtered.filter((i) => i.bucket === "Expand"),
    "Priority expand": filtered.filter((i) => i.bucket === "Priority expand"),
  };

  const priorityCount = buckets["Priority expand"].length + buckets["Expand"].length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-base text-foreground">
            New SKU Expansion Analysis
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Based on new SKUs only. Shows how many styles each colour/leather combination appears in across the new range.
          </p>
        </div>
        {/* Search */}
        <div className="relative flex-shrink-0 w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search colour/leather…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(Object.entries(BUCKET_CONFIG) as [BucketType, typeof BUCKET_CONFIG[BucketType]][]).map(([key, config]) => (
          <div
            key={key}
            className="rounded-xl p-4 border"
            style={{ background: config.bg, borderColor: config.colour + "30" }}
          >
            <div className="text-2xl font-display font-bold tabular-nums" style={{ color: config.colour }}>
              {buckets[key].length}
            </div>
            <div className="text-sm font-medium mt-0.5" style={{ color: config.colour }}>
              {config.label}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{config.range}</div>
          </div>
        ))}
      </div>

      {priorityCount > 0 && !search && (
        <div
          className="rounded-xl p-4 border flex items-start gap-3"
          style={{ background: "oklch(0.97 0.04 25)", borderColor: "#ef444430" }}
        >
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>
              {priorityCount} colour/leather combos need attention
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {buckets["Priority expand"].length} in "Priority Expand" (1–2 styles) and {buckets["Expand"].length} in "Expand" (3–4 styles).
              Consider adding these combinations to more styles in the range.
            </p>
          </div>
        </div>
      )}

      {/* Bucket sections */}
      <div className="space-y-4">
        {(["Well covered", "Good coverage", "Expand", "Priority expand"] as BucketType[]).map((bucket) => (
          <BucketSection key={bucket} bucket={bucket} items={buckets[bucket]} />
        ))}
      </div>

      {/* Full table */}
      <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h4 className="font-display font-semibold text-sm text-foreground">
            Full Colour/Leather Breakdown
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Showing {filtered.length} colour/leather combinations with new SKUs
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">#</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Colour / Leather</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">New Styles</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">New SKUs</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Total SKUs</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Suggested Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const config = BUCKET_CONFIG[item.bucket];
                return (
                  <tr
                    key={item.key}
                    className="border-b transition-colors hover:bg-muted/30"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-5 py-3 text-xs tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{item.key}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: config.colour }}>
                      {item.newStyleCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {item.newSkuCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {item.totalSkuCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: config.colour + "20", color: config.colour }}
                      >
                        {config.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{item.action}</td>
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
