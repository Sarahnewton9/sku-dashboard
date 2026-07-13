/**
 * BuyAnalysisTab — expanded analysis of pairs bought per session
 * Supports multi-session selection, per-SKU table, session comparison, and not-yet-bought filter
 */

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { useStyleCategories } from "@/hooks/useStyleCategories";
import { useCancelledStyles } from "@/hooks/useCancelledStyles";
import { BarChart3, ChevronDown, Package, Check, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { displayColour, displayLeather } from "@/lib/utils";

type SortField = "style" | "colour" | "leather" | "category" | "last" | "au" | "usa" | "nyc" | "la" | "total";
type SortDir = "asc" | "desc";
type ViewTab = "summary" | "sku-table" | "not-bought" | "pairs-breakdown";

export default function BuyAnalysisTab() {
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("summary");
  const [sortField, setSortField] = useState<SortField>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [lastFilter, setLastFilter] = useState<string>("All");
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());

  const { mergedRawSkus, mergedStyles } = useCustomSkus();
  const { cancelledSet: cancelledStyleSet } = useCancelledStyles();
  const { data: cancelledSkusRaw = [] } = trpc.cancelledSku.list.useQuery();
  const cancelledSkuSet = useMemo(
    () => new Set((cancelledSkusRaw as any[]).map((r: any) => `${r.style}|${r.colour}|${r.leather}`)),
    [cancelledSkusRaw]
  );

  const { data: allSessions = [] } = trpc.buy.getSessions.useQuery();
  const { data: activeSession } = trpc.buy.getActive.useQuery();
  const { data: allSessionQtys = {} } = trpc.buy.getAllSessionQtys.useQuery();
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
    const map = new Map<string, { style: string; colour: string; leather: string; auQty: number; usaQty: number; nycQty: number; laQty: number; sessionBreakdown: Array<{ sessionId: number; sessionName: string; au: number; usa: number; nyc: number; la: number }> }>();
    for (let i = 0; i < selectedSessionIds.length; i++) {
      const sessionId = selectedSessionIds[i];
      const sessionName = (allSessions as Array<{ id: number; name: string }>).find((s) => s.id === sessionId)?.name ?? `Session ${sessionId}`;
      const items = ((sessionQueries[i]?.data ?? []) as Array<{ style: string; colour: string; leather: string; auQty?: number; usaQty?: number; nycQty?: number; laQty?: number; qty?: number }>);
      for (const item of items) {
        const au = item.auQty ?? 0;
        const usa = item.usaQty ?? 0;
        const nyc = item.nycQty ?? 0;
        const la = item.laQty ?? 0;
        if (au === 0 && usa === 0 && nyc === 0 && la === 0) continue;
        const key = `${item.style}|${item.colour}|${item.leather}`;
        const existing = map.get(key) ?? { style: item.style, colour: item.colour, leather: item.leather, auQty: 0, usaQty: 0, nycQty: 0, laQty: 0, sessionBreakdown: [] };
        existing.auQty += au;
        existing.usaQty += usa;
        existing.nycQty += nyc;
        existing.laQty += la;
        existing.sessionBreakdown.push({ sessionId, sessionName, au, usa, nyc, la });
        map.set(key, existing);
      }
    }
    return Array.from(map.values());
  }, [sessionQueries, selectedSessionIds, allSessions]);

  // Build style info lookup with runtime category overrides (uses mergedStyles for custom styles)
  const styleInfoMap = useMemo((): Record<string, { category: string; last: string }> => {
    const map: Record<string, { category: string; last: string }> = {};
    const styles = (mergedStyles as unknown) as Array<{ style: string; category: string; last: string }>;
    styles.forEach((s) => {
      map[s.style] = { category: getCategory(s.style, s.category), last: s.last };
    });
    return map;
  }, [mergedStyles, getCategory]);

  // Build raw SKU lookup for is_new per SKU (uses mergedRawSkus to include custom SKUs)
  const rawSkuMap = useMemo((): Record<string, boolean> => {
    const map: Record<string, boolean> = {};
    const rawSkus = (mergedRawSkus as unknown) as Array<{ style: string; colour: string; leather: string; is_new: boolean }>;
    rawSkus.forEach((sku) => {
      map[`${sku.style}|${sku.colour}|${sku.leather}`] = sku.is_new;
    });
    return map;
  }, [mergedRawSkus]);

  // All SKUs in the range — use mergedRawSkus to include custom SKUs added via PPT import
  const allRangeSkus = useMemo(() => {
    return (mergedRawSkus as unknown) as Array<{ style: string; colour: string; leather: string; is_new: boolean }>;
  }, [mergedRawSkus]);

  // Only items with any qty (for selected sessions)
  const boughtItems = useMemo(() => mergedItems.filter((i) => i.auQty + i.usaQty + i.nycQty + i.laQty > 0), [mergedItems]);
  const totalAU = useMemo(() => boughtItems.reduce((s, i) => s + i.auQty, 0), [boughtItems]);
  const totalUSA = useMemo(() => boughtItems.reduce((s, i) => s + i.usaQty, 0), [boughtItems]);
  const totalNYC = useMemo(() => boughtItems.reduce((s, i) => s + i.nycQty, 0), [boughtItems]);
  const totalLA = useMemo(() => boughtItems.reduce((s, i) => s + i.laQty, 0), [boughtItems]);
  const totalPairs = totalAU + totalUSA + totalNYC + totalLA;

  // Not yet bought — NEW SKUs only with zero total across ALL sessions, excluding cancelled styles/SKUs
  const notBoughtSkus = useMemo(() => {
    const allQtys = allSessionQtys as Record<string, { total: number }>;
    return allRangeSkus.filter((sku) => {
      if (!sku.is_new) return false; // only show new SKUs
      if (cancelledStyleSet.has(sku.style)) return false; // exclude cancelled styles
      const key = `${sku.style}|${sku.colour}|${sku.leather}`;
      if (cancelledSkuSet.has(key)) return false; // exclude cancelled SKUs
      return !allQtys[key] || allQtys[key].total === 0;
    });
  }, [allRangeSkus, allSessionQtys, cancelledStyleSet, cancelledSkuSet]);

  // By category
  const byCategory = useMemo(() => {
    const map: Record<string, { au: number; usa: number; nyc: number; la: number }> = {};
    for (const item of boughtItems) {
      const cat = styleInfoMap[item.style]?.category ?? "Unknown";
      if (!map[cat]) map[cat] = { au: 0, usa: 0, nyc: 0, la: 0 };
      map[cat].au += item.auQty;
      map[cat].usa += item.usaQty;
      map[cat].nyc += item.nycQty;
      map[cat].la += item.laQty;
    }
    return Object.entries(map)
      .map(([cat, v]) => ({ cat, au: v.au, usa: v.usa, nyc: v.nyc, la: v.la, total: v.au + v.usa + v.nyc + v.la }))
      .sort((a, b) => b.total - a.total);
  }, [boughtItems, styleInfoMap]);

  // By style
  const byStyle = useMemo(() => {
    const map: Record<string, { au: number; usa: number; nyc: number; la: number }> = {};
    for (const item of boughtItems) {
      if (!map[item.style]) map[item.style] = { au: 0, usa: 0, nyc: 0, la: 0 };
      map[item.style].au += item.auQty;
      map[item.style].usa += item.usaQty;
      map[item.style].nyc += item.nycQty;
      map[item.style].la += item.laQty;
    }
    return Object.entries(map)
      .map(([style, v]) => ({ style, au: v.au, usa: v.usa, nyc: v.nyc, la: v.la, total: v.au + v.usa + v.nyc + v.la }))
      .sort((a, b) => b.total - a.total);
  }, [boughtItems]);

  // By leather
  const byLeather = useMemo(() => {
    const map: Record<string, { au: number; usa: number; nyc: number; la: number }> = {};
    for (const item of boughtItems) {
      const leather = item.leather || "Unknown";
      if (!map[leather]) map[leather] = { au: 0, usa: 0, nyc: 0, la: 0 };
      map[leather].au += item.auQty;
      map[leather].usa += item.usaQty;
      map[leather].nyc += item.nycQty;
      map[leather].la += item.laQty;
    }
    return Object.entries(map)
      .map(([leather, v]) => ({ leather, au: v.au, usa: v.usa, nyc: v.nyc, la: v.la, total: v.au + v.usa + v.nyc + v.la }))
      .sort((a, b) => b.total - a.total);
  }, [boughtItems]);

  // By colour+leather combo (new SKUs only)
  const byColourLeather = useMemo(() => {
    const map: Record<string, { au: number; usa: number; nyc: number; la: number }> = {};
    for (const item of boughtItems) {
      const isNew = rawSkuMap[`${item.style}|${item.colour}|${item.leather}`] ?? false;
      if (!isNew) continue;
      const combo = `${displayColour(item.colour, item.leather)} / ${displayLeather(item.leather || "", item.style) || "—"}`;
      if (!map[combo]) map[combo] = { au: 0, usa: 0, nyc: 0, la: 0 };
      map[combo].au += item.auQty;
      map[combo].usa += item.usaQty;
      map[combo].nyc += item.nycQty;
      map[combo].la += item.laQty;
    }
    return Object.entries(map)
      .map(([combo, v]) => ({ combo, au: v.au, usa: v.usa, nyc: v.nyc, la: v.la, total: v.au + v.usa + v.nyc + v.la }))
      .sort((a, b) => b.total - a.total);
  }, [boughtItems, rawSkuMap]);

  // By style with colour breakdown — for Pairs Breakdown tab
  const byStyleWithColours = useMemo(() => {
    const styleMap: Record<string, { au: number; usa: number; nyc: number; la: number; colours: Record<string, { au: number; usa: number; nyc: number; la: number }> }> = {};
    for (const item of boughtItems) {
      if (!styleMap[item.style]) styleMap[item.style] = { au: 0, usa: 0, nyc: 0, la: 0, colours: {} };
      styleMap[item.style].au += item.auQty;
      styleMap[item.style].usa += item.usaQty;
      styleMap[item.style].nyc += item.nycQty;
      styleMap[item.style].la += item.laQty;
      const colKey = displayColour(item.colour, item.leather);
      if (!styleMap[item.style].colours[colKey]) styleMap[item.style].colours[colKey] = { au: 0, usa: 0, nyc: 0, la: 0 };
      styleMap[item.style].colours[colKey].au += item.auQty;
      styleMap[item.style].colours[colKey].usa += item.usaQty;
      styleMap[item.style].colours[colKey].nyc += item.nycQty;
      styleMap[item.style].colours[colKey].la += item.laQty;
    }
    return Object.entries(styleMap)
      .map(([style, v]) => ({
        style,
        au: v.au, usa: v.usa, nyc: v.nyc, la: v.la,
        total: v.au + v.usa + v.nyc + v.la,
        category: styleInfoMap[style]?.category ?? "Unknown",
        colours: Object.entries(v.colours)
          .map(([colour, cv]) => ({ colour, au: cv.au, usa: cv.usa, nyc: cv.nyc, la: cv.la, total: cv.au + cv.usa + cv.nyc + cv.la }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [boughtItems, styleInfoMap]);

  // Top colours overall — across all styles
  const byColourOverall = useMemo(() => {
    const map: Record<string, { au: number; usa: number; nyc: number; la: number }> = {};
    for (const item of boughtItems) {
      const colKey = displayColour(item.colour, item.leather);
      if (!map[colKey]) map[colKey] = { au: 0, usa: 0, nyc: 0, la: 0 };
      map[colKey].au += item.auQty;
      map[colKey].usa += item.usaQty;
      map[colKey].nyc += item.nycQty;
      map[colKey].la += item.laQty;
    }
    return Object.entries(map)
      .map(([colour, v]) => ({ colour, au: v.au, usa: v.usa, nyc: v.nyc, la: v.la, total: v.au + v.usa + v.nyc + v.la }))
      .sort((a, b) => b.total - a.total);
  }, [boughtItems]);

  const newPairs = useMemo(() =>
    boughtItems.filter((i) => rawSkuMap[`${i.style}|${i.colour}|${i.leather}`]).reduce((s, i) => s + i.auQty + i.usaQty + i.nycQty + i.laQty, 0),
    [boughtItems, rawSkuMap]
  );

  // Unique categories and lasts for filters
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of boughtItems) cats.add(styleInfoMap[item.style]?.category ?? "Unknown");
    return ["All", ...Array.from(cats).sort()];
  }, [boughtItems, styleInfoMap]);

  const allLasts = useMemo(() => {
    const lasts = new Set<string>();
    for (const item of boughtItems) lasts.add(styleInfoMap[item.style]?.last ?? "Unknown");
    return ["All", ...Array.from(lasts).sort()];
  }, [boughtItems, styleInfoMap]);

  // Sorted + filtered SKU table rows
  const skuTableRows = useMemo(() => {
    let rows = boughtItems.map((item) => ({
      ...item,
      category: styleInfoMap[item.style]?.category ?? "Unknown",
      last: styleInfoMap[item.style]?.last ?? "Unknown",
      au: item.auQty,
      usa: item.usaQty,
      nyc: item.nycQty,
      la: item.laQty,
      total: item.auQty + item.usaQty + item.nycQty + item.laQty,
      isNew: rawSkuMap[`${item.style}|${item.colour}|${item.leather}`] ?? false,
    }));
    if (categoryFilter !== "All") rows = rows.filter((r) => r.category === categoryFilter);
    if (lastFilter !== "All") rows = rows.filter((r) => r.last === lastFilter);
    rows.sort((a, b) => {
      let va: string | number = a[sortField as keyof typeof a] as string | number;
      let vb: string | number = b[sortField as keyof typeof b] as string | number;
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return rows;
  }, [boughtItems, styleInfoMap, rawSkuMap, sortField, sortDir, categoryFilter, lastFilter]);

  // Not-bought table rows sorted by style
  const notBoughtRows = useMemo(() => {
    return notBoughtSkus.map((sku) => ({
      ...sku,
      category: styleInfoMap[sku.style]?.category ?? "Unknown",
      last: styleInfoMap[sku.style]?.last ?? "Unknown",
    })).sort((a, b) => a.style.localeCompare(b.style));
  }, [notBoughtSkus, styleInfoMap]);

  const selectedSessionNames = (allSessions as Array<{ id: number; name: string }>)
    .filter((s) => selectedSessionIds.includes(s.id))
    .map((s) => s.name);

  function toggleSession(id: number) {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3" style={{ color: "oklch(0.55 0.14 55)" }} />
      : <ArrowDown className="w-3 h-3" style={{ color: "oklch(0.55 0.14 55)" }} />;
  }

  function BarRow({ label, au, usa, nyc = 0, la = 0, max }: { label: string; au: number; usa: number; nyc?: number; la?: number; max: number }) {
    const total = au + usa + nyc + la;
    const pct = max > 0 ? (total / max) * 100 : 0;
    const auPct = total > 0 ? (au / total) * 100 : 0;
    const usaPct = total > 0 ? (usa / total) * 100 : 0;
    const nycPct = total > 0 ? (nyc / total) * 100 : 0;
    const laPct = total > 0 ? (la / total) * 100 : 0;
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-foreground w-40 truncate flex-shrink-0">{label}</span>
        <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
          <div className="h-full flex rounded-full overflow-hidden" style={{ width: `${pct}%` }}>
            <div className="h-full transition-all duration-500" style={{ width: `${auPct}%`, background: "#f59e0b" }} />
            <div className="h-full transition-all duration-500" style={{ width: `${usaPct}%`, background: "oklch(0.60 0.14 200)" }} />
            {nyc > 0 && <div className="h-full transition-all duration-500" style={{ width: `${nycPct}%`, background: "oklch(0.55 0.18 300)" }} />}
            {la > 0 && <div className="h-full transition-all duration-500" style={{ width: `${laPct}%`, background: "oklch(0.55 0.18 140)" }} />}
          </div>
        </div>
        <div className="flex gap-1 items-center text-xs tabular-nums w-44 justify-end">
          <span className="font-bold" style={{ color: "#f59e0b" }}>{au}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-bold" style={{ color: "oklch(0.60 0.14 200)" }}>{usa}</span>
          {nyc > 0 && <><span className="text-muted-foreground">/</span><span className="font-bold" style={{ color: "oklch(0.55 0.18 300)" }}>{nyc}</span></>}
          {la > 0 && <><span className="text-muted-foreground">/</span><span className="font-bold" style={{ color: "oklch(0.55 0.18 140)" }}>{la}</span></>}
          <span className="text-muted-foreground text-xs">({pct.toFixed(0)}%)</span>
        </div>
      </div>
    );
  }

  const TAB_STYLES = {
    active: { background: "oklch(0.55 0.14 55)", color: "white" },
    inactive: { background: "var(--muted)", color: "var(--muted-foreground)" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
              {(allSessions as Array<{ id: number; name: string; createdAt: Date; isLocked: boolean }>).length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">No sessions yet</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {[...(allSessions as Array<{ id: number; name: string; createdAt: Date; isLocked: boolean }>)].reverse().map((s) => {
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

      {/* View tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: "summary", label: "Summary" },
          { id: "pairs-breakdown", label: "Pairs Breakdown" },
          { id: "sku-table", label: `SKU Breakdown${boughtItems.length > 0 ? ` (${boughtItems.length})` : ""}` },
          { id: "not-bought", label: `Not Yet Bought (${notBoughtRows.length})` },
        ] as Array<{ id: ViewTab; label: string }>).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setViewTab(tab.id)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={viewTab === tab.id ? TAB_STYLES.active : TAB_STYLES.inactive}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* AU / USA / NYC legend */}
      {selectedSessionIds.length > 0 && viewTab === "summary" && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#f59e0b" }} />
            AU
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: "oklch(0.60 0.14 200)" }} />
            USA
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: "oklch(0.55 0.18 300)" }} />
            NYC
          </span>
          <span className="text-muted-foreground">Bar = AU (amber) + USA (blue) + NYC (purple)</span>
        </div>
      )}

      {/* ─── SUMMARY TAB ─── */}
      {viewTab === "summary" && (
        <>
          {selectedSessionIds.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
              <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No session selected</p>
              <p className="text-xs text-muted-foreground mt-1">Select one or more buy sessions above to view analysis.</p>
            </div>
          ) : boughtItems.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
              <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No quantities entered yet</p>
              <p className="text-xs text-muted-foreground mt-1">Enter quantities in the By Style tab to see analysis here.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Total Pairs", value: totalPairs, sub: "AU + USA + NYC + LA" },
                  { label: "AU Pairs", value: totalAU, sub: "Australia", color: "#f59e0b" },
                  { label: "USA Pairs", value: totalUSA, sub: "United States", color: "oklch(0.60 0.14 200)" },
                  { label: "NYC Pairs", value: totalNYC, sub: "New York City", color: "oklch(0.55 0.18 300)" },
                  { label: "LA Pairs", value: totalLA, sub: "Los Angeles", color: "oklch(0.55 0.18 140)" },
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
                  <p className="text-xs text-muted-foreground mb-4">Amber = AU · Blue = USA · Purple = NYC · Green = LA</p>
                  <div className="space-y-2.5">
                    {byCategory.map(({ cat, au, usa, nyc, la }) => (
                      <BarRow key={cat} label={cat} au={au} usa={usa} nyc={nyc} la={la} max={totalPairs} />
                    ))}
                  </div>
                </div>

                {/* By Style */}
                <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <h3 className="text-sm font-bold text-foreground mb-1">Pairs by Style</h3>
                  <p className="text-xs text-muted-foreground mb-4">Amber = AU · Blue = USA · Purple = NYC · Green = LA</p>
                  <div className="space-y-2.5">
                    {byStyle.map(({ style, au, usa, nyc, la }) => (
                      <BarRow key={style} label={style} au={au} usa={usa} nyc={nyc} la={la} max={totalPairs} />
                    ))}
                  </div>
                </div>

                {/* By Leather */}
                <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <h3 className="text-sm font-bold text-foreground mb-1">Pairs by Leather</h3>
                  <p className="text-xs text-muted-foreground mb-4">Amber = AU · Blue = USA · Purple = NYC · Green = LA</p>
                  <div className="space-y-2.5">
                    {byLeather.map(({ leather, au, usa, nyc, la }) => (
                      <BarRow key={leather} label={leather} au={au} usa={usa} nyc={nyc} la={la} max={totalPairs} />
                    ))}
                  </div>
                </div>

                {/* By Colour + Leather combo — new SKUs only */}
                <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-foreground">Pairs by Colour / Leather</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>
                      New SKUs only
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Only new SKUs — carry-over styles don't need a fresh leather order.</p>
                  {byColourLeather.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No new SKUs with quantities in selected sessions.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {byColourLeather.map(({ combo, au, usa, nyc, la }) => (
                        <BarRow key={combo} label={combo} au={au} usa={usa} nyc={nyc} la={la} max={newPairs} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ─── PAIRS BREAKDOWN TAB ─── */}
      {viewTab === "pairs-breakdown" && (
        <>
          {selectedSessionIds.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
              <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No session selected</p>
              <p className="text-xs text-muted-foreground mt-1">Select one or more buy sessions above to view the pairs breakdown.</p>
            </div>
          ) : boughtItems.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
              <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No quantities entered yet</p>
              <p className="text-xs text-muted-foreground mt-1">Enter quantities in the By Style tab to see the pairs breakdown.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top colours overall */}
              <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <h3 className="text-sm font-bold text-foreground mb-1">Top Colours — All Styles Combined</h3>
                <p className="text-xs text-muted-foreground mb-4">Total pairs per colour across every style · Amber = AU · Blue = USA · Purple = NYC · Green = LA</p>
                <div className="space-y-2">
                  {byColourOverall.map(({ colour, au, usa, nyc, la }) => (
                    <BarRow key={colour} label={colour} au={au} usa={usa} nyc={nyc} la={la} max={totalPairs} />
                  ))}
                </div>
              </div>

              {/* Styles ranked by pairs with expandable colour breakdown */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-bold text-foreground">Styles Ranked by Pairs — Click to See Colour Breakdown</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Sorted highest to lowest total pairs · click any row to expand colour split</p>
                </div>
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 py-2.5 border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                  <span>Style</span>
                  <span className="text-right w-20">AU</span>
                  <span className="text-right w-20">USA</span>
                  <span className="text-right w-20">NYC</span>
                  <span className="text-right w-20">LA</span>
                  <span className="text-right w-20">Total</span>
                  <span className="text-right w-16">% of buy</span>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {byStyleWithColours.map(({ style, au, usa, nyc, la, total, category, colours }) => {
                    const isExpanded = expandedStyles.has(style);
                    const pct = totalPairs > 0 ? ((total / totalPairs) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={style}>
                        {/* Style row */}
                        <button
                          className="w-full grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-0 px-5 py-3 text-left hover:bg-muted/40 transition-colors items-center"
                          onClick={() => setExpandedStyles((prev) => {
                            const next = new Set(prev);
                            if (next.has(style)) next.delete(style); else next.add(style);
                            return next;
                          })}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform"
                              style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(-90deg)" }}
                            />
                            <span className="text-sm font-semibold text-foreground">{style}</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">{category}</span>
                          </div>
                          <span className="text-sm tabular-nums text-right w-20" style={{ color: "#f59e0b" }}>{au > 0 ? au.toLocaleString() : "—"}</span>
                          <span className="text-sm tabular-nums text-right w-20" style={{ color: "oklch(0.60 0.14 200)" }}>{usa > 0 ? usa.toLocaleString() : "—"}</span>
                          <span className="text-sm tabular-nums text-right w-20" style={{ color: "oklch(0.55 0.18 300)" }}>{nyc > 0 ? nyc.toLocaleString() : "—"}</span>
                          <span className="text-sm tabular-nums text-right w-20" style={{ color: "oklch(0.55 0.18 140)" }}>{la > 0 ? la.toLocaleString() : "—"}</span>
                          <span className="text-sm tabular-nums font-bold text-right w-20 text-foreground">{total.toLocaleString()}</span>
                          <span className="text-xs tabular-nums text-right w-16 text-muted-foreground">{pct}%</span>
                        </button>
                        {/* Expanded colour rows */}
                        {isExpanded && (
                          <div className="border-t" style={{ borderColor: "var(--border)", background: "oklch(0.98 0.01 65 / 0.4)" }}>
                            {/* Colour sub-header */}
                            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-0 px-8 py-1.5 text-xs font-medium text-muted-foreground border-b" style={{ borderColor: "var(--border)" }}>
                              <span>Colour</span>
                              <span className="text-right w-20">AU</span>
                              <span className="text-right w-20">USA</span>
                              <span className="text-right w-20">NYC</span>
                              <span className="text-right w-20">LA</span>
                              <span className="text-right w-20">Total</span>
                              <span className="text-right w-16">% of style</span>
                            </div>
                            {colours.map(({ colour, au: cAu, usa: cUsa, nyc: cNyc, la: cLa, total: cTotal }) => {
                              const colPct = total > 0 ? ((cTotal / total) * 100).toFixed(1) : "0.0";
                              const barWidth = total > 0 ? (cTotal / total) * 100 : 0;
                              return (
                                <div key={colour} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-0 px-8 py-2.5 items-center border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm text-foreground font-medium">{colour}</span>
                                    <div className="flex-1 h-1.5 rounded-full overflow-hidden max-w-24" style={{ background: "var(--muted)" }}>
                                      <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: "oklch(0.55 0.14 55)" }} />
                                    </div>
                                  </div>
                                  <span className="text-sm tabular-nums text-right w-20" style={{ color: "#f59e0b" }}>{cAu > 0 ? cAu.toLocaleString() : "—"}</span>
                                  <span className="text-sm tabular-nums text-right w-20" style={{ color: "oklch(0.60 0.14 200)" }}>{cUsa > 0 ? cUsa.toLocaleString() : "—"}</span>
                                  <span className="text-sm tabular-nums text-right w-20" style={{ color: "oklch(0.55 0.18 300)" }}>{cNyc > 0 ? cNyc.toLocaleString() : "—"}</span>
                                  <span className="text-sm tabular-nums text-right w-20" style={{ color: "oklch(0.55 0.18 140)" }}>{cLa > 0 ? cLa.toLocaleString() : "—"}</span>
                                  <span className="text-sm tabular-nums font-semibold text-right w-20 text-foreground">{cTotal.toLocaleString()}</span>
                                  <span className="text-xs tabular-nums text-right w-16 text-muted-foreground">{colPct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── SKU TABLE TAB ─── */}
      {viewTab === "sku-table" && (
        <>
          {selectedSessionIds.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
              <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No session selected</p>
              <p className="text-xs text-muted-foreground mt-1">Select one or more buy sessions above to view the SKU breakdown.</p>
            </div>
          ) : boughtItems.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
              <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No quantities entered yet</p>
              <p className="text-xs text-muted-foreground mt-1">Enter quantities in the By Style tab to see the SKU breakdown.</p>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Category:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs rounded-lg border px-2 py-1.5"
                    style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                  >
                    {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Last:</span>
                  <select
                    value={lastFilter}
                    onChange={(e) => setLastFilter(e.target.value)}
                    className="text-xs rounded-lg border px-2 py-1.5"
                    style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                  >
                    {allLasts.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <span className="text-xs text-muted-foreground ml-auto">{skuTableRows.length} SKUs</span>
              </div>

              {/* Table */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "var(--muted)" }}>
                        {([
                          { field: "style", label: "Style" },
                          { field: "colour", label: "Colour" },
                          { field: "leather", label: "Leather" },
                          { field: "category", label: "Category" },
                          { field: "last", label: "Last" },
                          { field: "au", label: "AU" },
                          { field: "usa", label: "USA" },
                          { field: "nyc", label: "NYC" },
                          { field: "la", label: "LA" },
                          { field: "total", label: "Total" },
                        ] as Array<{ field: SortField; label: string }>).map(({ field, label }) => (
                          <th
                            key={field}
                            className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer hover:text-foreground select-none"
                            onClick={() => handleSort(field)}
                          >
                            <span className="flex items-center gap-1">
                              {label}
                              <SortIcon field={field} />
                            </span>
                          </th>
                        ))}
                        {selectedSessionIds.length > 1 && (
                          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sessions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {skuTableRows.map((row, idx) => (
                        <tr
                          key={`${row.style}|${row.colour}|${row.leather}`}
                          style={{ background: idx % 2 === 0 ? "var(--card)" : "var(--muted)/30" }}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-3 py-2 font-medium text-foreground">
                            {row.style}
                            {row.isNew && (
                              <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded font-bold" style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>NEW</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-foreground">{displayColour(row.colour, row.leather)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{displayLeather(row.leather || "", row.style) || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.category}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.last}</td>
                          <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "#f59e0b" }}>{row.auQty}</td>
                          <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "oklch(0.60 0.14 200)" }}>{row.usaQty}</td>
                          <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "oklch(0.55 0.18 300)" }}>{row.nycQty}</td>
                          <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "oklch(0.55 0.18 140)" }}>{row.laQty}</td>
                          <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "oklch(0.50 0.14 55)" }}>{row.total}</td>
                          {selectedSessionIds.length > 1 && (
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {row.sessionBreakdown.map((s) => (
                                  <span key={s.sessionId} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                                    {s.sessionName}: {s.au}AU/{s.usa}USA{s.nyc ? `/${s.nyc}NYC` : ""}{s.la ? `/${s.la}LA` : ""}
                                  </span>
                                ))}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--muted)", borderTop: "2px solid var(--border)" }}>
                        <td colSpan={5} className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">Total</td>
                        <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "#f59e0b" }}>
                          {skuTableRows.reduce((s, r) => s + r.auQty, 0)}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "oklch(0.60 0.14 200)" }}>
                          {skuTableRows.reduce((s, r) => s + r.usaQty, 0)}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "oklch(0.55 0.18 300)" }}>
                          {skuTableRows.reduce((s, r) => s + r.nycQty, 0)}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "oklch(0.55 0.18 140)" }}>
                          {skuTableRows.reduce((s, r) => s + r.laQty, 0)}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-right" style={{ color: "oklch(0.50 0.14 55)" }}>
                          {skuTableRows.reduce((s, r) => s + r.total, 0)}
                        </td>
                        {selectedSessionIds.length > 1 && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ─── NOT YET BOUGHT TAB ─── */}
      {viewTab === "not-bought" && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl border px-4 py-3 flex items-center gap-3" style={{ borderColor: "oklch(0.85 0.08 30)", background: "oklch(0.97 0.04 30)" }}>
              <span className="text-2xl font-bold tabular-nums" style={{ color: "oklch(0.50 0.14 30)" }}>{notBoughtRows.length}</span>
              <div>
              <p className="text-sm font-medium text-foreground">New SKUs not yet bought</p>
              <p className="text-xs text-muted-foreground">Zero units across all sessions</p>
              </div>
            </div>
            <div className="rounded-xl border px-4 py-3 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <span className="text-2xl font-bold tabular-nums" style={{ color: "oklch(0.50 0.14 55)" }}>{allRangeSkus.filter(s => s.is_new).length - notBoughtRows.length}</span>
              <div>
              <p className="text-sm font-medium text-foreground">New SKUs with at least 1 unit</p>
              <p className="text-xs text-muted-foreground">Bought in any session</p>
              </div>
            </div>
          </div>

          {notBoughtRows.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
              <Check className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">All new SKUs have been bought!</p>
              <p className="text-xs text-muted-foreground mt-1">Every new SKU in the range has at least 1 unit across all sessions.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--muted)" }}>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Colour</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leather</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">New?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notBoughtRows.map((row, idx) => (
                      <tr
                        key={`${row.style}|${row.colour}|${row.leather}`}
                        style={{ background: idx % 2 === 0 ? "var(--card)" : undefined }}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">{row.style}</td>
                        <td className="px-3 py-2 text-foreground">{displayColour(row.colour, row.leather)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{displayLeather(row.leather || "", row.style) || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.category}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.last}</td>
                        <td className="px-3 py-2">
                          {row.is_new ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>NEW</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Existing</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
