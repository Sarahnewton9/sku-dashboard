/**
 * ExportPanel — exports for fitting notes and buy sheet
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { FileDown, X, FileSpreadsheet, ClipboardList, RefreshCw, Upload, FileText } from "lucide-react";
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

export default function ExportPanel({ onClose }: Props) {
  const { mergedRawSkus, mergedStyles } = useCustomSkus();
  const [exporting, setExporting] = useState<string | null>(null);
  const [ap21Style, setAp21Style] = useState<string>("ALL");
  const [showPptxSync, setShowPptxSync] = useState(false);
  const utils = trpc.useUtils();

  const { data: skuMetaList = [] } = trpc.sku.getAll.useQuery();
  const { data: styleMetaList = [] } = trpc.style.getAll.useQuery();
  const { data: allSessions = [] } = trpc.buy.getSessions.useQuery();
  const { data: customSkuList = [] } = trpc.customSku.getAll.useQuery();
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

  const fetchRrpMutation = trpc.style.fetchFromTonyBianco.useMutation({
    onSuccess: (data) => {
      utils.style.getAll.invalidate();
      toast.success(`Fetched RRPs for ${data.updated} styles from Tony Bianco AU (${data.totalProducts} products scanned)`);
    },
    onError: (err) => {
      toast.error(`Failed to fetch RRPs: ${err.message}`);
    },
  });

  function handleFetchRrp() {
    const styleNames = (mergedStyles as any[]).map((s: any) => s.style);
    fetchRrpMutation.mutate({ styleNames });
  }

  const fetchImagesMutation = trpc.style.fetchImages.useMutation({
    onSuccess: (data) => {
      utils.style.getAll.invalidate();
      toast.success(`Fetched images for ${data.updated}/${data.total} styles from Tony Bianco AU`);
    },
    onError: (err) => {
      toast.error(`Failed to fetch style images: ${err.message}`);
    },
  });

  // Style image selector state
  const [imageSelectMode, setImageSelectMode] = useState<"all" | "select">("all");
  const [imageStyleSearch, setImageStyleSearch] = useState("");
  const [imageSelectedStyles, setImageSelectedStyles] = useState<Set<string>>(new Set());

  const allStyleNames = useMemo(() => (mergedStyles as any[]).map((s: any) => s.style).sort(), [mergedStyles]);
  const filteredStyleNames = useMemo(() =>
    allStyleNames.filter((s) => s.toLowerCase().includes(imageStyleSearch.toLowerCase())),
    [allStyleNames, imageStyleSearch]
  );

  function toggleImageStyle(style: string) {
    setImageSelectedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(style)) next.delete(style); else next.add(style);
      return next;
    });
  }

  function handleFetchImages() {
    const styleNames = imageSelectMode === "all"
      ? (mergedStyles as any[]).map((s: any) => s.style)
      : Array.from(imageSelectedStyles);
    if (styleNames.length === 0) { toast.error("No styles selected."); return; }
    fetchImagesMutation.mutate({ styleNames });
  }

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

  function exportFittingNotes() {
    setExporting("fitting");
    try {
      const rows = (mergedRawSkus as any[])
        .map((sku: any) => {
          const key = `${sku.style}|${sku.colour}|${sku.leather}` as string;
          const meta = skuMetaMap[key];
          return {
            Style: sku.style,
            Category: styleLookup[sku.style]?.category ?? "",
            Last: styleLookup[sku.style]?.last ?? "",
            Colour: sku.colour,
            Leather: sku.leather,
            Status: sku.is_new ? "New" : "Existing",
            "Size 11": meta?.isSize11 ? "Yes" : "No",
            "Sample Status": meta?.sampleStatus === "received" ? "Received" : "Waiting",
            "Fit Rating": meta?.fitRating
              ? { tts: "True to Size", runs_small: "Runs Small", runs_large: "Runs Large" }[meta.fitRating] ?? meta.fitRating
              : "",
            "Fitting Notes": meta?.fittingNotes ?? "",
            "Cost Price": meta?.costPrice != null ? meta.costPrice : "",
            RRP: styleMetaMap[sku.style]?.rrp != null ? styleMetaMap[sku.style].rrp : "",
          };
        })
        .filter((r: any) => r["Fitting Notes"] || r["Fit Rating"] || r["Sample Status"] === "received");

      if (rows.length === 0) {
        toast.info("No fitting notes or sample data to export yet.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 },
        { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 12 }, { wch: 10 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Fitting Notes");
      XLSX.writeFile(wb, "SS26_Fitting_Notes.xlsx");
      toast.success(`Exported ${rows.length} SKUs with fitting data`);
    } finally {
      setExporting(null);
    }
  }

  async function exportBuySheet() {
    setExporting("buy");
    try {
      // Build cancelled SKU set
      const cancelledSkuSet = new Set<string>();
      for (const c of cancelledSkuList as Array<{ style: string; colour: string; leather: string }>) {
        cancelledSkuSet.add(`${c.style}|${c.colour}|${c.leather}`);
      }

      // Use mergedRawSkus which already includes custom SKUs
      type SkuRow = { style: string; colour: string; leather: string; is_new: boolean };
      const allSkus: SkuRow[] = (mergedRawSkus as unknown as SkuRow[])
        .filter((s) => !cancelledSkuSet.has(`${s.style}|${s.colour}|${s.leather}`));

      // Fetch items for all sessions
      const wb = XLSX.utils.book_new();
      let totalRows = 0;

      for (const session of allSessions as Array<{ id: number; name: string }>) {
        // Fetch items for this session
        const items = await fetch(`/api/trpc/buy.getItems?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { sessionId: session.id } } }))}`);
        const itemsJson = await items.json();
        const sessionItems: Array<{ style: string; colour: string; leather: string; auQty: number; usaQty: number }> =
          itemsJson?.[0]?.result?.data?.json ?? [];

        const itemMap: Record<string, { auQty: number; usaQty: number }> = {};
        for (const item of sessionItems) {
          itemMap[`${item.style}|${item.colour}|${item.leather}`] = { auQty: item.auQty ?? 0, usaQty: item.usaQty ?? 0 };
        }

        const rows = allSkus
          .map((sku) => {
            const key = `${sku.style}|${sku.colour}|${sku.leather}`;
            const item = itemMap[key];
            if (!item || (item.auQty === 0 && item.usaQty === 0)) return null;
            const skuKey = `${sku.style}|${sku.colour}|${sku.leather}`;
            const skuMeta = skuMetaMap[skuKey];
            return {
              Category: styleLookup[sku.style]?.category ?? "",
              Style: sku.style,
              Colour: sku.colour,
              Leather: sku.leather,
              "Size 11": skuMeta?.isSize11 ? "Yes" : "No",
              "AU Units": item.auQty,
              "USA Units": item.usaQty,
            };
          })
          .filter(Boolean) as Array<{ Category: string; Style: string; Colour: string; Leather: string; "Size 11": string; "AU Units": number; "USA Units": number }>;

        if (rows.length > 0) {
          const ws = XLSX.utils.json_to_sheet(rows);
          ws["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
          const sheetName = session.name.slice(0, 31); // Excel sheet name limit
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
          totalRows += rows.length;
        }
      }

      if (totalRows === 0) {
        toast.info("No buy quantities set yet. Add AU/USA quantities in the By Style tab.");
        return;
      }

      XLSX.writeFile(wb, "SS26_Buy_Sheet.xlsx");
      toast.success(`Exported buy sheet with ${totalRows} SKUs across ${allSessions.length} sessions`);
    } finally {
      setExporting(null);
    }
  }

  function exportFullData() {
    setExporting("full");
    try {
      const rows = (mergedRawSkus as any[]).map((sku: any) => {
        const key = `${sku.style}|${sku.colour}|${sku.leather}` as string;
        const meta = skuMetaMap[key];
        const lastName = (styleLookup[sku.style]?.last ?? "").toUpperCase();
        const category = styleLookup[sku.style]?.category ?? "";
        const isHeelCategory = HEEL_HEIGHT_CATEGORIES.has(category);
        const heelHeight = isHeelCategory ? (heelHeightMap.get(lastName) ?? "") : "";
        return {
          Style: sku.style,
          Category: category,
          Last: styleLookup[sku.style]?.last ?? "",
          "Heel Height (cm)": heelHeight,
          Colour: sku.colour,
          Leather: sku.leather,
          Status: sku.is_new ? "New" : "Existing",
          "Size 11": meta?.isSize11 ? "Yes" : "No",
          "Sample Status": meta?.sampleStatus === "received" ? "Received" : "Waiting",
          "Order Qty": meta?.orderQty ?? 0,
          "Cost Price": meta?.costPrice != null ? meta.costPrice : "",
          RRP: styleMetaMap[sku.style]?.rrp != null ? styleMetaMap[sku.style].rrp : "",
          "Fit Rating": meta?.fitRating
            ? { tts: "True to Size", runs_small: "Runs Small", runs_large: "Runs Large" }[meta.fitRating] ?? meta.fitRating
            : "",
          "Fitting Notes": meta?.fittingNotes ?? "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 },
        { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 40 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Full SKU Data");
      XLSX.writeFile(wb, "SS26_Full_Export.xlsx");
      toast.success(`Exported all ${rows.length} SKUs`);
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

          {/* Fitting Notes Export */}
          <button
            onClick={exportFittingNotes}
            disabled={exporting !== null}
            className="w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all hover:bg-muted/30 disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.96 0.08 65)" }}>
              <ClipboardList className="w-5 h-5" style={{ color: "oklch(0.50 0.14 55)" }} />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Fitting Notes Export</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                SKUs with fitting notes, fit rating, or received samples. For sharing with factory.
              </p>
            </div>
            {exporting === "fitting" && <span className="ml-auto text-xs text-muted-foreground">Exporting…</span>}
          </button>

          {/* Buy Sheet Export */}
          <button
            onClick={exportBuySheet}
            disabled={exporting !== null}
            className="w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all hover:bg-muted/30 disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.94 0.08 155)" }}>
              <FileSpreadsheet className="w-5 h-5" style={{ color: "oklch(0.40 0.14 155)" }} />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Buy Sheet Export</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only SKUs with order qty &gt; 0. Includes style, colour, leather, category, last, qty, cost, RRP.
              </p>
            </div>
            {exporting === "buy" && <span className="ml-auto text-xs text-muted-foreground">Exporting…</span>}
          </button>

          {/* Fetch RRP from Tony Bianco */}
          <button
            onClick={handleFetchRrp}
            disabled={exporting !== null || fetchRrpMutation.isPending}
            className="w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all hover:bg-muted/30 disabled:opacity-50"
            style={{ borderColor: "oklch(0.80 0.10 240)", background: "oklch(0.97 0.02 240)" }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.92 0.06 240)" }}>
              <RefreshCw className={`w-5 h-5 ${fetchRrpMutation.isPending ? "animate-spin" : ""}`} style={{ color: "oklch(0.40 0.14 240)" }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">Fetch RRP from Tony Bianco AU</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pulls current AU prices from tonybianco.com.au and auto-matches to your styles. Takes ~10 seconds.
              </p>
            </div>
            {fetchRrpMutation.isPending && <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">Fetching…</span>}
          </button>

          {/* Fetch Style Images from Tony Bianco */}
          <div
            className="w-full rounded-xl border overflow-hidden"
            style={{ borderColor: "oklch(0.80 0.10 150)", background: "oklch(0.97 0.02 150)" }}
          >
            {/* Header row */}
            <div className="flex items-start gap-4 p-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.92 0.06 150)" }}>
                <RefreshCw className={`w-5 h-5 ${fetchImagesMutation.isPending ? "animate-spin" : ""}`} style={{ color: "oklch(0.40 0.14 150)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">Fetch Style Images from Tony Bianco AU</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pulls one representative product image per style. Only carry-over styles will be found.
                </p>
                {/* All / Select toggle */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => setImageSelectMode("all")}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                      imageSelectMode === "all"
                        ? "text-white border-transparent"
                        : "bg-transparent text-muted-foreground hover:bg-muted/40"
                    }`}
                    style={imageSelectMode === "all" ? { background: "oklch(0.55 0.14 150)", borderColor: "oklch(0.55 0.14 150)" } : { borderColor: "oklch(0.80 0.10 150)" }}
                  >
                    All Styles ({allStyleNames.length})
                  </button>
                  <button
                    onClick={() => setImageSelectMode("select")}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                      imageSelectMode === "select"
                        ? "text-white border-transparent"
                        : "bg-transparent text-muted-foreground hover:bg-muted/40"
                    }`}
                    style={imageSelectMode === "select" ? { background: "oklch(0.55 0.14 150)", borderColor: "oklch(0.55 0.14 150)" } : { borderColor: "oklch(0.80 0.10 150)" }}
                  >
                    Select Styles{imageSelectMode === "select" && imageSelectedStyles.size > 0 ? ` (${imageSelectedStyles.size})` : ""}
                  </button>
                </div>
              </div>
            </div>

            {/* Style selector — shown only in select mode */}
            {imageSelectMode === "select" && (
              <div className="px-4 pb-3 border-t" style={{ borderColor: "oklch(0.88 0.06 150)" }}>
                <div className="flex items-center gap-2 mt-3 mb-2">
                  <input
                    type="text"
                    placeholder="Search styles…"
                    value={imageStyleSearch}
                    onChange={(e) => setImageStyleSearch(e.target.value)}
                    className="flex-1 text-xs rounded-md border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 text-foreground"
                    style={{ borderColor: "oklch(0.80 0.10 150)" }}
                  />
                  <button
                    onClick={() => setImageSelectedStyles(new Set(filteredStyleNames))}
                    className="text-xs px-2 py-1.5 rounded border font-medium hover:bg-muted/30 transition-colors"
                    style={{ borderColor: "oklch(0.80 0.10 150)", color: "oklch(0.40 0.14 150)" }}
                  >Select all</button>
                  <button
                    onClick={() => setImageSelectedStyles(new Set())}
                    className="text-xs px-2 py-1.5 rounded border font-medium hover:bg-muted/30 transition-colors"
                    style={{ borderColor: "oklch(0.80 0.10 150)", color: "oklch(0.40 0.14 150)" }}
                  >Clear</button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border" style={{ borderColor: "oklch(0.88 0.06 150)" }}>
                  {filteredStyleNames.map((style) => (
                    <label
                      key={style}
                      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/20 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={imageSelectedStyles.has(style)}
                        onChange={() => toggleImageStyle(style)}
                        className="accent-green-600 w-3.5 h-3.5"
                      />
                      <span className="text-xs font-medium text-foreground">{style}</span>
                    </label>
                  ))}
                  {filteredStyleNames.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-3">No styles match.</p>
                  )}
                </div>
              </div>
            )}

            {/* Fetch button */}
            <div className="px-4 pb-4 pt-2">
              <button
                onClick={handleFetchImages}
                disabled={exporting !== null || fetchImagesMutation.isPending || (imageSelectMode === "select" && imageSelectedStyles.size === 0)}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: "oklch(0.55 0.14 150)" }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fetchImagesMutation.isPending ? "animate-spin" : ""}`} />
                {fetchImagesMutation.isPending
                  ? "Fetching…"
                  : imageSelectMode === "all"
                    ? `Fetch All ${allStyleNames.length} Styles`
                    : `Fetch ${imageSelectedStyles.size} Selected Style${imageSelectedStyles.size !== 1 ? "s" : ""}`
                }
              </button>
            </div>
          </div>

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
          <button
            onClick={exportFullData}
            disabled={exporting !== null}
            className="w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all hover:bg-muted/30 disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--muted)" }}>
              <FileDown className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Full Data Export</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                All 1,018 SKUs with all fields including size 11, sample status, cost, RRP, fit notes.
              </p>
            </div>
            {exporting === "full" && <span className="ml-auto text-xs text-muted-foreground">Exporting…</span>}
          </button>
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
