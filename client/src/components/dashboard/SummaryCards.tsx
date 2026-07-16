/**
 * SummaryCards — Overview tab
 * Simplified: SKU counts, Style counts, combined Samples tile, category chart
 * Counts are live: includes custom SKUs from DB, excludes cancelled styles/SKUs.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { skuData } from "@/lib/skuData";
import { trpc } from "@/lib/trpc";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { useCancelledStyles } from "@/hooks/useCancelledStyles";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Package, Sparkles, Archive, Layers, Star, RefreshCw, FlaskConical, CheckCircle2 } from "lucide-react";
import { getNewLastsForSeason } from "@shared/const";
import { useSeason } from "@/contexts/SeasonContext";

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
  // Live data: custom SKUs from DB merged with static data
  const { mergedRawSkus } = useCustomSkus();
  const { cancelledSet: cancelledStyleSet } = useCancelledStyles();
  const { data: cancelledSkuList = [] } = trpc.cancelledSku.list.useQuery();

  // Build cancelled SKU set
  const cancelledSkuSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of cancelledSkuList as Array<{ style: string; colour: string; leather: string }>) {
      s.add(`${item.style}|${item.colour}|${item.leather}`);
    }
    return s;
  }, [cancelledSkuList]);

  // Compute live SKU and style counts (includes custom SKUs, excludes cancelled)
  const { liveCounts, liveStyleCounts } = useMemo(() => {
    // Group active SKUs by style
    const styleMap: Record<string, { hasNew: boolean; hasExisting: boolean }> = {};
    let totalSkus = 0;
    let newSkus = 0;

    for (const sku of mergedRawSkus) {
      if (cancelledStyleSet.has(sku.style)) continue;
      if (cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`)) continue;
      totalSkus++;
      if (sku.is_new) newSkus++;
      if (!styleMap[sku.style]) styleMap[sku.style] = { hasNew: false, hasExisting: false };
      if (sku.is_new) styleMap[sku.style].hasNew = true;
      else styleMap[sku.style].hasExisting = true;
    }

    const activeStyles = Object.values(styleMap);
    const totalStyles = activeStyles.length;
    // Brand new = style where ALL SKUs are new (no existing carry-over SKUs)
    const brandNewStyles = activeStyles.filter((s) => s.hasNew && !s.hasExisting).length;
    // Existing = style has at least one carry-over SKU (may also have new ones)
    const existingStyles = activeStyles.filter((s) => s.hasExisting).length;

    return {
      liveCounts: { total: totalSkus, newCount: newSkus, existing: totalSkus - newSkus },
      liveStyleCounts: { total: totalStyles, brandNew: brandNewStyles, existing: existingStyles },
    };
  }, [mergedRawSkus, cancelledStyleSet, cancelledSkuSet]);

  // Compute live category counts (custom SKUs mapped to their style's category)
  const liveCategoryData = useMemo(() => {
    const styleToCategory: Record<string, string> = {};
    for (const s of skuData.styles) styleToCategory[s.style] = s.category;
    const catMap: Record<string, { totalSKUs: number; newSKUs: number; existingSKUs: number; totalStyles: Set<string> }> = {};
    for (const sku of mergedRawSkus) {
      if (cancelledStyleSet.has(sku.style)) continue;
      if (cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`)) continue;
      const cat = styleToCategory[sku.style] ?? "Other";
      if (!catMap[cat]) catMap[cat] = { totalSKUs: 0, newSKUs: 0, existingSKUs: 0, totalStyles: new Set() };
      catMap[cat].totalSKUs++;
      if (sku.is_new) catMap[cat].newSKUs++; else catMap[cat].existingSKUs++;
      catMap[cat].totalStyles.add(sku.style);
    }
    return skuData.categories.map((c) => {
      const live = catMap[c.category];
      if (!live) return c;
      const pctNew = live.totalSKUs > 0 ? Math.round((live.newSKUs / live.totalSKUs) * 100) : 0;
      return { ...c, totalSKUs: live.totalSKUs, newSKUs: live.newSKUs, existingSKUs: live.existingSKUs, totalStyles: live.totalStyles.size, pctNew };
    });
  }, [mergedRawSkus, cancelledStyleSet, cancelledSkuSet]);

  // Build live summary — all counts are now live
  const s = {
    ...skuData.summary,
    totalSKUs: liveCounts.total,
    newSKUs: liveCounts.newCount,
    existingSKUs: liveCounts.existing,
    totalStyles: liveStyleCounts.total,
    brandNewStyles: liveStyleCounts.brandNew,
    existingStyles: liveStyleCounts.existing,
  };

  // Fetch live sample status counts
  const { data: skuMetaList = [] } = trpc.sku.getAll.useQuery();

  // Fetch last approval data — same sources as LastApprovalTab
  const { season } = useSeason();
  const { data: lastApprovals = [] } = trpc.lastApproval.getAll.useQuery({ season });
  const { data: deletedLastsFromDb = [] } = trpc.lastApproval.getDeleted.useQuery({ season });
  const { data: customLastsFromDb = [] } = trpc.customLast.getAll.useQuery({ season });

  // Build the same visible lasts list and approval map as LastApprovalTab (season-aware)
  const seasonLasts = useMemo(() => getNewLastsForSeason(season), [season]);
  const approvalMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of lastApprovals as Array<{ lastName: string; status: string }>) {
      map[a.lastName] = a.status;
    }
    return map;
  }, [lastApprovals]);
  const visibleLasts = useMemo(() => {
    const deletedSet = new Set(deletedLastsFromDb);
    const seen = new Set<string>();
    const merged: string[] = [];
    const customLasts = (customLastsFromDb as Array<{ lastName: string; isRunOn: boolean }>)
      .filter((l) => !l.isRunOn)
      .map((l) => l.lastName);
    for (const l of [...seasonLasts, ...customLasts]) {
      const key = l.toUpperCase();
      if (!seen.has(key)) { seen.add(key); merged.push(l); }
    }
    return merged.filter((l) => !deletedSet.has(l));
  }, [seasonLasts, customLastsFromDb, deletedLastsFromDb]);
  const totalLastsCount = visibleLasts.length;
  const approvedLastsCount = visibleLasts.filter((l) => approvalMap[l] === "approved").length;

  const sampleCounts = useMemo(() => {
    // Build a set of new SKU keys for fast lookup (use merged+filtered list)
    const newSkuKeys = new Set(
      mergedRawSkus
        .filter((s) => s.is_new && !cancelledStyleSet.has(s.style) && !cancelledSkuSet.has(`${s.style}|${s.colour}|${s.leather}`))
        .map((s) => `${s.style}|${s.colour}|${s.leather}`)
    );
    const newSkuCount = newSkuKeys.size;

    // Only count sample status for NEW SKUs
    let received = 0;
    let explicitlyWaiting = 0;
    const trackedNewKeys = new Set<string>();
    for (const m of skuMetaList) {
      const key = `${m.style}|${m.colour}|${m.leather}`;
      if (!newSkuKeys.has(key)) continue; // skip carry-over SKUs
      trackedNewKeys.add(key);
      if (m.sampleStatus === "received") received++;
      else if (m.sampleStatus === "fitting_sample") received++; // count fitting samples as received for progress
      else explicitlyWaiting++;
    }
    // New SKUs not yet in DB are implicitly "waiting"
    const untrackedWaiting = newSkuCount - trackedNewKeys.size;
    const waiting = explicitlyWaiting + Math.max(0, untrackedWaiting);
    return { waiting, received, total: newSkuCount };
  }, [skuMetaList, mergedRawSkus, cancelledStyleSet, cancelledSkuSet]);

  // SKU lists for hover tooltips
  const sampleSkuLists = useMemo(() => {
    const receivedSkus: string[] = [];
    const waitingSkus: string[] = [];

    // Build a set of SKU keys that are in the DB with a status
    const skuStatusMap: Record<string, "waiting" | "fitting_sample" | "received"> = {};
    for (const m of skuMetaList) {
      const key = `${m.style}|${m.colour}|${m.leather}`;
      skuStatusMap[key] = m.sampleStatus as "waiting" | "fitting_sample" | "received";
    }

    for (const sku of mergedRawSkus) {
      if (!sku.is_new) continue;
      if (cancelledStyleSet.has(sku.style)) continue;
      if (cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`)) continue;
      const key = `${sku.style}|${sku.colour}|${sku.leather}`;
      const label = `${sku.style} — ${sku.colour} ${sku.leather}`;
      if (skuStatusMap[key] === "received") {
        receivedSkus.push(label);
      } else if (skuStatusMap[key] === "fitting_sample") {
        receivedSkus.push(`${label} (fitting)`);
      } else {
        waitingSkus.push(label);
      }
    }

    return { receivedSkus, waitingSkus };
  }, [skuMetaList, mergedRawSkus, cancelledStyleSet, cancelledSkuSet]);

  const pctReceived = sampleCounts.total > 0
    ? Math.round((sampleCounts.received / sampleCounts.total) * 100)
    : 0;

  const chartData = liveCategoryData.map((c) => ({
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
          <MetricCard label="Existing Styles" value={s.existingStyles} icon={RefreshCw} sub="Carrying over" />
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

          {/* Counts row with hover tooltips */}
          <div className="grid grid-cols-2 gap-3">
            {/* Received tile */}
            <div className="group relative">
              <div
                className="rounded-lg px-4 py-3 flex items-center justify-between cursor-default"
                style={{ background: "oklch(0.94 0.08 155)", border: "1px solid oklch(0.85 0.12 155)" }}
              >
                <span className="text-sm font-medium" style={{ color: "oklch(0.40 0.14 155)" }}>Received</span>
                <span className="text-xl font-display font-bold tabular-nums" style={{ color: "oklch(0.40 0.14 155)" }}>
                  <AnimatedNumber value={sampleCounts.received} />
                </span>
              </div>
              {sampleSkuLists.receivedSkus.length > 0 && (
                <div
                  className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block w-72 max-h-64 overflow-y-auto rounded-lg shadow-lg border p-3"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Received Samples</p>
                  <ul className="space-y-1">
                    {sampleSkuLists.receivedSkus.map((sku) => (
                      <li key={sku} className="text-xs text-foreground">{sku}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Waiting tile */}
            <div className="group relative">
              <div
                className="rounded-lg px-4 py-3 flex items-center justify-between cursor-default"
                style={{ background: "oklch(0.97 0.06 65)", border: "1px solid oklch(0.88 0.10 65)" }}
              >
                <span className="text-sm font-medium" style={{ color: "oklch(0.45 0.14 55)" }}>Waiting</span>
                <span className="text-xl font-display font-bold tabular-nums" style={{ color: "oklch(0.45 0.14 55)" }}>
                  <AnimatedNumber value={sampleCounts.waiting} />
                </span>
              </div>
              {sampleSkuLists.waitingSkus.length > 0 && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block w-72 max-h-64 overflow-y-auto rounded-lg shadow-lg border p-3"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Waiting on Samples</p>
                  <ul className="space-y-1">
                    {sampleSkuLists.waitingSkus.map((sku) => (
                      <li key={sku} className="text-xs text-foreground">{sku}</li>
                    ))}
                  </ul>
                </div>
              )}
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
              <p className="text-xs text-muted-foreground">{totalLastsCount} new lasts this season</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-display font-bold tabular-nums" style={{ color: approvedLastsCount === totalLastsCount ? "oklch(0.40 0.14 155)" : "oklch(0.45 0.14 55)" }}>
                {approvedLastsCount}/{totalLastsCount}
              </p>
              <p className="text-xs text-muted-foreground">approved</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 rounded-full overflow-hidden mb-3" style={{ background: "var(--muted)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${totalLastsCount > 0 ? Math.round((approvedLastsCount / totalLastsCount) * 100) : 0}%`,
                background: approvedLastsCount === totalLastsCount
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
                <AnimatedNumber value={totalLastsCount - approvedLastsCount} />
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
              {liveCategoryData.map((cat) => (
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
