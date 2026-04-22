/**
 * ExportPanel — exports for fitting notes and buy sheet
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { FileDown, X, FileSpreadsheet, ClipboardList, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Props {
  onClose: () => void;
}

export default function ExportPanel({ onClose }: Props) {
  const [exporting, setExporting] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: skuMetaList = [] } = trpc.sku.getAll.useQuery();
  const { data: styleMetaList = [] } = trpc.style.getAll.useQuery();
  const { data: allSessions = [] } = trpc.buy.getSessions.useQuery();
  const { data: customSkuList = [] } = trpc.customSku.getAll.useQuery();
  const { data: cancelledSkuList = [] } = trpc.cancelledSku.list.useQuery();

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
    const styleNames = skuData.styles.map((s) => s.style);
    fetchRrpMutation.mutate({ styleNames });
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

  // Style lookup for category/last
  const styleLookup: Record<string, { category: string; last: string }> = {};
  for (const s of skuData.styles) {
    styleLookup[s.style] = { category: s.category, last: s.last };
  }

  function exportFittingNotes() {
    setExporting("fitting");
    try {
      const rows = skuData.rawSkus
        .map((sku) => {
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
            "Sample Status": meta?.sampleStatus ?? "waiting",
            "Fit Rating": meta?.fitRating
              ? { tts: "True to Size", runs_small: "Runs Small", runs_large: "Runs Large" }[meta.fitRating] ?? meta.fitRating
              : "",
            "Fitting Notes": meta?.fittingNotes ?? "",
            "Cost Price": meta?.costPrice != null ? meta.costPrice : "",
            RRP: styleMetaMap[sku.style]?.rrp != null ? styleMetaMap[sku.style].rrp : "",
          };
        })
        .filter((r) => r["Fitting Notes"] || r["Fit Rating"] || r["Sample Status"] === "received");

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

      // Merge custom SKUs with static SKUs
      const customSkus = customSkuList as Array<{ style: string; colour: string; leather: string }>;
      type SkuRow = { style: string; colour: string; leather: string; is_new: boolean };
      const allSkus: SkuRow[] = [
        ...skuData.rawSkus.map((s) => ({ style: s.style, colour: s.colour, leather: s.leather, is_new: s.is_new })),
        ...customSkus.map((c) => ({ style: c.style, colour: c.colour, leather: c.leather, is_new: true })),
      ].filter((s) => !cancelledSkuSet.has(`${s.style}|${s.colour}|${s.leather}`));

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
            return {
              Category: styleLookup[sku.style]?.category ?? "",
              Style: sku.style,
              Colour: sku.colour,
              Leather: sku.leather,
              "AU Units": item.auQty,
              "USA Units": item.usaQty,
            };
          })
          .filter(Boolean) as Array<{ Category: string; Style: string; Colour: string; Leather: string; "AU Units": number; "USA Units": number }>;

        if (rows.length > 0) {
          const ws = XLSX.utils.json_to_sheet(rows);
          ws["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
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
      const rows = skuData.rawSkus.map((sku) => {
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
          "Sample Status": meta?.sampleStatus ?? "waiting",
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
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-[480px] max-w-full mx-4 rounded-2xl shadow-2xl bg-card overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-display font-bold text-lg text-foreground">Export Data</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
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

        <div className="flex justify-end px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
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
  );
}
