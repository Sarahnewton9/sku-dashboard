/**
 * StylesTab — filterable table of all styles
 * - Grouped by last name (alphabetical), then by style within each last
 * - Click a style row to expand its SKUs with inline buy qty editing
 * - Size 11 toggle is style-level: toggling one SKU toggles all in the style
 * - Click a SKU's detail icon to open the SkuDetailPanel slide-out
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { skuData } from "@/lib/skuData";
import { trpc } from "@/lib/trpc";
import { useCancelledStyles } from "@/hooks/useCancelledStyles";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { useStyleCategories } from "@/hooks/useStyleCategories";
import { Search, ChevronUp, ChevronDown, ChevronRight, Download, Upload, SlidersHorizontal, CheckCircle, RotateCcw, Ban, RefreshCw, Plus, Lock, Unlock } from "lucide-react";
import * as XLSX from "xlsx";
import SkuDetailPanel, { type SkuPanelData } from "./SkuDetailPanel";
import ImportPanel from "./ImportPanel";
import BuySessionBar from "./BuySessionBar";
import { toast } from "sonner";

type SortKey = "style" | "category" | "last" | "totalSKUs" | "newSKUs" | "existingSKUs";
type SortDir = "asc" | "desc";

const CATEGORIES = [
  "All",
  "Dress Shoe",
  "Dress Sandal",
  "Casual Flat",
  "Casual Wedge",
  "Dress Wedge",
  "Sandal",
  "Dress Ankle Boot",
  "Dress Calf Boot",
  "Casual Ankle Boot",
  "Casual Calf Boot",
];
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

  // Cancelled styles
  const { cancelledSet, raw: cancelledList } = useCancelledStyles();
  const [cancelledSectionOpen, setCancelledSectionOpen] = useState(false);

  const cancelStyleMutation = trpc.styles.cancel.useMutation({
    onSuccess: () => { utils.styles.listCancelled.invalidate(); },
    onError: (err) => toast.error(`Failed to cancel style: ${err.message}`),
  });

  const restoreStyleMutation = trpc.styles.restore.useMutation({
    onSuccess: () => { utils.styles.listCancelled.invalidate(); },
    onError: (err) => toast.error(`Failed to restore style: ${err.message}`),
  });

  // Cancelled SKUs
  const { data: cancelledSkuList = [], refetch: refetchCancelledSkus } = trpc.cancelledSku.list.useQuery();
  const [cancelledSkuSectionOpen, setCancelledSkuSectionOpen] = useState(false);

  const cancelledSkuSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of cancelledSkuList as Array<{ style: string; colour: string; leather: string }>) {
      s.add(`${item.style}|${item.colour}|${item.leather}`);
    }
    return s;
  }, [cancelledSkuList]);

  const cancelSkuMutation = trpc.cancelledSku.cancel.useMutation({
    onSuccess: () => { refetchCancelledSkus(); },
    onError: (err) => toast.error(`Failed to cancel SKU: ${err.message}`),
  });

  const restoreSkuMutation = trpc.cancelledSku.restore.useMutation({
    onSuccess: () => { refetchCancelledSkus(); },
    onError: (err) => toast.error(`Failed to restore SKU: ${err.message}`),
  });

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

  // Custom SKUs (added during buy)
  const { mergedRawSkus, mergedStyles, customSkus, refetch: refetchCustomSkus } = useCustomSkus();

  // Category overrides (sub-categories + trend flags from DB)
  const { getCategory, getTrendFlag } = useStyleCategories();

  // Add colour inline form state: key = style name, value = { colour, leather } draft
  const [addColourDraft, setAddColourDraft] = useState<Record<string, { colour: string; leather: string }>>({});

  const addCustomSkuMutation = trpc.customSku.add.useMutation({
    onSuccess: (_data, vars) => {
      refetchCustomSkus();
      // Also add to active buy session if one is selected and unlocked
      if (selectedSessionId && !isSessionLocked) {
        upsertItemMutation.mutate({ sessionId: selectedSessionId, style: vars.style, colour: vars.colour, leather: vars.leather, auQty: 0, usaQty: 0 });
      }
      setAddColourDraft((prev) => { const n = { ...prev }; delete n[vars.style]; return n; });
      toast.success(`${vars.colour} ${vars.leather} added to ${vars.style}`);
    },
    onError: (err) => toast.error(`Failed to add colour: ${err.message}`),
  });

  const unlockSessionMutation = trpc.buy.unlock.useMutation({
    onSuccess: () => { refetchSessions(); refetchActive(); toast.success("Session unlocked"); },
    onError: (err) => toast.error(`Failed to unlock: ${err.message}`),
  });

  // Buy sessions
  const { data: allSessions = [], refetch: refetchSessions } = trpc.buy.getSessions.useQuery();
  const { data: activeSession, refetch: refetchActive } = trpc.buy.getActive.useQuery();
  const { data: sessionItems = [], refetch: refetchItems } = trpc.buy.getItems.useQuery(
    { sessionId: selectedSessionId ?? 0 },
    { enabled: selectedSessionId !== null }
  );

  // When no session is selected, fall back to the most recent session's items for read-only display
  const mostRecentSessionId = (allSessions as Array<{ id: number; createdAt: Date }>).length > 0
    ? [...(allSessions as Array<{ id: number; createdAt: Date }>)].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id
    : null;
  const { data: fallbackItems = [] } = trpc.buy.getItems.useQuery(
    { sessionId: mostRecentSessionId ?? 0 },
    { enabled: selectedSessionId === null && mostRecentSessionId !== null }
  );

  // The items to use for display: selected session items if a session is chosen, otherwise fallback
  const displayItems = selectedSessionId !== null ? sessionItems : fallbackItems;

  // No auto-select: default is no session selected.
  // User can click into a session via the session selector in the Buy Session bar.

  const upsertItemMutation = trpc.buy.upsertItem.useMutation({
    onError: (err) => toast.error(`Failed to save qty: ${err.message}`),
  });

  // Style-level Size 11 mutation — updates ALL SKUs in the style
  const updateStyleSize11Mutation = trpc.sku.updateStyleSize11.useMutation({
    onSuccess: () => refetchSkuMeta(),
    onError: (err) => toast.error(`Failed to update Size 11: ${err.message}`),
  });

  // Fetch size 11 availability from tonybianco.com.au
  const [isFetchingSize11, setIsFetchingSize11] = useState(false);
  const fetchSize11Mutation = trpc.sku.fetchSize11FromTonyBianco.useMutation({
    onSuccess: (result) => {
      refetchSkuMeta();
      const with11 = result.results.filter((r: { style: string; isSize11: boolean }) => r.isSize11).length;
      const without11 = result.results.filter((r: { style: string; isSize11: boolean }) => !r.isSize11).length;
      toast.success(
        `Size 11 updated: ${with11} styles YES, ${without11} styles NO. ` +
        `${result.notFoundStyles.length} new styles not yet on website.`
      );
      setIsFetchingSize11(false);
    },
    onError: (err) => {
      toast.error(`Failed to fetch size 11 data: ${err.message}`);
      setIsFetchingSize11(false);
    },
  });

  function handleFetchSize11() {
    if (isFetchingSize11) return;
    setIsFetchingSize11(true);
    // Build skusByStyle from all merged SKUs
    const skusByStyle: Record<string, Array<{ colour: string; leather: string }>> = {};
    for (const sku of mergedRawSkus) {
      if (!skusByStyle[sku.style]) skusByStyle[sku.style] = [];
      skusByStyle[sku.style].push({ colour: sku.colour, leather: sku.leather ?? "" });
    }
    fetchSize11Mutation.mutate({ skusByStyle });
  }

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

  // Buy session item lookup — uses selected session items, or falls back to most recent session for read-only display
  const sessionItemMap = useMemo(() => {
    const map: Record<string, { auQty: number; usaQty: number }> = {};
    for (const item of displayItems) {
      const key = `${item.style}|${item.colour}|${item.leather}` as string;
      map[key] = { auQty: (item as any).auQty ?? 0, usaQty: (item as any).usaQty ?? 0 };
    }
    return map;
  }, [displayItems]);

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

  // Approved styles list (from skuData, filtered by fitApproved in styleMeta, excluding cancelled)
  const approvedFitStyles = useMemo(() => {
    return skuData.styles.filter((s) => !cancelledSet.has(s.style) && styleMetaMap[s.style]?.fitApproved === true);
  }, [styleMetaMap, cancelledSet]);

  function handleMetaChange() {
    refetchSkuMeta();
  }

  function handleSessionChange() {
    refetchSessions();
    refetchActive();
  }

  function handleQtyChange(style: string, colour: string, leather: string, field: 'au' | 'usa', val: string) {
    const key = `${style}|${colour}|${leather}|${field}`;
    const qty = parseInt(val, 10);
    if (!isNaN(qty) && qty >= 0) {
      pendingQty.current[key] = qty;
    }
  }

  function handleQtyBlur(style: string, colour: string, leather: string, field: 'au' | 'usa') {
    if (!selectedSessionId || isSessionLocked) return;
    const baseKey = `${style}|${colour}|${leather}`;
    const fieldKey = `${baseKey}|${field}`;
    const newVal = pendingQty.current[fieldKey];
    if (newVal === undefined) return;
    const current = sessionItemMap[baseKey] ?? { auQty: 0, usaQty: 0 };
    const auQty = field === 'au' ? newVal : current.auQty;
    const usaQty = field === 'usa' ? newVal : current.usaQty;
    upsertItemMutation.mutate(
      { sessionId: selectedSessionId, style, colour, leather, auQty, usaQty },
      { onSuccess: () => { refetchItems(); delete pendingQty.current[fieldKey]; } }
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

  // Apply runtime category overrides (sub-categories + trend flags)
  const stylesWithCategories = useMemo(() => {
    return mergedStyles
      .filter((s) => !cancelledSet.has(s.style))
      .map((s) => ({
        ...s,
        category: getCategory(s.style, s.category),
        trendFlag: getTrendFlag(s.style),
      }));
  }, [mergedStyles, cancelledSet, getCategory, getTrendFlag]);

  // Filter styles (uses mergedStyles which includes custom SKUs)
  const filtered = useMemo(() => {
    let data = stylesWithCategories;

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
  }, [search, categoryFilter, statusFilter, mergedStyles, cancelledSet]);

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
    return mergedRawSkus.filter((s) => s.style === styleName && !cancelledSkuSet.has(`${s.style}|${s.colour}|${s.leather}`));
  }

  // Session buy total for a style (AU + USA combined)
  function getStyleSessionTotal(styleName: string) {
    return getSkusForStyle(styleName).reduce((sum, sku) => {
      const key = `${sku.style}|${sku.colour}|${sku.leather}` as string;
      const item = sessionItemMap[key];
      return sum + (item ? item.auQty + item.usaQty : 0);
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
        onDeselect={() => setSelectedSessionId(null)}
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

        <button
          onClick={handleFetchSize11}
          disabled={isFetchingSize11}
          title="Reads tonybianco.com.au to auto-fill which styles come in size 11"
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-green-50 hover:border-green-400 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          {isFetchingSize11 ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Fetching…</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> Sync Size 11</>
          )}
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
                      <th className="px-4 py-2.5 w-10" />
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
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                                  {style.category}
                                </span>
                                {style.trendFlag && (
                                  <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "oklch(0.95 0.06 300)", color: "oklch(0.45 0.15 300)" }}>
                                    {style.trendFlag}
                                  </span>
                                )}
                              </div>
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
                            {/* Style-level Size 11 — badge only when true, click to toggle */}
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {styleSize11 ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleStyleSize11Toggle(style.style); }}
                                  title="Size 11 — click to remove"
                                  className="px-2 py-0.5 rounded text-xs font-semibold transition-colors"
                                  style={{ background: "oklch(0.94 0.06 240)", color: "oklch(0.45 0.14 240)", border: "1px solid oklch(0.80 0.10 240)" }}
                                >
                                  11
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleStyleSize11Toggle(style.style); }}
                                  title="Mark as Size 11"
                                  className="px-2 py-0.5 rounded text-xs text-transparent hover:text-muted-foreground transition-colors"
                                  style={{ border: "1px solid transparent" }}
                                >
                                  11
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {sessionTotal > 0 ? (
                                <span className="text-sm font-bold tabular-nums" style={{ color: "oklch(0.50 0.14 55)" }}>{sessionTotal}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            {/* Cancel style button */}
                            <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Cancel ${style.style}? It will be hidden across the dashboard. You can restore it later.`)) {
                                    cancelStyleMutation.mutate({ style: style.style });
                                    toast.success(`${style.style} cancelled`);
                                  }
                                }}
                                title="Cancel this style — hides it across the dashboard"
                                className="p-1.5 rounded hover:bg-red-50 hover:text-red-600 transition-colors text-muted-foreground"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>

                            {/* Expanded SKU rows with inline buy qty */}
                          {expandedStyle === style.style && (
                            <tr key={`${style.style}-expanded`} className="border-b" style={{ borderColor: "var(--border)" }}>
                              <td colSpan={8} className="px-6 py-4" style={{ background: "oklch(0.98 0.02 65 / 0.5)" }}>
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
                                  <div className="flex items-center gap-2 mb-3">
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

                                {/* Add Colour button + inline form — always visible */}
                                {(() => {
                                  const draft = addColourDraft[style.style];
                                  return (
                                    <div className="mb-3">
                                      {draft ? (
                                        <div className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: "oklch(0.80 0.10 65)", background: "oklch(0.98 0.02 65 / 0.5)" }}>
                                          <input
                                            type="text"
                                            placeholder="Colour (e.g. DOVE)"
                                            value={draft.colour}
                                            onChange={(e) => setAddColourDraft((prev) => ({ ...prev, [style.style]: { ...prev[style.style], colour: e.target.value.toUpperCase() } }))}
                                            className="flex-1 px-2 py-1 rounded border text-xs bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <input
                                            type="text"
                                            placeholder="Leather (e.g. NAPPA)"
                                            value={draft.leather}
                                            onChange={(e) => setAddColourDraft((prev) => ({ ...prev, [style.style]: { ...prev[style.style], leather: e.target.value.toUpperCase() } }))}
                                            className="flex-1 px-2 py-1 rounded border text-xs bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!draft.colour.trim()) return;
                                              addCustomSkuMutation.mutate({ style: style.style, colour: draft.colour.trim(), leather: draft.leather.trim() });
                                            }}
                                            disabled={!draft.colour.trim() || addCustomSkuMutation.isPending}
                                            className="px-3 py-1 rounded text-xs font-semibold text-white disabled:opacity-50"
                                            style={{ background: "oklch(0.65 0.16 65)" }}
                                          >
                                            {addCustomSkuMutation.isPending ? "Adding..." : "Add"}
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setAddColourDraft((prev) => { const n = { ...prev }; delete n[style.style]; return n; }); }}
                                            className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setAddColourDraft((prev) => ({ ...prev, [style.style]: { colour: "", leather: "" } })); }}
                                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/50 transition-colors"
                                        >
                                          <Plus className="w-3 h-3" />
                                          Add colour
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Split into Existing and New SKU sections */}
                                {(() => {
                                  const allSkus = getSkusForStyle(style.style);
                                  const existingSkus = allSkus.filter((s) => !s.is_new);
                                  const newSkus = allSkus.filter((s) => s.is_new);

                                  const renderRow = (sku: typeof allSkus[0], isNew: boolean) => {
                                    const skuKey2 = `${sku.style}|${sku.colour}|${sku.leather}`;
                                    const dbMeta = skuMetaMap[skuKey2];
                                    const sessionQtyObj = sessionItemMap[skuKey2] ?? { auQty: 0, usaQty: 0 };
                                    const sessionAuQty = sessionQtyObj.auQty;
                                    const sessionUsaQty = sessionQtyObj.usaQty;
                                    const sessionTotalQty = sessionAuQty + sessionUsaQty;
                                    return (
                                      <div
                                        key={`${sku.colour}-${sku.leather}`}
                                        className="grid items-center gap-2 px-3 py-2 rounded-lg"
                                        style={{
                                          gridTemplateColumns: isNew
                                            ? "minmax(130px,2fr) minmax(110px,1.5fr) 36px 64px minmax(170px,auto) 32px 28px"
                                            : "minmax(130px,2fr) minmax(110px,1.5fr) 36px 32px 28px",
                                          border: "1px solid var(--border)",
                                          background: sessionTotalQty > 0 ? "oklch(0.97 0.06 65 / 0.5)" : "var(--card)",
                                        }}
                                      >
                                        {/* Colour */}
                                        <span className="text-sm font-medium text-foreground truncate">{sku.colour}</span>
                                        {/* Leather */}
                                        <span className="text-xs text-muted-foreground truncate">{sku.leather || "—"}</span>
                                        {/* Size 11 — only show badge if YES */}
                                        <span className="text-xs text-center">
                                          {styleSize11 ? (
                                            <span className="px-1 py-0.5 rounded text-xs font-semibold" style={{ background: "oklch(0.94 0.06 240)", color: "oklch(0.45 0.14 240)" }}>11</span>
                                          ) : null}
                                        </span>
                                        {/* Sample — new SKUs only */}
                                        {isNew && (
                                          <span className="text-xs text-center">
                                            {dbMeta?.sampleStatus === "received" ? (
                                              <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "oklch(0.94 0.08 155)", color: "oklch(0.40 0.14 155)" }}>✓ Rcvd</span>
                                            ) : <span className="text-muted-foreground text-xs">—</span>}
                                          </span>
                                        )}
                                        {/* Buy Qty — new SKUs only */}
                                        {isNew && (
                                          <div className="flex items-center gap-1.5">
                                            {!isSessionLocked && selectedSession ? (
                                              <>
                                                <div className="flex flex-col items-center gap-0.5">
                                                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">AU</span>
                                                  <input
                                                    type="number" min={0}
                                                    defaultValue={sessionAuQty || ""}
                                                    key={`au-${selectedSessionId}-${skuKey2}`}
                                                    onChange={(e) => handleQtyChange(sku.style, sku.colour, sku.leather, 'au', e.target.value)}
                                                    onBlur={() => handleQtyBlur(sku.style, sku.colour, sku.leather, 'au')}
                                                    onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                                                    placeholder="0"
                                                    className="w-14 px-1.5 py-1 rounded border text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40 text-right"
                                                    style={{ borderColor: sessionAuQty > 0 ? "oklch(0.72 0.16 65)" : "var(--border)" }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                </div>
                                                <div className="flex flex-col items-center gap-0.5">
                                                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">USA</span>
                                                  <input
                                                    type="number" min={0}
                                                    defaultValue={sessionUsaQty || ""}
                                                    key={`usa-${selectedSessionId}-${skuKey2}`}
                                                    onChange={(e) => handleQtyChange(sku.style, sku.colour, sku.leather, 'usa', e.target.value)}
                                                    onBlur={() => handleQtyBlur(sku.style, sku.colour, sku.leather, 'usa')}
                                                    onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                                                    placeholder="0"
                                                    className="w-14 px-1.5 py-1 rounded border text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-blue-400/40 text-right"
                                                    style={{ borderColor: sessionUsaQty > 0 ? "oklch(0.65 0.14 240)" : "var(--border)" }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                </div>
                                              </>
                                            ) : (
                                              <div className="flex gap-2">
                                                <span className="text-xs font-mono" style={{ color: sessionAuQty > 0 ? "oklch(0.50 0.14 55)" : "var(--muted-foreground)" }}>
                                                  AU: {sessionAuQty > 0 ? sessionAuQty : "—"}
                                                </span>
                                                <span className="text-xs font-mono" style={{ color: sessionUsaQty > 0 ? "oklch(0.45 0.14 240)" : "var(--muted-foreground)" }}>
                                                  USA: {sessionUsaQty > 0 ? sessionUsaQty : "—"}
                                                </span>
                                              </div>
                                            )}
                                          </div>
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
                                        {/* Cancel SKU button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Cancel ${sku.colour} ${sku.leather} from ${sku.style}? It will be hidden from the range.`)) {
                                              cancelSkuMutation.mutate({ style: sku.style, colour: sku.colour, leather: sku.leather });
                                            }
                                          }}
                                          className="p-1 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                                          title="Cancel this SKU"
                                        >
                                          <Ban className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                                        </button>
                                      </div>
                                    );
                                  };

                                  return (
                                    <div className="space-y-3">
                                      {/* Existing SKUs section */}
                                      {existingSkus.length > 0 && (
                                        <div>
                                          <div className="flex items-center gap-2 mb-1.5 px-1">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Existing</span>
                                            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                                            {/* Column labels for existing */}
                                            <div className="flex items-center gap-8 pr-1">
                                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-36">Colour</span>
                                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-28">Leather</span>
                                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-9 text-center">Sz11</span>
                                            </div>
                                          </div>
                                          <div className="space-y-1">
                                            {existingSkus.map((sku) => renderRow(sku, false))}
                                          </div>
                                        </div>
                                      )}
                                      {/* New SKUs section */}
                                      {newSkus.length > 0 && (
                                        <div>
                                          <div className="flex items-center gap-2 mb-1.5 px-1">
                                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "oklch(0.55 0.14 55)" }}>New</span>
                                            <div className="flex-1 h-px" style={{ background: "oklch(0.85 0.06 65)" }} />
                                            {/* Column labels for new */}
                                            <div className="flex items-center gap-4 pr-1">
                                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-36">Colour</span>
                                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-28">Leather</span>
                                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-9 text-center">Sz11</span>
                                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-16 text-center">Sample</span>
                                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-36 text-center">Buy Qty</span>
                                            </div>
                                          </div>
                                          <div className="space-y-1">
                                            {newSkus.map((sku) => renderRow(sku, true))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
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

      {/* Cancelled Styles section */}
      {cancelledList.length > 0 && (
        <div className="mt-4 border rounded-xl overflow-hidden" style={{ borderColor: "oklch(0.82 0.06 20)" }}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{ background: cancelledSectionOpen ? "oklch(0.97 0.03 20 / 0.4)" : "oklch(0.97 0.03 20 / 0.25)" }}
            onClick={() => setCancelledSectionOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4" style={{ color: "oklch(0.55 0.12 20)" }} />
              <span className="text-sm font-semibold" style={{ color: "oklch(0.45 0.12 20)" }}>
                Cancelled ({cancelledList.length} {cancelledList.length === 1 ? "style" : "styles"})
              </span>
              <span className="text-xs" style={{ color: "oklch(0.60 0.08 20)" }}>— hidden from dashboard</span>
            </div>
            {cancelledSectionOpen
              ? <ChevronDown className="w-4 h-4" style={{ color: "oklch(0.55 0.08 20)" }} />
              : <ChevronRight className="w-4 h-4" style={{ color: "oklch(0.55 0.08 20)" }} />}
          </button>

          {cancelledSectionOpen && (
            <div className="divide-y" style={{ borderColor: "oklch(0.90 0.04 20)" }}>
              {cancelledList.map((row) => {
                const styleInfo = skuData.styles.find((s) => s.style === row.style);
                return (
                  <div key={row.style} className="flex items-center gap-3 px-4 py-3">
                    {styleInfo?.imageUrl && (
                      <img src={styleInfo.imageUrl} alt={row.style} className="w-10 h-10 rounded object-cover flex-shrink-0 opacity-50" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-muted-foreground line-through">{row.style}</span>
                      {styleInfo && (
                        <span className="ml-2 text-xs text-muted-foreground">{styleInfo.last} · {styleInfo.category}</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        restoreStyleMutation.mutate({ style: row.style });
                        toast.success(`${row.style} restored`);
                      }}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors text-muted-foreground"
                      title="Restore this style"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Restore
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cancelled SKUs section */}
      {cancelledSkuList.length > 0 && (
        <div className="mt-4 border rounded-xl overflow-hidden" style={{ borderColor: "oklch(0.82 0.06 20)" }}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{ background: cancelledSkuSectionOpen ? "oklch(0.97 0.03 20 / 0.4)" : "oklch(0.97 0.03 20 / 0.25)" }}
            onClick={() => setCancelledSkuSectionOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4" style={{ color: "oklch(0.55 0.12 20)" }} />
              <span className="text-sm font-semibold" style={{ color: "oklch(0.45 0.12 20)" }}>
                Cancelled SKUs ({cancelledSkuList.length})
              </span>
              <span className="text-xs" style={{ color: "oklch(0.60 0.08 20)" }}>— hidden from range</span>
            </div>
            {cancelledSkuSectionOpen
              ? <ChevronDown className="w-4 h-4" style={{ color: "oklch(0.55 0.08 20)" }} />
              : <ChevronRight className="w-4 h-4" style={{ color: "oklch(0.55 0.08 20)" }} />}
          </button>
          {cancelledSkuSectionOpen && (
            <div className="divide-y" style={{ borderColor: "oklch(0.90 0.04 20)" }}>
              {(cancelledSkuList as Array<{ style: string; colour: string; leather: string }>).map((row) => (
                <div key={`${row.style}|${row.colour}|${row.leather}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-muted-foreground line-through">{row.colour} {row.leather}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{row.style}</span>
                  </div>
                  <button
                    onClick={() => {
                      restoreSkuMutation.mutate({ style: row.style, colour: row.colour, leather: row.leather });
                      toast.success(`${row.colour} ${row.leather} restored to ${row.style}`);
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors text-muted-foreground"
                    title="Restore this SKU"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Restore
                  </button>
                </div>
              ))}
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
