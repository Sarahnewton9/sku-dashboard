/**
 * StylesTab — full filterable table of all styles
 * Clicking a SKU row opens the SkuDetailPanel slide-out
 */

import { useState, useMemo } from "react";
import { skuData } from "@/lib/skuData";
import { trpc } from "@/lib/trpc";
import { Search, ChevronUp, ChevronDown, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import SkuDetailPanel, { type SkuPanelData } from "./SkuDetailPanel";
import ImportPanel from "./ImportPanel";

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

  // Fetch all SKU meta from DB
  const { data: skuMetaList = [], refetch: refetchSkuMeta } = trpc.sku.getAll.useQuery();
  const { data: styleMetaList = [], refetch: refetchStyleMeta } = trpc.style.getAll.useQuery();

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

  function handleMetaChange() {
    refetchSkuMeta();
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
    ws["!cols"] = [
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 },
      { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SKU Data");
    const filename = categoryFilter === "All"
      ? "SS26_SKU_Export.xlsx"
      : `SS26_SKU_Export_${categoryFilter.replace(/ /g, "_")}.xlsx`;
    XLSX.writeFile(wb, filename);
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
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 opacity-70" />
    ) : (
      <ChevronDown className="w-3 h-3 opacity-70" />
    );
  }

  // Get SKUs for a style from rawSkus
  function getSkusForStyle(styleName: string) {
    return skuData.rawSkus.filter((s) => s.style === styleName);
  }

  return (
    <div className="space-y-4">
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
          className="px-3 py-2 text-sm rounded-lg border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          style={{ borderColor: "var(--border)" }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          style={{ borderColor: "var(--border)" }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <span className="text-sm text-muted-foreground">
          {filtered.length} of {skuData.styles.length} styles
        </span>

        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          title="Import cost prices or RRP"
        >
          <Upload className="w-4 h-4" />
          Import
        </button>

        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          title="Export to Excel"
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
                <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide text-left">Colours</th>
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
                filtered.map((style) => (
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
                          <div
                            className="w-16 h-10 rounded flex-shrink-0 overflow-hidden flex items-center justify-center"
                            style={{ background: "var(--muted)" }}
                          >
                            {style.imageUrl ? (
                              <img
                                src={style.imageUrl}
                                alt={style.style}
                                className="w-full h-full object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {style.hasNew && (
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#f59e0b" }} />
                            )}
                            <span className="font-semibold text-foreground">{style.style}</span>
                            {style.isAllNew && (
                              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>
                                NEW
                              </span>
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
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-48">
                          {style.colours.slice(0, 5).map((c) => (
                            <span key={c} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>{c}</span>
                          ))}
                          {style.colours.length > 5 && <span className="text-xs text-muted-foreground">+{style.colours.length - 5}</span>}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded SKU rows */}
                    {expandedStyle === style.style && (
                      <tr key={`${style.style}-expanded`} className="border-b" style={{ borderColor: "var(--border)" }}>
                        <td colSpan={8} className="px-6 py-3" style={{ background: "oklch(0.98 0.02 65 / 0.5)" }}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                            SKUs — click any row to view details
                          </p>
                          <div className="space-y-1">
                            {getSkusForStyle(style.style).map((sku) => {
                              const skuKey2 = `${sku.style}|${sku.colour}|${sku.leather}` as string;
                              const dbMeta = skuMetaMap[skuKey2];
                              return (
                                <div
                                  key={`${sku.colour}-${sku.leather}`}
                                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-amber-50 transition-colors"
                                  style={{ border: "1px solid var(--border)" }}
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
                                >
                                  {sku.is_new && (
                                    <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>NEW</span>
                                  )}
                                  <span className="text-sm font-medium text-foreground">{sku.colour}</span>
                                  <span className="text-xs text-muted-foreground">{sku.leather}</span>
                                  <div className="ml-auto flex items-center gap-2">
                                    {dbMeta?.isSize11 && (
                                      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "oklch(0.94 0.06 240)", color: "oklch(0.45 0.14 240)" }}>Sz11</span>
                                    )}
                                    {dbMeta?.sampleStatus === "received" && (
                                      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "oklch(0.94 0.08 155)", color: "oklch(0.40 0.14 155)" }}>✓ Received</span>
                                    )}
                                    {dbMeta?.sampleStatus === "waiting" && (dbMeta?.orderQty ?? 0) > 0 && (
                                      <span className="text-xs text-muted-foreground">Waiting</span>
                                    )}
                                    {dbMeta?.fitRating && (
                                      <span className="text-xs text-muted-foreground capitalize">{dbMeta.fitRating.replace("_", " ")}</span>
                                    )}
                                    {dbMeta?.costPrice != null && (
                                      <span className="text-xs font-mono text-muted-foreground">${dbMeta.costPrice.toFixed(2)}</span>
                                    )}
                                    {dbMeta?.orderQty != null && dbMeta.orderQty > 0 && (
                                      <span className="text-xs font-semibold" style={{ color: "oklch(0.50 0.14 55)" }}>Qty: {dbMeta.orderQty}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
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
