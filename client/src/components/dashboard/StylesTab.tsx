/**
 * StylesTab — filterable table of all styles
 * - Grouped by last name (alphabetical), then by style within each last
 * - Click a style row to expand its SKUs with inline buy qty editing
 * - Size 11 toggle is style-level: toggling one SKU toggles all in the style
 * - Click a SKU's detail icon to open the SkuDetailPanel slide-out
 */

import React, { useState, useMemo, useCallback, useRef } from "react";
import { skuData } from "@/lib/skuData";
import { trpc } from "@/lib/trpc";
import { Search, ChevronUp, ChevronDown, ChevronRight, Download, Upload, SlidersHorizontal, CheckCircle, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx";
import SkuDetailPanel, { type SkuPanelData } from "./SkuDetailPanel";
import ImportPanel from "./ImportPanel";
import BuySessionBar from "./BuySessionBar";
import { toast } from "sonner";

type SortKey = "style" | "category" | "last" | "totalSKUs" | "newSKUs" | "existingSKUs";
type SortDir = "asc" | "desc";

const CATEGORIES = ["All", "Dress Shoe", "Dress Sandal", "Ballet Flat", "Loafer", "Wedge", "Sandal", "Ankle Boot", "Calf Boot"];
const STATUS_FILTERS = ["All", "Has New SKUs", "All New", "No New SKUs"];

export default function StylesTab() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("style");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedSku, setSelectedSku] = useState<SkuPanelData | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [expandedStyle, setExpandedStyle] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [fitApprovedSectionOpen, setFitApprovedSectionOpen] = useState(false);
  const [expandedApprovedStyle, setExpandedApprovedStyle] = useState<string | null>(null);

  // Pending qty changes (local before saving)
  const pendingQty = useRef<Record<string, number>>({});

  const utils = trpc.useUtils();

  // Fetch all SKU meta from DB
  const { data: skuMetaList = [], refetch: refetchSkuMeta } = trpc.sku.getAll.useQuery();
  const { data: styleMetaList = [], refetch: refetchStyleMeta } = trpc.style.getAll.useQuery();

  // Fitting images for approved styles
  const { data: allFitImages = [], refetch: refetchFitImages } = trpc.styleFitting.getAll.useQuery();

  // Undo approval mutation
  const undoApprovalMutation = trpc.styleFitting.updateFit.useMutation({
    onSuccess: () => { refetchStyleMeta(); refetchFitImages(); },
    onError: (err) => toast.error(`Failed to undo approval: ${err.message}`),
  });

  // Buy sessions
  const { data: allSessions = [], refetch: refetchSessions } = trpc.buy.getSessions.useQuery();
  const { data: activeSession, refetch: refetchActive } = trpc.buy.getActive.useQuery();
  const { data: sessionItems = [], refetch: refetchItems } = trpc.buy.getItems.useQuery(
    { sessionId: selectedSessionId ?? 0 },
    { enabled: selectedSessionId !== null }
  );

  // Auto-select active session on load
  useMemo(() => {
    if (activeSession && selectedSessionId === null) {
      setSelectedSessionId(activeSession.id);
    }
  }, [activeSession]);

  const upsertItemMutation = trpc.buy.upsertItem.useMutation({
    onError: (err) => toast.error(`Failed to save qty: ${err.message}`),
  });

  // Style-level Size 11 mutation — updates ALL SKUs in the style
  const updateStyleSize11Mutation = trpc.sku.updateStyleSize11.useMutation({
    onSuccess: () => refetchSkuMeta(),
    onError: (err) => toast.error(`Failed to update Size 11: ${err.message}`),
  });

  // Build lookup maps
  type SkuMetaItem = { style: string; colour: string; leather: string; sampleStatus?: string | null; orderQty?: number | null; isSize11?: boolean | null; costPrice?: number | null; fitRating?: string | null; fittingNotes?: string | null; };
  type StyleMetaItem = { style: string; rrp?: number | null; fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null; };

  const skuMetaMap = useMemo(() => {
    const map: Record<string, SkuMetaItem> = {};
    for (const m of skuMetaList as SkuMetaItem[]) {
      map[`${m.style}|${m.colour}|${m.leather}`] = m;
    }
    return map;
  }, [skuMetaList]);

  const styleMetaMap = useMemo(() => {
    const map: Record<string, StyleMetaItem> = {};
    for (const m of styleMetaList as StyleMetaItem[]) {
      map[m.style] = m;
    }
    return map;
  }, [styleMetaList]);

  // Buy session item lookup
  const sessionItemMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of sessionItems) {
      const key = `${item.style}|${item.colour}|${item.leather}` as string;
      map[key] = item.qty;
    }
    return map;
  }, [sessionItems]);

  const selectedSession = useMemo(() => allSessions.find((s) => s.id === selectedSessionId), [allSessions, selectedSessionId]);
  const isSessionLocked = selectedSession?.isLocked ?? true;

  // Fit images grouped by style
  const fitImagesMap = useMemo(() => {
    const map: Record<string, Array<{ id: number; imageUrl: string; fileKey: string }>> = {};
    for (const img of allFitImages as Array<{ id: number; style: string; imageUrl: string; fileKey: string }>) {
      if (!map[img.style]) map[img.style] = [];
      map[img.style].push({ id: img.id, imageUrl: img.imageUrl, fileKey: img.fileKey });
    }
    return map;
  }, [allFitImages]);

  // Approved styles list (from skuData, filtered by fitApproved in styleMeta)
  const approvedFitStyles = useMemo(() => {
    return skuData.styles.filter((s) => styleMetaMap[s.style]?.fitApproved === true);
  }, [styleMetaMap]);

  function handleMetaChange() {
    refetchSkuMeta();
  }

  function handleSessionChange() {
    refetchSessions();
    refetchActive();
  }

  function handleQtyChange(style: string, colour: string, leather: string, val: string) {
    const key = `${style}|${colour}|${leather}`;
    const qty = parseInt(val, 10);
    if (!isNaN(qty) && qty >= 0) {
      pendingQty.current[key] = qty;
    }
  }

  function handleQtyBlur(style: string, colour: string, leather: string) {
    if (!selectedSessionId || isSessionLocked) return;
    const key = `${style}|${colour}|${leather}`;
    const qty = pendingQty.current[key];
    if (qty === undefined) return;
    upsertItemMutation.mutate(
      { sessionId: selectedSessionId, style, colour, leather, qty },
      { onSuccess: () => { refetchItems(); delete pendingQty.current[key]; } }
    );
  }

  // Toggle Size 11 for the entire style
  function handleStyleSize11Toggle(styleName: string) {
    const skus = getSkusForStyle(styleName);
    // Check if ANY sku in the style currently has size11 = true
    const anySize11 = skus.some((sku) => {
      const key = `${sku.style}|${sku.colour}|${sku.leather}`;
      return skuMetaMap[key]?.isSize11 === true;
    });
    // Toggle: if any are on, turn all off; if none are on, turn all on
    const newValue = !anySize11;
    updateStyleSize11Mutation.mutate({
      style: styleName,
      skus: skus.map((s) => ({ colour: s.colour, leather: s.leather })),
      isSize11: newValue,
    });
  }

  function exportToExcel() {
    const styleMetaLookup: Record<string, { category: string; last: string }> = {};
    skuData.styles.forEach((s) => {
      styleMetaLookup[s.style] = { category: s.category, last: s.last };
    });
    const rows = skuData.rawSkus
      .filter((sku) => {
        const meta = styleMetaLookup[sku.style];
        return categoryFilter === "All" || meta?.category === categoryFilter;
      })
      .map((sku) => {
        const skuKey = `${sku.style}|${sku.colour}|${sku.leather}` as string;
        const dbMeta = skuMetaMap[skuKey];
        return {
          Category: styleMetaLookup[sku.style]?.category ?? "",
          Style: sku.style,
          Last: styleMetaLookup[sku.style]?.last ?? "",
          Colour: sku.colour,
          Leather: sku.leather,
          Status: sku.is_new ? "New" : "Existing",
          "Size 11": dbMeta?.isSize11 ? "Yes" : "No",
          "Sample Status": dbMeta?.sampleStatus ?? "waiting",
          "Order Qty": dbMeta?.orderQty ?? 0,
          "Cost Price": dbMeta?.costPrice != null ? dbMeta.costPrice : "",
          RRP: styleMetaMap[sku.style]?.rrp != null ? styleMetaMap[sku.style].rrp : "",
          "Fit Rating": dbMeta?.fitRating ?? "",
          "Fitting Notes": dbMeta?.fittingNotes ?? "",
        };
      });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SKU Data");
    XLSX.writeFile(wb, "SS26_SKU_Export.xlsx");
  }

  // Filter styles
  const filtered = useMemo(() => {
    let data = [...skuData.styles];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (s) =>
          s.style.toLowerCase().includes(q) ||
          s.last.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.leathers.some((l) => l.toLowerCase().includes(q)) ||
          s.colours.some((c) => c.toLowerCase().includes(q))
      );
    }

    if (categoryFilter !== "All") {
      data = data.filter((s) => s.category === categoryFilter);
    }

    if (statusFilter === "Has New SKUs") {
      data = data.filter((s) => s.hasNew);
    } else if (statusFilter === "All New") {
      data = data.filter((s) => s.isAllNew);
    } else if (statusFilter === "No New SKUs") {
      data = data.filter((s) => !s.hasNew);
    }

    return data;
  }, [search, categoryFilter, statusFilter]);

  // Group by last, sorted alphabetically by last, then by style within each last
  const groupedByLast = useMemo(() => {
    // Sort within each group by style name
    const groups: Record<string, typeof filtered> = {};
    for (const s of filtered) {
      const last = s.last || "UNKNOWN";
      if (!groups[last]) groups[last] = [];
      groups[last].push(s);
    }
    // Sort styles within each group
    for (const last of Object.keys(groups)) {
      groups[last].sort((a, b) => a.style.localeCompare(b.style));
    }
    // Sort last names alphabetically
    const sortedLasts = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return sortedLasts.map((last) => ({ last, styles: groups[last] }));
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 opacity-70" /> : <ChevronDown className="w-3 h-3 opacity-70" />;
  }

  function getSkusForStyle(styleName: string) {
    return skuData.rawSkus.filter((s) => s.style === styleName);
  }

  // Session buy total for a style
  function getStyleSessionTotal(styleName: string) {
    return getSkusForStyle(styleName).reduce((sum, sku) => {
      const key = `${sku.style}|${sku.colour}|${sku.leather}` as string;
      return sum + (sessionItemMap[key] ?? 0);
    }, 0);
  }

  // Check if style has Size 11 enabled (any SKU in the style)
  function getStyleSize11(styleName: string) {
    return getSkusForStyle(styleName).some((sku) => {
      const key = `${sku.style}|${sku.colour}|${sku.leather}`;
      return skuMetaMap[key]?.isSize11 === true;
    });
  }

  const totalFilteredStyles = filtered.length;

  return (
    <div className="space-y-4">
      {/* Buy Session Bar */}
      <BuySessionBar
        activeSession={activeSession ?? null}
        allSessions={allSessions as any}
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
        onSessionChange={handleSessionChange}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search styles, leathers, colours…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border bg-card text-foreground focus:outline-none"
          style={{ borderColor: "var(--border)" }}
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border bg-card text-foreground focus:outline-none"
          style={{ borderColor: "var(--border)" }}
        >
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <span className="text-sm text-muted-foreground">{totalFilteredStyles} of {skuData.styles.length} styles</span>

        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Upload className="w-4 h-4" />
          Import
        </button>

        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Table grouped by last */}
      <div className="space-y-4">
        {groupedByLast.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-12 text-center text-muted-foreground text-sm" style={{ borderColor: "var(--border)" }}>
            No styles match your filters.
          </div>
        ) : (
          groupedByLast.map(({ last, styles: lastStyles }) => (
            <div key={last} className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {/* Last group header */}
              <div
                className="px-4 py-2 flex items-center gap-3 border-b"
                style={{
                  borderColor: "var(--border)",
                  background: "oklch(0.96 0.03 65 / 0.5)",
                }}
              >
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "oklch(0.50 0.14 55)" }}>
                  {last}
                </span>
                <span className="text-xs text-muted-foreground">
                  {lastStyles.length} {lastStyles.length === 1 ? "style" : "styles"}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                      {[
                        { key: "style" as SortKey, label: "Style" },
                        { key: "category" as SortKey, label: "Category" },
                        { key: "totalSKUs" as SortKey, label: "Total SKUs" },
                        { key: "newSKUs" as SortKey, label: "New" },
                        { key: "existingSKUs" as SortKey, label: "Existing" },
                      ].map(({ key, label }) => (
                        <th
                          key={key}
                          className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors"
                          onClick={() => toggleSort(key)}
                        >
                          <div className={`flex items-center gap-1 ${key !== "style" && key !== "category" ? "justify-end" : ""}`}>
                            {label}
                            <SortIcon col={key} />
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide text-left">Leathers</th>
                      <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide text-center">Sz11</th>
                      <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide text-right">Buy Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastStyles.map((style) => {
                      const sessionTotal = getStyleSessionTotal(style.style);
                      const styleSize11 = getStyleSize11(style.style);
                      return (
                        <React.Fragment key={style.style}>
                          <tr
                            className="border-b transition-colors hover:bg-muted/30 cursor-pointer"
                            style={{
                              borderColor: "var(--border)",
                              background: expandedStyle === style.style
                                ? "oklch(0.97 0.04 65 / 0.6)"
                                : style.isAllNew ? "oklch(0.99 0.04 65 / 0.4)" : undefined,
                            }}
                            onClick={() => setExpandedStyle(expandedStyle === style.style ? null : style.style)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-10 rounded flex-shrink-0 overflow-hidden" style={{ background: "var(--muted)" }}>
                                  {style.imageUrl ? (
                                    <img src={style.imageUrl} alt={style.style} className="w-full h-full object-contain" loading="lazy" />
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  {style.hasNew && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#f59e0b" }} />}
                                  <span className="font-semibold text-foreground">{style.style}</span>
                                  {style.isAllNew && (
                                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>NEW</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                                {style.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">{style.totalSKUs}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {style.newSKUs > 0 ? (
                                <span className="font-semibold" style={{ color: "oklch(0.55 0.14 55)" }}>{style.newSKUs}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{style.existingSKUs}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-48">
                                {style.leathers.slice(0, 4).map((l) => (
                                  <span key={l} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{l}</span>
                                ))}
                                {style.leathers.length > 4 && <span className="text-xs text-muted-foreground">+{style.leathers.length - 4}</span>}
                              </div>
                            </td>
                            {/* Style-level Size 11 toggle */}
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStyleSize11Toggle(style.style);
                                }}
                                title={styleSize11 ? "Size 11 enabled — click to disable for all SKUs" : "Enable Size 11 for all SKUs in this style"}
                                className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                                style={{
                                  background: styleSize11 ? "oklch(0.94 0.06 240)" : "var(--muted)",
                                  color: styleSize11 ? "oklch(0.45 0.14 240)" : "var(--muted-foreground)",
                                  border: styleSize11 ? "1px solid oklch(0.80 0.10 240)" : "1px solid var(--border)",
                                }}
                              >
                                <span className="text-xs font-bold">11</span>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {sessionTotal > 0 ? (
                                <span className="text-sm font-bold tabular-nums" style={{ color: "oklch(0.50 0.14 55)" }}>{sessionTotal}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded SKU rows with inline buy qty */}
                          {expandedStyle === style.style && (
                            <tr key={`${style.style}-expanded`} className="border-b" style={{ borderColor: "var(--border)" }}>
                              <td colSpan={8} className="px-6 py-3" style={{ background: "oklch(0.98 0.02 65 / 0.5)" }}>
                                {/* Fit info — shown when style has been fit-approved */}
                                {(() => {
                                  const sm = styleMetaMap[style.style];
                                  if (!sm?.fitApproved) return null;
                                  const fitLabel = sm.fitRating === "tts" ? "True to Size" : sm.fitRating === "runs_small" ? "Runs Small" : sm.fitRating === "runs_large" ? "Runs Large" : null;
                                  const fitColourClass = sm.fitRating === "tts" ? "bg-green-100 text-green-800 border-green-200" : sm.fitRating === "runs_small" ? "bg-amber-100 text-amber-800 border-amber-200" : sm.fitRating === "runs_large" ? "bg-blue-100 text-blue-800 border-blue-200" : "";
                                  return (
                                    <div className="mb-3 flex items-start gap-3 p-3 rounded-lg border" style={{ background: "oklch(0.97 0.03 155 / 0.3)", borderColor: "oklch(0.85 0.06 155)" }}>
                                      <span className="text-xs font-semibold text-green-700 flex items-center gap-1 shrink-0">✓ Fit Approved</span>
                                      {fitLabel && (
                                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${fitColourClass}`}>{fitLabel}</span>
                                      )}
                                      {sm.fittingNotes && (
                                        <span className="text-xs italic text-muted-foreground">{sm.fittingNotes}</span>
                                      )}
                                    </div>
                                  );
                                })()}
                                {/* Session context */}
                                {selectedSession && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                      {isSessionLocked ? "📋 Viewing:" : "✏️ Entering qtys for:"}
                                    </span>
                                    <span className="text-xs font-semibold" style={{ color: "oklch(0.50 0.14 55)" }}>
                                      {selectedSession.name}
                                    </span>
                                    {isSessionLocked && (
                                      <span className="text-xs text-muted-foreground">(locked — read only)</span>
                                    )}
                                  </div>
                                )}
                                {!selectedSession && (
                                  <p className="text-xs text-muted-foreground mb-2">Create a buy session above to enter quantities.</p>
                                )}

                                {/* Column headers */}
                                <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "minmax(120px,2fr) minmax(100px,1.5fr) 80px 48px 56px 100px" }}>
                                  {["Colour", "Leather", "Status", "Sz11", "Sample", "Buy Qty"].map((h) => (
                                    <span key={h} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2">{h}</span>
                                  ))}
                                </div>

                                <div className="space-y-1">
                                  {getSkusForStyle(style.style).map((sku) => {
                                    const skuKey2 = `${sku.style}|${sku.colour}|${sku.leather}` as string;
                                    const dbMeta = skuMetaMap[skuKey2];
                                    const sessionQty = sessionItemMap[skuKey2] ?? 0;
                                    // Size 11 is style-level — show the style-level value
                                    const isSize11 = styleSize11;

                                    return (
                                      <div
                                        key={`${sku.colour}-${sku.leather}`}
                                        className="grid items-center gap-1 px-2 py-1.5 rounded-lg"
                                        style={{
                                          gridTemplateColumns: "minmax(120px,2fr) minmax(100px,1.5fr) 80px 48px 56px 100px",
                                          border: "1px solid var(--border)",
                                          background: sessionQty > 0 ? "oklch(0.97 0.06 65 / 0.5)" : "var(--card)",
                                        }}
                                      >
                                        {/* Colour */}
                                        <div className="flex items-center gap-1.5">
                                          {sku.is_new && (
                                            <span className="text-xs px-1 py-0.5 rounded font-medium flex-shrink-0" style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>N</span>
                                          )}
                                          <span className="text-sm font-medium text-foreground truncate">{sku.colour}</span>
                                        </div>

                                        {/* Leather */}
                                        <span className="text-xs text-muted-foreground truncate">{sku.leather || "—"}</span>

                                        {/* Status */}
                                        <span className="text-xs text-muted-foreground">{sku.is_new ? "New" : "Existing"}</span>

                                        {/* Size 11 — style-level indicator (read-only here, toggle via style row) */}
                                        <span className="text-xs text-center">
                                          {isSize11 ? (
                                            <span className="px-1 py-0.5 rounded text-xs font-medium" style={{ background: "oklch(0.94 0.06 240)", color: "oklch(0.45 0.14 240)" }}>✓</span>
                                          ) : <span className="text-muted-foreground">—</span>}
                                        </span>

                                        {/* Sample */}
                                        <span className="text-xs text-center">
                                          {dbMeta?.sampleStatus === "received" ? (
                                            <span className="px-1 py-0.5 rounded text-xs font-medium" style={{ background: "oklch(0.94 0.08 155)", color: "oklch(0.40 0.14 155)" }}>✓</span>
                                          ) : <span className="text-muted-foreground">—</span>}
                                        </span>

                                        {/* Buy Qty — editable input for NEW SKUs only; existing SKUs show a dash */}
                                        <div className="flex items-center gap-1">
                                          {sku.is_new ? (
                                            !isSessionLocked && selectedSession ? (
                                              <input
                                                type="number"
                                                min={0}
                                                defaultValue={sessionQty || ""}
                                                key={`qty-${selectedSessionId}-${skuKey2}`}
                                                onChange={(e) => handleQtyChange(sku.style, sku.colour, sku.leather, e.target.value)}
                                                onBlur={() => handleQtyBlur(sku.style, sku.colour, sku.leather)}
                                                onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                                                placeholder="0"
                                                className="w-16 px-2 py-1 rounded border text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40 text-right"
                                                style={{ borderColor: sessionQty > 0 ? "oklch(0.72 0.16 65)" : "var(--border)" }}
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                            ) : (
                                              <span
                                                className="w-16 text-right text-sm font-mono font-semibold"
                                                style={{ color: sessionQty > 0 ? "oklch(0.50 0.14 55)" : "var(--muted-foreground)" }}
                                              >
                                                {sessionQty > 0 ? sessionQty : "—"}
                                              </span>
                                            )
                                          ) : (
                                            <span className="w-16 text-right text-xs text-muted-foreground" title="Existing SKUs are not bought in new season buys">—</span>
                                          )}
                                          {/* Detail button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedSku({
                                                style: sku.style,
                                                colour: sku.colour,
                                                leather: sku.leather,
                                                isNew: sku.is_new,
                                                category: style.category,
                                                last: style.last,
                                                imageUrl: style.imageUrl,
                                              });
                                            }}
                                            className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
                                            title="View SKU details"
                                          >
                                            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fit Approved section — collapsed, at the bottom of By Style */}
      {approvedFitStyles.length > 0 && (
        <div className="mt-4 border rounded-xl overflow-hidden" style={{ borderColor: "oklch(0.85 0.06 155)" }}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{ background: fitApprovedSectionOpen ? "oklch(0.97 0.03 155 / 0.4)" : "oklch(0.97 0.03 155 / 0.25)" }}
            onClick={() => setFitApprovedSectionOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold" style={{ color: "oklch(0.38 0.10 155)" }}>
                Fit Approved ({approvedFitStyles.length} {approvedFitStyles.length === 1 ? "style" : "styles"})
              </span>
              <span className="text-xs" style={{ color: "oklch(0.55 0.08 155)" }}>— fit confirmed, notes saved</span>
            </div>
            {fitApprovedSectionOpen
              ? <ChevronDown className="w-4 h-4" style={{ color: "oklch(0.55 0.08 155)" }} />
              : <ChevronRight className="w-4 h-4" style={{ color: "oklch(0.55 0.08 155)" }} />}
          </button>

          {fitApprovedSectionOpen && (
            <div className="divide-y" style={{ borderColor: "oklch(0.92 0.04 155)" }}>
              {approvedFitStyles.map((style) => {
                const sm = styleMetaMap[style.style];
                const images = fitImagesMap[style.style] ?? [];
                const isExpanded = expandedApprovedStyle === style.style;
                const fitLabel = sm?.fitRating === "tts" ? "True to Size" : sm?.fitRating === "runs_small" ? "Runs Small" : sm?.fitRating === "runs_large" ? "Runs Large" : null;
                const fitBadgeClass = sm?.fitRating === "tts" ? "bg-green-100 text-green-800 border-green-200" : sm?.fitRating === "runs_small" ? "bg-amber-100 text-amber-800 border-amber-200" : sm?.fitRating === "runs_large" ? "bg-blue-100 text-blue-800 border-blue-200" : "";
                return (
                  <div key={style.style}>
                    {/* Style row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedApprovedStyle(isExpanded ? null : style.style)}
                    >
                      {style.imageUrl && (
                        <img src={style.imageUrl} alt={style.style} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{style.style}</span>
                          <span className="text-xs text-muted-foreground">{style.last}</span>
                          {fitLabel && (
                            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${fitBadgeClass}`}>{fitLabel}</span>
                          )}
                        </div>
                        {sm?.fittingNotes && !isExpanded && (
                          <p className="text-xs italic text-muted-foreground mt-0.5 truncate">{sm.fittingNotes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            undoApprovalMutation.mutate({ style: style.style, fitApproved: false });
                            toast.success(`${style.style} moved back to Fitting tab`);
                          }}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors text-muted-foreground"
                          title="Undo approval — move back to Fitting tab"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Undo
                        </button>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded fit details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 space-y-3" style={{ background: "oklch(0.98 0.01 155 / 0.4)" }}>
                        {sm?.fittingNotes && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Fitting Notes</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{sm.fittingNotes}</p>
                          </div>
                        )}
                        {images.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fitting Images</p>
                            <div className="flex flex-wrap gap-2">
                              {images.map((img) => (
                                <img
                                  key={img.id}
                                  src={img.imageUrl}
                                  alt="Fitting"
                                  className="w-24 h-24 rounded-lg object-cover border border-border"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {!sm?.fittingNotes && images.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No notes or images saved.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SKU Detail Panel */}
      {selectedSku && (
        <SkuDetailPanel
          sku={selectedSku}
          onClose={() => setSelectedSku(null)}
          skuMeta={skuMetaMap as any}
          styleMeta={styleMetaMap as any}
          onMetaChange={handleMetaChange}
          allStyleSkus={getSkusForStyle(selectedSku.style).map((s) => ({ colour: s.colour, leather: s.leather }))}
        />
      )}

      {/* Import Panel */}
      {showImport && (
        <ImportPanel
          onClose={() => setShowImport(false)}
          onImportDone={() => { refetchSkuMeta(); refetchStyleMeta(); }}
        />
      )}
    </div>
  );
}
