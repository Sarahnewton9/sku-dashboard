/**
 * StylesTab — full filterable table of all styles
 * - Click a style row to expand its SKUs
 * - Inline buy qty editing per SKU linked to the active buy session
 * - Click a SKU's detail icon to open the SkuDetailPanel slide-out
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { skuData } from "@/lib/skuData";
import { trpc } from "@/lib/trpc";
import { Search, ChevronUp, ChevronDown, Download, Upload, SlidersHorizontal } from "lucide-react";
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

  // Pending qty changes (local before saving)
  const pendingQty = useRef<Record<string, number>>({});

  const utils = trpc.useUtils();

  // Fetch all SKU meta from DB
  const { data: skuMetaList = [], refetch: refetchSkuMeta } = trpc.sku.getAll.useQuery();
  const { data: styleMetaList = [], refetch: refetchStyleMeta } = trpc.style.getAll.useQuery();

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

  // Build lookup maps
  type SkuMetaItem = { style: string; colour: string; leather: string; sampleStatus?: string | null; orderQty?: number | null; isSize11?: boolean | null; costPrice?: number | null; fitRating?: string | null; fittingNotes?: string | null; };
  type StyleMetaItem = { style: string; rrp?: number | null; };

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

    data.sort((a, b) => {
      let av: string | number = a[sortKey] as string | number;
      let bv: string | number = b[sortKey] as string | number;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [search, categoryFilter, statusFilter, sortKey, sortDir]);

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

        <span className="text-sm text-muted-foreground">{filtered.length} of {skuData.styles.length} styles</span>

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

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                {[
                  { key: "style" as SortKey, label: "Style" },
                  { key: "category" as SortKey, label: "Category" },
                  { key: "last" as SortKey, label: "Last" },
                  { key: "totalSKUs" as SortKey, label: "Total SKUs" },
                  { key: "newSKUs" as SortKey, label: "New" },
                  { key: "existingSKUs" as SortKey, label: "Existing" },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort(key)}
                  >
                    <div className={`flex items-center gap-1 ${key !== "style" && key !== "category" && key !== "last" ? "justify-end" : ""}`}>
                      {label}
                      <SortIcon col={key} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide text-left">Leathers</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide text-right">
                  {selectedSession ? `Buy Qty` : "Buy Qty"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No styles match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((style) => {
                  const sessionTotal = getStyleSessionTotal(style.style);
                  return (
                    <>
                      <tr
                        key={style.style}
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
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{style.last}</td>
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
                            <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "1fr 1fr 1fr auto auto auto auto" }}>
                              {["Colour", "Leather", "Status", "Sz11", "Sample", "Fit", "Buy Qty"].map((h) => (
                                <span key={h} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2">{h}</span>
                              ))}
                            </div>

                            <div className="space-y-1">
                              {getSkusForStyle(style.style).map((sku) => {
                                const skuKey2 = `${sku.style}|${sku.colour}|${sku.leather}` as string;
                                const dbMeta = skuMetaMap[skuKey2];
                                const sessionQty = sessionItemMap[skuKey2] ?? 0;

                                return (
                                  <div
                                    key={`${sku.colour}-${sku.leather}`}
                                    className="grid items-center gap-1 px-2 py-1.5 rounded-lg"
                                    style={{
                                      gridTemplateColumns: "1fr 1fr 1fr auto auto auto auto",
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

                                    {/* Size 11 */}
                                    <span className="text-xs text-center">
                                      {dbMeta?.isSize11 ? (
                                        <span className="px-1 py-0.5 rounded text-xs font-medium" style={{ background: "oklch(0.94 0.06 240)", color: "oklch(0.45 0.14 240)" }}>✓</span>
                                      ) : <span className="text-muted-foreground">—</span>}
                                    </span>

                                    {/* Sample */}
                                    <span className="text-xs text-center">
                                      {dbMeta?.sampleStatus === "received" ? (
                                        <span className="px-1 py-0.5 rounded text-xs font-medium" style={{ background: "oklch(0.94 0.08 155)", color: "oklch(0.40 0.14 155)" }}>✓</span>
                                      ) : <span className="text-muted-foreground">—</span>}
                                    </span>

                                    {/* Fit rating */}
                                    <span className="text-xs text-muted-foreground truncate">
                                      {dbMeta?.fitRating === "tts" ? "TTS" : dbMeta?.fitRating === "runs_small" ? "Small" : dbMeta?.fitRating === "runs_large" ? "Large" : "—"}
                                    </span>

                                    {/* Buy Qty — inline input or read-only */}
                                    <div className="flex items-center gap-1">
                                      {!isSessionLocked && selectedSession ? (
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
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SKU Detail Panel */}
      {selectedSku && (
        <SkuDetailPanel
          sku={selectedSku}
          onClose={() => setSelectedSku(null)}
          skuMeta={skuMetaMap as any}
          styleMeta={styleMetaMap as any}
          onMetaChange={handleMetaChange}
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
