/**
 * ExportPanel — Full Data Export, AP21 CSV (101836 BxB format), and PPTX Range Review Sync
 */
import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { FileDown, X, Upload, FileText } from "lucide-react";
import { useSeason } from "@/contexts/SeasonContext";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import PptxSyncModal from "./PptxSyncModal";
import AP21ColourCodeModal from "./AP21ColourCodeModal";

interface Props {
  onClose: () => void;
}

// ── AP21 101836 BxB format ─────────────────────────────────────────────────
// AU size range: 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 11 (no 10.5) + PACK
const AP21_SIZE_RANGE = "AU5-11";
const AP21_SIZES = ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "11"];
const AP21_SIZE_RANGE_WITH_PACK = "AU5-11";
const AP21_SIZES_WITH_PACK = [...AP21_SIZES, "PACK"];

// 101836 column headers (50 columns)
const AP21_HEADERS = [
  "Product Code",       // 1  - style name in CAPS
  "Product Description",// 2  - style name in Title Case
  "Colour Code",        // 3  - short code from colour_codes table
  "Colour Description", // 4  - full colour+leather description
  "Size Range",         // 5  - e.g. AU5-11
  "Size Code",          // 6  - individual size e.g. 7.5
  "EAN Code",           // 7
  "Sell Price",         // 8
  "Purchased",          // 9
  "Produced",           // 10
  "Sold",               // 11
  "Stocked",            // 12
  "Used In Production", // 13
  "Include in MRP",     // 14
  "Sold at Retail",     // 15
  "Ref1",  "Ref2",  "Ref3",  "Ref4",  "Ref5",
  "Ref6",  "Ref7",  "Ref8",  "Ref9",  "Ref10",
  "Ref11", "Ref12", "Ref13", "Ref14", "Ref15",
  "Ref16", "Ref17", "Ref18", "Ref19", "Ref20",
  "ColourRef1", "ColourRef2", "ColourRef3", "ColourRef4", "ColourRef5",
  "ColourRef6", "ColourRef7", "ColourRef8", "ColourRef9", "ColourRef10",
  "Cost",           // 46
  "Dimension Range",// 47
  "Dimension Code", // 48
  "Style Level",    // 49
  "UOM",            // 50
];

