/**
 * StylesTab — full filterable table of all styles
 */

import { useState, useMemo } from "react";
import { skuData } from "@/lib/skuData";
import { Search, ChevronUp, ChevronDown, Download } from "lucide-react";
import * as XLSX from "xlsx";

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

  function exportToExcel() {
    // Build rows: one per SKU, filtered to match the current category filter
    const rows = skuData.rawSkus
      .filter((sku) => categoryFilter === "All" || sku.category === categoryFilter)
      .map((sku) => ({
        Category: sku.category,
        Style: sku.style,
        Last: sku.last,
        Colour: sku.colour,
        Leather: sku.leather,
        Status: sku.is_new ? "New" : "Existing",
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    // Set column widths
    ws["!cols"] = [
      { wch: 14 }, // Category
      { wch: 14 }, // Style
      { wch: 14 }, // Last
      { wch: 16 }, // Colour
      { wch: 22 }, // Leather
      { wch: 10 }, // Status
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
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

        {/* Category filter */}
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

        {/* Status filter */}
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
          onClick={exportToExcel}
          className="ml-auto flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
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
                  <tr
                    key={style.style}
                    className="border-b transition-colors hover:bg-muted/30"
                    style={{
                      borderColor: "var(--border)",
                      background: style.isAllNew ? "oklch(0.99 0.04 65 / 0.4)" : undefined,
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Shoe thumbnail */}
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
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: "#f59e0b" }}
                            />
                          )}
                          <span className="font-semibold text-foreground">{style.style}</span>
                          {style.isAllNew && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-medium"
                              style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}
                            >
                              NEW
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                      >
                        {style.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{style.last}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">{style.totalSKUs}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {style.newSKUs > 0 ? (
                        <span className="font-semibold" style={{ color: "oklch(0.55 0.14 55)" }}>
                          {style.newSKUs}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{style.existingSKUs}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-48">
                        {style.leathers.slice(0, 4).map((l) => (
                          <span
                            key={l}
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                          >
                            {l}
                          </span>
                        ))}
                        {style.leathers.length > 4 && (
                          <span className="text-xs text-muted-foreground">+{style.leathers.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-48">
                        {style.colours.slice(0, 5).map((c) => (
                          <span
                            key={c}
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                          >
                            {c}
                          </span>
                        ))}
                        {style.colours.length > 5 && (
                          <span className="text-xs text-muted-foreground">+{style.colours.length - 5}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
