/**
 * SummaryCards — Overview tab
 * Simplified: SKU counts, Style counts, combined Samples tile, category chart
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { skuData } from "@/lib/skuData";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Package, Sparkles, Archive, Layers, Star, RefreshCw, FlaskConical, CheckCircle2 } from "lucide-react";

// Hardcoded list of brand new lasts this season
const TOTAL_NEW_LASTS = 16;

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

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

interface MetricCardProps {
  label: string;
  value: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  accent?: boolean;
  accentColor?: "amber" | "green" | "neutral";
  sub?: string;
}

function MetricCard({ label, value, icon: Icon, accent, accentColor = "amber", sub }: MetricCardProps) {
  const bgMap = {
    amber: "oklch(0.97 0.06 65)",
    green: "oklch(0.94 0.08 155)",
    neutral: "var(--card)",
  };
  const borderMap = {
    amber: "oklch(0.88 0.10 65)",
    green: "oklch(0.85 0.12 155)",
    neutral: "var(--border)",
  };
  const iconBgMap = {
    amber: "oklch(0.72 0.16 65)",
    green: "oklch(0.72 0.18 155)",
    neutral: "var(--muted)",
  };
  const textMap = {
    amber: "oklch(0.45 0.14 55)",
    green: "oklch(0.40 0.14 155)",
    neutral: "var(--foreground)",
  };

  const bg = accent ? bgMap[accentColor] : "var(--card)";
  const border = accent ? borderMap[accentColor] : "var(--border)";
  const iconBg = accent ? iconBgMap[accentColor] : "var(--muted)";
  const textColor = accent ? textMap[accentColor] : "var(--foreground)";

  return (
    <div
      className="rounded-xl p-5 border transition-shadow hover:shadow-md"
      style={{ background: bg, borderColor: border }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>
          <span style={{ color: accent ? "white" : "var(--muted-foreground)" }} className="flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </span>
        </div>
      </div>
      <div className="text-3xl font-display font-bold tabular-nums" style={{ color: textColor }}>
        <AnimatedNumber value={value} />
      </div>
      <p className="text-sm font-medium mt-1" style={{ color: "var(--muted-foreground)" }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "oklch(0.65 0.01 80)" }}>{sub}</p>}
    </div>
  );
}

export default function SummaryCards() {
  const s = skuData.summary;

  // Fetch live sample status counts
  const { data: skuMetaList = [] } = trpc.sku.getAll.useQuery();

  // Fetch last approval data
  const { data: lastApprovals = [] } = trpc.lastApproval.getAll.useQuery();
  const approvedLastsCount = lastApprovals.filter((a) => a.status === "approved").length;

  // Build a style → category map from skuData.styles
  const styleCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of skuData.styles) {
      map[s.style] = s.category;
    }
    return map;
  }, []);

  const sampleCounts = useMemo(() => {
    let waiting = 0;
    let received = 0;
    for (const m of skuMetaList) {
      if (m.sampleStatus === "waiting") waiting++;
      else if (m.sampleStatus === "received") received++;
    }
    // New SKUs not yet in DB are implicitly "waiting"
    const newSkuCount = skuData.rawSkus.filter((s) => s.is_new).length;
    const untrackedWaiting = Math.max(0, newSkuCount - skuMetaList.length);
    return { waiting: waiting + untrackedWaiting, received, total: newSkuCount };
  }, [skuMetaList]);

  // Per-category sample breakdown
  const categorySampleBreakdown = useMemo(() => {
    // Build a map of style → sampleStatus from DB records
    const skuStatusMap: Record<string, "waiting" | "received"> = {};
    for (const m of skuMetaList) {
      const key = `${m.style}|${m.colour}|${m.leather}`;
      skuStatusMap[key] = m.sampleStatus as "waiting" | "received";
    }

    // Aggregate per category for new SKUs only
    const catMap: Record<string, { received: number; waiting: number; total: number }> = {};
    for (const sku of skuData.rawSkus) {
      if (!sku.is_new) continue;
      const cat = styleCategoryMap[sku.style] ?? "Other";
      if (!catMap[cat]) catMap[cat] = { received: 0, waiting: 0, total: 0 };
      catMap[cat].total++;
      const key = `${sku.style}|${sku.colour}|${sku.leather}`;
      if (skuStatusMap[key] === "received") {
        catMap[cat].received++;
      } else {
        catMap[cat].waiting++;
      }
    }

    // Sort by category name
    return Object.entries(catMap)
      .map(([category, counts]) => ({ category, ...counts }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [skuMetaList, styleCategoryMap]);

  const pctReceived = sampleCounts.total > 0
    ? Math.round((sampleCounts.received / sampleCounts.total) * 100)
    : 0;

  const chartData = skuData.categories.map((c) => ({
    name: c.category.replace("Dress ", "D.").replace("Ballet Flat", "Ballet").replace("Ankle Boot", "A.Boot").replace("Calf Boot", "C.Boot"),
    fullName: c.category,
    new: c.newSKUs,
    existing: c.existingSKUs,
    total: c.totalSKUs,
  }));

  return (
    <div className="space-y-8">
      {/* SKU counts */}
      <div>
        <h3 className="font-display font-semibold text-base mb-4 text-foreground">SKUs</h3>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Total SKUs" value={s.totalSKUs} icon={Package} />
          <MetricCard label="New SKUs" value={s.newSKUs} icon={Sparkles} accent accentColor="amber" sub="New this season" />
          <MetricCard label="Existing SKUs" value={s.existingSKUs} icon={Archive} sub="Carried over" />
        </div>
      </div>

      {/* Style counts */}
      <div>
        <h3 className="font-display font-semibold text-base mb-4 text-foreground">Styles</h3>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Total Styles" value={s.totalStyles} icon={Layers} />
          <MetricCard label="New Styles" value={s.brandNewStyles} icon={Star} accent accentColor="amber" sub="All SKUs are new" />
          <MetricCard label="Existing Styles" value={(s as any).existingStyles} icon={RefreshCw} sub="Carrying over" />
        </div>
      </div>

      {/* Samples — combined tile */}
      <div>
        <h3 className="font-display font-semibold text-base mb-4 text-foreground">Samples</h3>
        <div
          className="rounded-xl border p-5 transition-shadow hover:shadow-md"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--muted)" }}>
              <FlaskConical className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Sample Tracking</p>
              <p className="text-xs text-muted-foreground">{sampleCounts.total} new SKUs total</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-display font-bold tabular-nums" style={{ color: "oklch(0.40 0.14 155)" }}>
                {pctReceived}%
              </p>
              <p className="text-xs text-muted-foreground">received</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 rounded-full overflow-hidden mb-3" style={{ background: "var(--muted)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pctReceived}%`,
                background: "linear-gradient(90deg, oklch(0.72 0.18 155), oklch(0.60 0.20 155))",
              }}
            />
          </div>

          {/* Counts row */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div
              className="rounded-lg px-4 py-3 flex items-center justify-between"
              style={{ background: "oklch(0.94 0.08 155)", border: "1px solid oklch(0.85 0.12 155)" }}
            >
              <span className="text-sm font-medium" style={{ color: "oklch(0.40 0.14 155)" }}>Received</span>
              <span className="text-xl font-display font-bold tabular-nums" style={{ color: "oklch(0.40 0.14 155)" }}>
                <AnimatedNumber value={sampleCounts.received} />
              </span>
            </div>
            <div
              className="rounded-lg px-4 py-3 flex items-center justify-between"
              style={{ background: "oklch(0.97 0.06 65)", border: "1px solid oklch(0.88 0.10 65)" }}
            >
              <span className="text-sm font-medium" style={{ color: "oklch(0.45 0.14 55)" }}>Waiting</span>
              <span className="text-xl font-display font-bold tabular-nums" style={{ color: "oklch(0.45 0.14 55)" }}>
                <AnimatedNumber value={sampleCounts.waiting} />
              </span>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">By Category</p>
            <div className="space-y-2.5">
              {categorySampleBreakdown.map(({ category, received, waiting, total }) => {
                const pct = total > 0 ? Math.round((received / total) * 100) : 0;
                const allDone = received === total;
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">{category}</span>
                      <span className="text-xs tabular-nums" style={{ color: allDone ? "oklch(0.40 0.14 155)" : "var(--muted-foreground)" }}>
                        {received}/{total}
                        {waiting > 0 && (
                          <span className="ml-1.5" style={{ color: "oklch(0.55 0.12 55)" }}>({waiting} waiting)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: allDone
                            ? "oklch(0.60 0.20 155)"
                            : "oklch(0.72 0.16 65)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Last Approval progress */}
      <div>
        <h3 className="font-display font-semibold text-base mb-4 text-foreground">Lasts</h3>
        <div
          className="rounded-xl border p-5 transition-shadow hover:shadow-md"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--muted)" }}>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Last Approvals</p>
              <p className="text-xs text-muted-foreground">{TOTAL_NEW_LASTS} new lasts this season</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-display font-bold tabular-nums" style={{ color: approvedLastsCount === TOTAL_NEW_LASTS ? "oklch(0.40 0.14 155)" : "oklch(0.45 0.14 55)" }}>
                {approvedLastsCount}/{TOTAL_NEW_LASTS}
              </p>
              <p className="text-xs text-muted-foreground">approved</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 rounded-full overflow-hidden mb-3" style={{ background: "var(--muted)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.round((approvedLastsCount / TOTAL_NEW_LASTS) * 100)}%`,
                background: approvedLastsCount === TOTAL_NEW_LASTS
                  ? "linear-gradient(90deg, oklch(0.72 0.18 155), oklch(0.60 0.20 155))"
                  : "linear-gradient(90deg, oklch(0.72 0.16 65), oklch(0.60 0.18 55))",
              }}
            />
          </div>

          {/* Counts row */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-lg px-4 py-3 flex items-center justify-between"
              style={{ background: "oklch(0.94 0.08 155)", border: "1px solid oklch(0.85 0.12 155)" }}
            >
              <span className="text-sm font-medium" style={{ color: "oklch(0.40 0.14 155)" }}>Approved</span>
              <span className="text-xl font-display font-bold tabular-nums" style={{ color: "oklch(0.40 0.14 155)" }}>
                <AnimatedNumber value={approvedLastsCount} />
              </span>
            </div>
            <div
              className="rounded-lg px-4 py-3 flex items-center justify-between"
              style={{ background: "oklch(0.97 0.06 65)", border: "1px solid oklch(0.88 0.10 65)" }}
            >
              <span className="text-sm font-medium" style={{ color: "oklch(0.45 0.14 55)" }}>Waiting on Revised</span>
              <span className="text-xl font-display font-bold tabular-nums" style={{ color: "oklch(0.45 0.14 55)" }}>
                <AnimatedNumber value={TOTAL_NEW_LASTS - approvedLastsCount} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* New vs Existing bar */}
      <div className="rounded-xl border p-5 bg-card" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-base text-foreground">New vs Existing SKUs by Category</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#f59e0b" }} />
              New
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "oklch(0.88 0.01 80)" }} />
              Existing
            </span>
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={28} barGap={2}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "oklch(0.52 0.012 60)", fontFamily: "Inter" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "oklch(0.52 0.012 60)", fontFamily: "Inter" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                cursor={{ fill: "oklch(0.94 0.008 80)" }}
                contentStyle={{
                  background: "white",
                  border: "1px solid oklch(0.88 0.01 80)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontFamily: "Inter",
                }}
                formatter={(value: number, name: string) => [
                  value.toLocaleString(),
                  name === "new" ? "New SKUs" : "Existing SKUs",
                ]}
                labelFormatter={(label: string) => {
                  const item = chartData.find((d) => d.name === label);
                  return item?.fullName ?? label;
                }}
              />
              <Bar dataKey="existing" stackId="a" fill="oklch(0.88 0.01 80)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="new" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category summary table */}
      <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-display font-semibold text-base text-foreground">Category Summary</h3>
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
                <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">% New</th>
              </tr>
            </thead>
            <tbody>
              {skuData.categories.map((cat) => (
                <tr
                  key={cat.category}
                  className="border-b transition-colors hover:bg-muted/40"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: CATEGORY_COLOURS[cat.category] ?? "#6b7280" }}
                      />
                      <span className="font-medium text-foreground">{cat.category}</span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{cat.totalStyles}</td>
                  <td className="text-right px-4 py-3 tabular-nums font-medium text-foreground">{cat.totalSKUs}</td>
                  <td className="text-right px-4 py-3 tabular-nums">
                    <span className="font-semibold" style={{ color: "oklch(0.55 0.14 55)" }}>{cat.newSKUs}</span>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{cat.existingSKUs}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)", minWidth: 60 }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${cat.pctNew}%`,
                            background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums font-medium text-muted-foreground w-10 text-right">
                        {cat.pctNew}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
