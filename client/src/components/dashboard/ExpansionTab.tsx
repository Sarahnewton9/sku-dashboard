/**
 * ExpansionTab — New SKU expansion analysis
 * Buckets colours and leathers by how many styles they appear in (new SKUs only)
 */

import { useState } from "react";
import { skuData } from "@/lib/skuData";

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

function BucketSection({
  bucket,
  items,
}: {
  bucket: BucketType;
  items: ExpansionItem[];
}) {
  const config = BUCKET_CONFIG[bucket];
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ background: config.bg, borderBottom: `1px solid ${config.colour}30` }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: config.colour }}
          />
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
            {items.length} items
          </span>
        </div>
      </div>

      {/* Items grid */}
      <div className="bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
              style={{ borderColor: "var(--border)", background: "var(--muted)" }}
            >
              <span className="font-medium text-foreground">{item.name}</span>
              <span
                className="text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded"
                style={{ background: config.colour + "20", color: config.colour }}
              >
                {item.styleCount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type ExpansionItem = { name: string; styleCount: number; bucket: string; action: string };

export default function ExpansionTab() {
  const [view, setView] = useState<"colours" | "leathers">("colours");

  const items: ExpansionItem[] = view === "colours" ? [...skuData.expansion.colours] : [...skuData.expansion.leathers];

  const buckets: Record<BucketType, ExpansionItem[]> = {
    "Well covered": items.filter((i) => i.bucket === "Well covered"),
    "Good coverage": items.filter((i) => i.bucket === "Good coverage"),
    "Expand": items.filter((i) => i.bucket === "Expand"),
    "Priority expand": items.filter((i) => i.bucket === "Priority expand"),
  };

  const totalItems = items.length;
  const priorityCount = buckets["Priority expand"].length + buckets["Expand"].length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display font-semibold text-base text-foreground">
            New SKU Expansion Analysis
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Based on new SKUs only. Shows how many styles each {view === "colours" ? "colour" : "leather"} appears in across the new range.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg border bg-card flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setView("colours")}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{
              background: view === "colours" ? "var(--foreground)" : "transparent",
              color: view === "colours" ? "var(--background)" : "var(--muted-foreground)",
            }}
          >
            Colours
          </button>
          <button
            onClick={() => setView("leathers")}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{
              background: view === "leathers" ? "var(--foreground)" : "transparent",
              color: view === "leathers" ? "var(--background)" : "var(--muted-foreground)",
            }}
          >
            Leathers
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4">
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

      {priorityCount > 0 && (
        <div
          className="rounded-xl p-4 border flex items-start gap-3"
          style={{ background: "oklch(0.97 0.04 25)", borderColor: "#ef444430" }}
        >
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>
              {priorityCount} {view} need attention
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {buckets["Priority expand"].length} in "Priority Expand" (1–2 styles) and {buckets["Expand"].length} in "Expand" (3–4 styles).
              Consider adding these to more styles in the range.
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

      {/* Detailed table */}
      <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h4 className="font-display font-semibold text-sm text-foreground">
            Full {view === "colours" ? "Colour" : "Leather"} Breakdown
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">#</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  {view === "colours" ? "Colour" : "Leather"}
                </th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Styles</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Suggested Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const config = BUCKET_CONFIG[item.bucket as BucketType];
                return (
                  <tr
                    key={item.name}
                    className="border-b transition-colors hover:bg-muted/30"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-5 py-3 text-xs tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: config.colour }}>
                      {item.styleCount}
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