// Helper: Title Case a string (e.g. "KASSY" → "Kassy")
function toTitleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

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

  // Missing colour code modal state
  const [missingColourDescriptions, setMissingColourDescriptions] = useState<string[]>([]);
  const [showColourCodeModal, setShowColourCodeModal] = useState(false);
  // Callback to run after codes are confirmed
  const [pendingExportCallback, setPendingExportCallback] = useState<(() => void) | null>(null);

  const utils = trpc.useUtils();

  const { data: skuMetaList = [] } = trpc.sku.getAll.useQuery();
  const { data: styleMetaList = [] } = trpc.style.getAll.useQuery();
  const { data: cancelledSkuList = [] } = trpc.cancelledSku.list.useQuery();
  const { data: cancelledStylesRaw = [] } = trpc.styles.listCancelled.useQuery();
  const { data: heelHeightData = [] } = trpc.heelHeight.getAll.useQuery();
  // Load all colour codes for AP21 lookup
  const { data: colourCodeList = [] } = trpc.colourCode.getAll.useQuery();

  const heelHeightMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of heelHeightData as Array<{ lastName: string; heelHeightCm: number }>) {
      map.set(row.lastName.toUpperCase(), row.heelHeightCm);
    }
    return map;
  }, [heelHeightData]);
  const HEEL_HEIGHT_CATEGORIES = new Set(["Dress Shoe", "Dress Sandal", "Wedge"]);

  // Build colour code lookup map (UPPERCASE description → code)
  const colourCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of colourCodeList as Array<{ colourDescription: string; colourCode: string }>) {
      map.set(row.colourDescription.toUpperCase(), row.colourCode);
    }
    return map;
  }, [colourCodeList]);

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

  // ── AP21 CSV generator (101836 BxB format) ────────────────────────────────
  const generateAP21CsvRows = useCallback((codeMap: Map<string, string>): string[][] => {
    type RawSku = { style: string; colour: string; leather: string; is_new: boolean };
    const rawSkus = mergedRawSkus as unknown as RawSku[];

    // Determine which styles to export
    const stylesToExport = ap21Style === "ALL"
      ? (mergedStyles as any[]).filter((s: any) => !cancelledStyleSet.has(s.style)).map((s: any) => s.style)
      : [ap21Style];

    const csvRows: string[][] = [];
    csvRows.push(AP21_HEADERS);

    for (const styleName of stylesToExport) {
      // Get all active (non-cancelled) SKUs for this style
      const allStyleSkus = rawSkus.filter(
        (r) =>
          r.style === styleName &&
          !cancelledSkuSet.has(`${r.style}|${r.colour}|${r.leather}`)
      );
      if (allStyleSkus.length === 0) continue;

      const productCode = styleName.toUpperCase();
      const productDesc = toTitleCase(styleName);

      // ── Style-level row (Style Level = 0) ──────────────────────────────
      // Product Code + Product Description only; colour/size fields blank
      const styleRow: string[] = [
        productCode,  // Product Code
        productDesc,  // Product Description
        "",           // Colour Code (blank at style level)
        "",           // Colour Description (blank at style level)
        "",           // Size Range (blank)
        "",           // Size Code (blank)
        "",           // EAN Code
        "",           // Sell Price (leave blank)
        "Y",          // Purchased
        "N",          // Produced
        "Y",          // Sold
        "Y",          // Stocked
        "N",          // Used In Production
        "N",          // Include in MRP
        "Y",          // Sold at Retail
        ...Array(20).fill(""), // Ref1-Ref20
        ...Array(10).fill(""), // ColourRef1-ColourRef10
        "",           // Cost (leave blank)
        "",           // Dimension Range
        "",           // Dimension Code
        "0",          // Style Level = 0 (style row)
        "Each",       // UOM
      ];
      csvRows.push(styleRow);

      // Collect unique colour/leather combos, sorted alphabetically
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
        // Build the colour description (UPPERCASE, as stored in colour_codes table)
        const colourDesc = leather ? `${colour} ${leather}` : colour;
        const colourDescUpper = colourDesc.toUpperCase();

        // Look up the colour code from the map
        const colourCode = codeMap.get(colourDescUpper) ?? "";

        // Determine if this colour has size 11
        const skuMeta = skuMetaMap[`${styleName}|${colour}|${leather}`];
        const hasSize11 = skuMeta?.isSize11 === true;
        const sizeRange = hasSize11 ? AP21_SIZE_RANGE_WITH_PACK : AP21_SIZE_RANGE;
        const sizes = hasSize11 ? AP21_SIZES_WITH_PACK : AP21_SIZES;

        // ── Colour-level row (Style Level = 1) ─────────────────────────
        const colourRow: string[] = [
          productCode,    // Product Code
          productDesc,    // Product Description
          colourCode,     // Colour Code (from DB)
          colourDesc,     // Colour Description (e.g. "Black Suede")
          "",             // Size Range (blank at colour level)
          "",             // Size Code (blank)
          "",             // EAN Code
          "",             // Sell Price
          "Y",            // Purchased
          "N",            // Produced
          "Y",            // Sold
          "Y",            // Stocked
          "N",            // Used In Production
          "N",            // Include in MRP
          "Y",            // Sold at Retail
          ...Array(20).fill(""), // Ref1-Ref20
          ...Array(10).fill(""), // ColourRef1-ColourRef10
          "",             // Cost (leave blank)
          "",             // Dimension Range
          "",             // Dimension Code
          "1",            // Style Level = 1 (colour row)
          "",             // UOM
        ];
        csvRows.push(colourRow);

        // ── Size rows (Style Level = 2) ─────────────────────────────────
        for (const sizeCode of sizes) {
          const sizeRow: string[] = [
            productCode,    // Product Code
            productDesc,    // Product Description
            colourCode,     // Colour Code
            colourDesc,     // Colour Description
            sizeRange,      // Size Range (e.g. AU5-11)
            sizeCode,       // Size Code (individual size)
            "",             // EAN Code
            "",             // Sell Price
            "Y",            // Purchased
            "N",            // Produced
            "Y",            // Sold
            "Y",            // Stocked
            "N",            // Used In Production
            "N",            // Include in MRP
            "Y",            // Sold at Retail
            ...Array(20).fill(""), // Ref1-Ref20
            ...Array(10).fill(""), // ColourRef1-ColourRef10
            "",             // Cost (leave blank)
            "",             // Dimension Range
            "",             // Dimension Code
            "2",            // Style Level = 2 (size row)
            "",             // UOM
          ];
          csvRows.push(sizeRow);
        }
      }
    }

    return csvRows;
  }, [mergedRawSkus, mergedStyles, ap21Style, cancelledStyleSet, cancelledSkuSet, skuMetaMap]);

  function downloadCsvRows(csvRows: string[][], suffix: string) {
    const csvContent = csvRows
      .map((row) =>
        row.map((cell) => {
          const s = String(cell ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        }).join(",")
      )
      .join("\r\n");

    const filename = `AP21_products_${suffix}_${Date.now()}.csv`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return filename;
  }

  async function exportAP21Csv() {
    setExporting("ap21");
    try {
      type RawSku = { style: string; colour: string; leather: string; is_new: boolean };
      const rawSkus = mergedRawSkus as unknown as RawSku[];

      // Determine which styles to export
      const stylesToExport = ap21Style === "ALL"
        ? (mergedStyles as any[]).filter((s: any) => !cancelledStyleSet.has(s.style)).map((s: any) => s.style)
        : [ap21Style];

      // Collect all unique colour descriptions needed
      const neededDescriptions = new Set<string>();
      for (const styleName of stylesToExport) {
        const styleSkus = rawSkus.filter(
          (r) =>
            r.style === styleName &&
            !cancelledSkuSet.has(`${r.style}|${r.colour}|${r.leather}`)
        );
        for (const sku of styleSkus) {
          const colourDesc = sku.leather ? `${sku.colour} ${sku.leather}` : sku.colour;
          neededDescriptions.add(colourDesc.toUpperCase());
        }
      }

      // Check which descriptions are missing from the colour code map
      const missing = Array.from(neededDescriptions).filter(
        (d) => !colourCodeMap.has(d)
      );

      if (missing.length > 0) {
        // Show the missing colour code modal
        setMissingColourDescriptions(missing);
        setPendingExportCallback(() => () => {
          // After codes are saved, re-fetch and then generate
          utils.colourCode.getAll.invalidate().then(() => {
            // The colourCodeList will update via React Query; we need to re-run
            // with the fresh data. We use a small timeout to let the query update.
            setTimeout(() => {
              doExportWithFreshCodes();
            }, 500);
          });
        });
        setShowColourCodeModal(true);
        setExporting(null);
        return;
      }

      // All codes present — generate and download
      doExportWithCurrentCodes();
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate AP21 CSV");
      setExporting(null);
    }
  }

  function doExportWithCurrentCodes() {
    try {
      const csvRows = generateAP21CsvRows(colourCodeMap);
      const suffix = ap21Style === "ALL" ? "all" : ap21Style.toLowerCase();
      const filename = downloadCsvRows(csvRows, suffix);
      const rowCount = csvRows.length - 1; // exclude header
      toast.success(`AP21 CSV exported: ${filename} (${rowCount} rows)`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate AP21 CSV");
    } finally {
      setExporting(null);
    }
  }

  async function doExportWithFreshCodes() {
    setExporting("ap21");
    try {
      // Re-fetch the latest colour codes
      const freshCodes = await utils.colourCode.getAll.fetch();
      const freshMap = new Map<string, string>();
      for (const row of freshCodes as Array<{ colourDescription: string; colourCode: string }>) {
        freshMap.set(row.colourDescription.toUpperCase(), row.colourCode);
      }
      const csvRows = generateAP21CsvRows(freshMap);
      const suffix = ap21Style === "ALL" ? "all" : ap21Style.toLowerCase();
      const filename = downloadCsvRows(csvRows, suffix);
      const rowCount = csvRows.length - 1;
      toast.success(`AP21 CSV exported: ${filename} (${rowCount} rows)`);
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
                  Generates a 101836 BxB product import CSV. AU sizes 5–11 + PACK. Colour codes from DB with AI suggestion for new colours.
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

    {showColourCodeModal && (
      <AP21ColourCodeModal
        missingDescriptions={missingColourDescriptions}
        onConfirm={() => {
          setShowColourCodeModal(false);
          if (pendingExportCallback) {
            pendingExportCallback();
            setPendingExportCallback(null);
          }
        }}
        onCancel={() => {
          setShowColourCodeModal(false);
          setPendingExportCallback(null);
        }}
      />
    )}
    </>
  );
}
