/**
 * ExportPanel — Full Data Export, AP21 CSV, and PPTX Range Review Sync
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { FileDown, X, Upload, FileText } from "lucide-react";
import { useSeason } from "@/contexts/SeasonContext";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import PptxSyncModal from "./PptxSyncModal";

interface Props {
  onClose: () => void;
}

// AP21 size ranges — standard EU footwear
const AP21_SIZE_RANGE_STANDARD = "EU35-41";
const AP21_SIZE_RANGE_WITH_11 = "EU35-42";
const AP21_SIZES_STANDARD = ["35", "36", "37", "38", "39", "40", "41"];
const AP21_SIZES_WITH_11 = ["35", "36", "37", "38", "39", "40", "41", "42"];

// All available columns for the Full Data Export
const FULL_EXPORT_ALL_COLS: Array<{ key: string; label: string }> = [
  { key: "Style",             label: "Style" },
  { key: "Category",          label: "Category" },
  { key: "Last",              label: "Last" },
  { key: "Heel Height (cm)",  label: "Heel Height (cm)" },
  { key: "Colour",            label: "Colour" },
  { key: "Leather",           label: "Leather" },
  { key: "Status",            label: "New / Existing" },
  { key: "Size 11",           label: "Size 11" },
  { key: "Sample Status",     label: "Sample Status" },
];
// These columns are always included and cannot be deselected
const FULL_EXPORT_REQUIRED_COLS = ["Style", "Colour", "Leather"];
const FULL_EXPORT_DEFAULT_COLS = new Set(FULL_EXPORT_ALL_COLS.map(c => c.key));

export default function ExportPanel({ onClose }: Props) {
  const { mergedRawSkus, mergedStyles } = useCustomSkus();
  const { season } = useSeason();
  const [exporting, setExporting] = useState<string | null>(null);
  const [ap21Style, setAp21Style] = useState<string>("ALL");
  const [showPptxSync, setShowPptxSync] = useState(false);
  const [fullExportCols, setFullExportCols] = useState<Set<string>>(FULL_EXPORT_DEFAULT_COLS);
  const utils = trpc.useUtils();

  const { data: skuMetaList = [] } = trpc.sku.getAll.useQuery();
  const { data: styleMetaList = [] } = trpc.style.getAll.useQuery();
  const { data: cancelledSkuList = [] } = trpc.cancelledSku.list.useQuery();
  const { data: cancelledStylesRaw = [] } = trpc.styles.listCancelled.useQuery();
  const { data: heelHeightData = [] } = trpc.heelHeight.getAll.useQuery();
  const heelHeightMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of heelHeightData as Array<{ lastName: string; heelHeightCm: number }>) {
      map.set(row.lastName.toUpperCase(), row.heelHeightCm);
    }
    return map;
  }, [heelHeightData]);
  const HEEL_HEIGHT_CATEGORIES = new Set(["Dress Shoe", "Dress Sandal", "Wedge"]);



  // Build lookup maps
  const skuMetaMap: Record<string, typeof skuMetaList[0]> = {};
  for (const m of skuMetaList) {
    skuMetaMap[`${m.style}|${m.colour}|${m.leather}`] = m;
  }
  const styleMetaMap: Record<string, typeof styleMetaList[0]> = {};
  for (const m of styleMetaList) {
    styleMetaMap[m.style] = m;
  }

  // Style lookup for category/last (uses mergedStyles to include custom styles)
  const styleLookup: Record<string, { category: string; last: string }> = {};
  for (const s of (mergedStyles as any[])) {
    styleLookup[s.style] = { category: s.category, last: s.last };
  }

  // Cancelled sets for AP21 export filtering
  const cancelledStyleSet = useMemo(
    () => new Set((cancelledStylesRaw as any[]).map((r: any) => r.style as string)),
    [cancelledStylesRaw]
  );
  const cancelledSkuSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of cancelledSkuList) s.add(`${r.style}|${r.colour}|${r.leather}`);
    return s;
  }, [cancelledSkuList]);

  // Sorted style list for AP21 selector (excluding cancelled, uses mergedStyles)
  const ap21StyleOptions = useMemo(() => {
    const styles = (mergedStyles as any[])
      .filter((s: any) => !cancelledStyleSet.has(s.style))
      .map((s: any) => s.style)
      .sort();
    return ["ALL", ...styles];
  }, [mergedStyles, cancelledStyleSet]);

  // AP21 CSV generator
  function exportAP21Csv() {
    setExporting("ap21");
    try {
      type RawSku = { style: string; colour: string; leather: string; is_new: boolean };
      const rawSkus = mergedRawSkus as unknown as RawSku[];

      // Determine which styles to export
      const stylesToExport = ap21Style === "ALL"
        ? (mergedStyles as any[]).filter((s: any) => !cancelledStyleSet.has(s.style)).map((s: any) => s.style)
        : [ap21Style];

      const csvRows: string[][] = [];

      // AP21 column headers
      const headers = [
        "Article Code", "Article Name", "COMMENTS",
        "Colour Code", "Colour Description",
        "Size Code", "Code1",
        "EAN Code", "Sell Price",
        "Purchased", "Produced", "Sold", "Stocked", "UsedInProd",
        "Include in MRP", "Sold at Retail",
        ...Array.from({ length: 30 }, (_, i) => `Ref${i + 1}`),
        "Cost", "Dimension Range", "Dimension Code",
        "Style Level", "UOM",
      ];
      csvRows.push(headers);

      for (const styleName of stylesToExport) {
        const styleInfo = styleLookup[styleName];
        const articleName = styleInfo
          ? `${styleName} ${styleInfo.category.toUpperCase()}`
          : styleName;

        // Get all active SKUs for this style
        const styleSkus = rawSkus.filter(
          (r) =>
            r.style === styleName &&
            !cancelledSkuSet.has(`${r.style}|${r.colour}|${r.leather}`)
        );

        // mergedRawSkus already includes custom SKUs, so no extra merge needed
        const allStyleSkus = styleSkus;
        if (allStyleSkus.length === 0) continue;

        // Determine if this style has size 11 (any SKU has isSize11=true)
        const hasSize11 = allStyleSkus.some((sku) => {
          const meta = skuMetaMap[`${sku.style}|${sku.colour}|${sku.leather}`];
          return meta?.isSize11 === true;
        });
        const sizeRange = hasSize11 ? AP21_SIZE_RANGE_WITH_11 : AP21_SIZE_RANGE_STANDARD;
        const sizes = hasSize11 ? AP21_SIZES_WITH_11 : AP21_SIZES_STANDARD;

        // Get style-level RRP
        const styleMeta = styleMetaMap[styleName];
        const rrp = styleMeta?.rrp ?? "";

        // ── Style-level row (no colour, no size) ──
        // AP21 requires a style row first with Style Level set
        const styleRow = [
          styleName,           // Article Code
          articleName,         // Article Name
          "",                  // COMMENTS
          "",                  // Colour Code
          "",                  // Colour Description
          "",                  // Size Code
          "",                  // Code1
          "",                  // EAN Code
          rrp !== "" ? String(rrp) : "", // Sell Price
          "Y",                 // Purchased
          "N",                 // Produced
          "Y",                 // Sold
          "Y",                 // Stocked
          "N",                 // UsedInProd
          "N",                 // Include in MRP
          "Y",                 // Sold at Retail
          ...Array(30).fill(""), // Ref1-Ref30
          "",                  // Cost
          "",                  // Dimension Range
          "",                  // Dimension Code
          "2",                 // Style Level (colours and sizes)
          "Each",              // UOM
        ];
        csvRows.push(styleRow);

        // ── Colour rows (one per unique colour/leather combo) ──
        // Ordered by colour then size per AP21 spec
        const seenColours = new Set<string>();
        const orderedColours: { colour: string; leather: string }[] = [];
        for (const sku of allStyleSkus) {
          const key = `${sku.colour}|${sku.leather}`;
          if (!seenColours.has(key)) {
            seenColours.add(key);
            orderedColours.push({ colour: sku.colour, leather: sku.leather });
          }
        }
        orderedColours.sort((a, b) => a.colour.localeCompare(b.colour));

        for (const { colour, leather } of orderedColours) {
          const colourDesc = leather ? `${colour} ${leather}` : colour;
          const skuMeta = skuMetaMap[`${styleName}|${colour}|${leather}`];
          const cost = skuMeta?.costPrice ?? "";

          // Colour-level row (no size)
          const colourRow = [
            styleName,           // Article Code
            articleName,         // Article Name
            "",                  // COMMENTS
            colour,              // Colour Code
            colourDesc,          // Colour Description
            "",                  // Size Code
            "",                  // Code1
            "",                  // EAN Code
            "",                  // Sell Price (style level only)
            "Y",                 // Purchased
            "N",                 // Produced
            "Y",                 // Sold
            "Y",                 // Stocked
            "N",                 // UsedInProd
            "N",                 // Include in MRP
            "Y",                 // Sold at Retail
            ...Array(30).fill(""), // Ref1-Ref30
            cost !== "" ? String(cost) : "", // Cost
            "",                  // Dimension Range
            "",                  // Dimension Code
            "",                  // Style Level (blank on colour rows)
            "",                  // UOM
          ];
          csvRows.push(colourRow);

          // Size rows (one per size in range)
          for (const sizeCode of sizes) {
            const sizeRow = [
              styleName,           // Article Code
              articleName,         // Article Name
              "",                  // COMMENTS
              colour,              // Colour Code
              colourDesc,          // Colour Description
              sizeRange,           // Size Code (range)
              sizeCode,            // Code1 (individual size)
              "",                  // EAN Code
              "",                  // Sell Price
              "Y",                 // Purchased
              "N",                 // Produced
              "Y",                 // Sold
              "Y",                 // Stocked
              "N",                 // UsedInProd
              "N",                 // Include in MRP
              "Y",                 // Sold at Retail
              ...Array(30).fill(""), // Ref1-Ref30
              "",                  // Cost (SKU level, leave blank)
              "",                  // Dimension Range
              "",                  // Dimension Code
              "",                  // Style Level
              "",                  // UOM
            ];
            csvRows.push(sizeRow);
          }
        }
      }

      // Build CSV string
      const csvContent = csvRows
        .map((row) =>
          row.map((cell) => {
            const s = String(cell ?? "");
            // Quote cells that contain commas, quotes, or newlines
            if (s.includes(",") || s.includes('"') || s.includes("\n")) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          }).join(",")
        )
        .join("\r\n");

      // Download
      const suffix = ap21Style === "ALL" ? "all" : ap21Style.toLowerCase();
      const filename = `products_${suffix}_${Date.now()}.csv`;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const skuCount = csvRows.length - 1; // exclude header
      toast.success(`AP21 CSV exported: ${filename} (${skuCount} rows)`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate AP21 CSV");
    } finally {
      setExporting(null);
    }
  }

  // Column width map for the full export
  const FULL_EXPORT_COL_WIDTHS: Record<string, number> = {
    "Style": 14, "Category": 16, "Last": 14, "Heel Height (cm)": 14,
    "Colour": 16, "Leather": 22, "Status": 10, "Size 11": 8,
    "Sample Status": 14,
  };

  function exportFullData() {
    setExporting("full");
    try {
      // Build full row, then pick only selected columns in definition order
      const selectedKeys = FULL_EXPORT_ALL_COLS.map(c => c.key).filter(k => fullExportCols.has(k));

      const rows = (mergedRawSkus as any[])
        .filter((sku: any) => !cancelledStyleSet.has(sku.style) && !cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`))
        .map((sku: any) => {
        const key = `${sku.style}|${sku.colour}|${sku.leather}` as string;
        const meta = skuMetaMap[key];
        const lastName = (styleLookup[sku.style]?.last ?? "").toUpperCase();
        const category = styleLookup[sku.style]?.category ?? "";
        const isHeelCategory = HEEL_HEIGHT_CATEGORIES.has(category);
        const heelHeight = isHeelCategory ? (heelHeightMap.get(lastName) ?? "") : "";
        const allFields: Record<string, any> = {
          Style: sku.style,
          Category: category,
          Last: styleLookup[sku.style]?.last ?? "",
          "Heel Height (cm)": heelHeight,
          Colour: sku.colour,
          Leather: sku.leather,
          Status: sku.is_new ? "New" : "Existing",
          "Size 11": meta?.isSize11 ? "Yes" : "No",
          "Sample Status": meta?.sampleStatus === "received" ? "Received" : meta?.sampleStatus === "fitting_sample" ? "Fitting Sample" : "Waiting",
        };
        // Return only selected columns in order
        const filtered: Record<string, any> = {};
        for (const k of selectedKeys) filtered[k] = allFields[k];
        return filtered;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = selectedKeys.map(k => ({ wch: FULL_EXPORT_COL_WIDTHS[k] ?? 14 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Full SKU Data");
      XLSX.writeFile(wb, "SS26_Full_Export.xlsx");
      toast.success(`Exported ${rows.length} SKUs · ${selectedKeys.length} columns`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-[480px] max-w-full rounded-2xl shadow-2xl bg-card flex flex-col" style={{ border: "1px solid var(--border)", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-display font-bold text-lg text-foreground">Export Data</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1 min-h-0">
          <p className="text-sm text-muted-foreground">
            Choose an export format. All exports include Size 11 flag and current DB data.
          </p>





          {/* AP21 CSV Export */}
          <div
            className="w-full rounded-xl border overflow-hidden"
            style={{ borderColor: "oklch(0.80 0.12 280)", background: "oklch(0.97 0.02 280)" }}
          >
            <div className="flex items-start gap-4 p-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.92 0.06 280)" }}>
                <Upload className="w-5 h-5" style={{ color: "oklch(0.40 0.14 280)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">AP21 Product Import CSV</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generates a B2B product import CSV in the AP21 format. One row per colour per size, ordered correctly for import.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <label className="text-xs text-muted-foreground font-medium flex-shrink-0">Style:</label>
                  <select
                    value={ap21Style}
                    onChange={(e) => setAp21Style(e.target.value)}
                    disabled={exporting !== null}
                    className="flex-1 text-xs rounded-md border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 text-foreground"
                    style={{ borderColor: "oklch(0.80 0.12 280)" }}
                  >
                    {ap21StyleOptions.map((s) => (
                      <option key={s} value={s}>{s === "ALL" ? "All Styles" : s}</option>
                    ))}
                  </select>
                  <button
                    onClick={exportAP21Csv}
                    disabled={exporting !== null}
                    className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-all disabled:opacity-50"
                    style={{ background: "oklch(0.40 0.14 280)", color: "white" }}
                  >
                    {exporting === "ap21" ? "Generating…" : "Generate CSV"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PPTX Range Review Sync */}
          <button
            onClick={() => setShowPptxSync(true)}
            disabled={exporting !== null}
            className="w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all hover:bg-muted/30 disabled:opacity-50"
            style={{ borderColor: "oklch(0.80 0.10 260)", background: "oklch(0.97 0.02 260)" }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.92 0.06 260)" }}>
              <FileText className="w-5 h-5" style={{ color: "oklch(0.40 0.14 260)" }} />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Sync from Range Review PPTX</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload your range review PowerPoint to auto-cancel red SKUs and update sample status.
              </p>
            </div>
          </button>

          {/* Full Data Export */}
          <div className="w-full rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {/* Header row */}
            <div className="flex items-start gap-4 p-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--muted)" }}>
                <FileDown className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">Full Data Export</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose which columns to include, then export all SKUs to Excel.
                </p>
                {/* Select All / None row */}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => setFullExportCols(new Set(FULL_EXPORT_ALL_COLS.map(c => c.key)))}
                    className="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors hover:bg-muted/40"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  >Select All</button>
                  <button
                    onClick={() => setFullExportCols(new Set(FULL_EXPORT_REQUIRED_COLS))}
                    className="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors hover:bg-muted/40"
                    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                  >Reset</button>
                  <span className="text-xs text-muted-foreground ml-auto">{fullExportCols.size} columns</span>
                </div>
              </div>
            </div>
            {/* Column checkboxes */}
            <div className="px-4 pb-3 border-t grid grid-cols-2 gap-x-4 gap-y-1.5 pt-3" style={{ borderColor: "var(--border)" }}>
              {FULL_EXPORT_ALL_COLS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={fullExportCols.has(col.key)}
                    disabled={FULL_EXPORT_REQUIRED_COLS.includes(col.key)}
                    onChange={() => {
                      setFullExportCols(prev => {
                        const next = new Set(prev);
                        if (next.has(col.key)) next.delete(col.key);
                        else next.add(col.key);
                        return next;
                      });
                    }}
                    className="accent-amber-600 w-3.5 h-3.5 flex-shrink-0"
                  />
                  <span className={`text-xs font-medium truncate ${
                    FULL_EXPORT_REQUIRED_COLS.includes(col.key)
                      ? "text-muted-foreground"
                      : "text-foreground group-hover:text-foreground"
                  }`}>{col.label}</span>
                </label>
              ))}
            </div>
            {/* Export button */}
            <div className="px-4 pb-4 pt-2">
              <button
                onClick={exportFullData}
                disabled={exporting !== null || fullExportCols.size === 0}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: "oklch(0.50 0.14 55)" }}
              >
                <FileDown className="w-3.5 h-3.5" />
                {exporting === "full" ? "Exporting…" : `Export ${fullExportCols.size} columns`}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-muted"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
    {showPptxSync && (
      <PptxSyncModal
        onClose={() => setShowPptxSync(false)}
        onApplied={() => {
          setShowPptxSync(false);
          utils.cancelledSku.list.invalidate();
          utils.styles.listCancelled.invalidate();
          utils.sku.getAll.invalidate();
        }}
      />
    )}
    </>
  );
}
