/**
 * SeasonAnalysisTab
 *
 * Lets the user upload a "Total Season" Excel file (SEASON BY SKU sheet).
 * Analyses the data against the current SS26 range to surface:
 *   1. Hot Sellers — existing styles with strong sales / sell-through that have no new SKUs this season
 *   2. Colour Insights — colours with high sell-through that should be used more
 *   3. SKU Coverage — carry-over SKUs with last-season units + sell-thru alongside new-range coverage
 */

import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Trash2, TrendingUp, Palette, BarChart2, AlertCircle, ChevronDown, ChevronUp, Loader2
} from "lucide-react";
import { toast } from "sonner";

// ─── Leather derivation ──────────────────────────────────────────────────────
// The "Colour Description" in the Total Season file is "COLOUR LEATHER" (e.g. "Black Vintage")
// We derive leather by matching known leather names from the end of the description.
const KNOWN_LEATHERS = [
  "NAPPA PATENT", "NAPPA METALLIC", "VINTAGE METAL", "HI SHINE",
  "NAPPA", "SUEDE", "PATENT", "VINTAGE", "CRINKLE", "VENICE", "NUBUCK",
  "CAPRETTO", "COMO", "SNAKE", "CROCO", "SPECKLE", "BROCADE", "MESH",
  "WOVEN", "BRAID", "VELVET", "LUMIA VELVET", "SHINE", "KID",
  "VINYLITE", "VALENCIA", "WEAVE",
];

function deriveLeatherAndColour(colourDescription: string): { colour: string; leather: string } {
  const upper = colourDescription.toUpperCase().trim();
  // Try to match known leathers from the end of the string
  for (const leather of KNOWN_LEATHERS) {
    if (upper.endsWith(" " + leather)) {
      const colour = upper.slice(0, upper.length - leather.length - 1).trim();
      return { colour, leather };
    }
    if (upper === leather) {
      return { colour: "", leather };
    }
  }
  // Fallback: last word is leather
  const parts = upper.split(" ");
  if (parts.length > 1) {
    return { colour: parts.slice(0, -1).join(" "), leather: parts[parts.length - 1] };
  }
  return { colour: upper, leather: "" };
}

// ─── Excel parser ─────────────────────────────────────────────────────────────
interface ParsedRow {
  style: string;
  colour: string;
  leather: string;
  colourDescription: string;
  subCategory: string | null;
  auOrigPrice: number | null;
  totalUnitsSold: number;
  lastWeekUnits: number;
  lastWeekSellThru: number;
  avgWeeklySellThru: number;
  stdSellThru: number | null;
  totalSoh: number;
}

function parseSeasonExcel(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes("SEASON BY SKU")) ?? wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

        // Find header row (row 4 in 1-indexed = index 3)
        // Row 2 has week labels, row 4 has column headers
        const headerRow = (raw[3] ?? []) as (string | null)[];
        const dataRows = raw.slice(4);

        // Column indices (0-based)
        const styleCol = 3;   // "Product Code"
        const colourCol = 4;  // "Colour Description"
        const subCatCol = 2;  // "Sub Category"
        const auOrigCol = 5;  // "AU Orig. Price"
        const totalUnitsCol = 101; // "Total Units Sold" (col 102 in 1-indexed)
        const stdSellThruCol = 103; // "STD Sell Thru" (col 104)
        const lWeekSellThruCol = 104; // "L/Week Sell Thru" (col 105)
        const totalSohCol = 108; // "Total SOH" (col 109)

        // Find the last week's "Units Sold" column dynamically
        // Week columns repeat as groups of 3: Units Sold, MD Price, Weekly Sell Thru
        // First week starts at col 9 (0-indexed)
        // Find the last non-null week header in row 2 (index 1)
        const weekRow = (raw[1] ?? []) as (string | null)[];
        let lastWeekUnitCol = 9; // default to first week
        let lastWeekSellThruColDynamic = 11;
        for (let i = weekRow.length - 1; i >= 9; i--) {
          if (weekRow[i] && String(weekRow[i]).toUpperCase().includes("WEEK")) {
            lastWeekUnitCol = i;
            lastWeekSellThruColDynamic = i + 2;
            break;
          }
        }

        void headerRow; // used for documentation only
        const rows: ParsedRow[] = [];
        for (const row of dataRows) {
          const r = row as unknown[];
          const style = r[styleCol];
          const colourDesc = r[colourCol];
          if (!style || !colourDesc || typeof style !== "string" || typeof colourDesc !== "string") continue;
          if (!style.trim() || !colourDesc.trim()) continue;

          const { colour, leather } = deriveLeatherAndColour(colourDesc);
          const totalUnits = Number(r[totalUnitsCol]) || 0;
          const lastWeekUnits = Number(r[lastWeekUnitCol]) || 0;
          const lastWeekSellThru = Number(r[lastWeekSellThruColDynamic]) || 0;
          const stdSellThru = r[stdSellThruCol] != null ? Number(r[stdSellThruCol]) : null;
          const avgWeeklySellThru = stdSellThru ?? lastWeekSellThru;
          const totalSoh = Number(r[totalSohCol]) || 0;
          const auOrigPrice = r[auOrigCol] != null ? Number(r[auOrigCol]) : null;
          const subCategory = r[subCatCol] != null ? String(r[subCatCol]) : null;

          rows.push({
            style: style.trim().toUpperCase(),
            colour,
            leather,
            colourDescription: colourDesc.trim(),
            subCategory,
            auOrigPrice: auOrigPrice && auOrigPrice > 0 ? auOrigPrice : null,
            totalUnitsSold: totalUnits,
            lastWeekUnits,
            lastWeekSellThru,
            avgWeeklySellThru,
            stdSellThru,
            totalSoh,
          });
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function SellThruBadge({ value }: { value: number }) {
  const pctVal = Math.round(value * 100);
  const color =
    pctVal >= 60 ? "oklch(0.40 0.14 155)" :
    pctVal >= 35 ? "oklch(0.55 0.14 55)" :
    "oklch(0.52 0.012 60)";
  return (
    <span className="tabular-nums font-semibold text-sm" style={{ color }}>
      {pctVal}%
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SeasonAnalysisTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null);
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());

  const { data: imports = [], refetch: refetchImports } = trpc.season.getAll.useQuery();
  const { data: seasonRows = [] } = trpc.season.getData.useQuery(
    { importId: selectedImportId! },
    { enabled: selectedImportId != null }
  );
  const importMutation = trpc.season.import.useMutation();
  const deleteMutation = trpc.season.delete.useMutation();

  const { mergedRawSkus } = useCustomSkus();

  // Auto-select latest import
  const latestImport = imports.length > 0 ? imports[imports.length - 1] : null;
  const activeImportId = selectedImportId ?? latestImport?.id ?? null;

  // Build lookup of current range: style -> { newSkus, existingSkus, allSkus }
  const rangeByStyle = useMemo(() => {
    const map: Record<string, { newSkus: number; existingSkus: number; colours: string[] }> = {};
    for (const sku of (mergedRawSkus as any[])) {
      if (!map[sku.style]) map[sku.style] = { newSkus: 0, existingSkus: 0, colours: [] };
      if (sku.is_new) map[sku.style].newSkus++;
      else map[sku.style].existingSkus++;
      if (!map[sku.style].colours.includes(sku.colour)) map[sku.style].colours.push(sku.colour);
    }
    return map;
  }, [mergedRawSkus]);

  // Build lookup of current range colours (for colour insights)
  const rangeColours = useMemo(() => {
    const set = new Set<string>();
    for (const sku of (mergedRawSkus as any[])) set.add((sku.colour as string).toUpperCase());
    return set;
  }, [mergedRawSkus]);

  // ─── Analysis computations ───────────────────────────────────────────────
  const analysis = useMemo(() => {
    if (!seasonRows.length) return null;

    // Group by style
    const byStyle: Record<string, typeof seasonRows> = {};
    for (const row of seasonRows) {
      if (!byStyle[row.style]) byStyle[row.style] = [];
      byStyle[row.style].push(row);
    }

    // Hot Sellers: existing styles with high total units sold that have no new SKUs in this season's range
    const hotSellers = Object.entries(byStyle)
      .map(([style, rows]) => {
        const totalUnits = rows.reduce((s, r) => s + r.totalUnitsSold, 0);
        const avgSellThru = rows.length > 0
          ? rows.reduce((s, r) => s + r.avgWeeklySellThru, 0) / rows.length
          : 0;
        const rangeInfo = rangeByStyle[style];
        const newSkusThisSeason = rangeInfo?.newSkus ?? 0;
        const existingSkusThisSeason = rangeInfo?.existingSkus ?? 0;
        const isInRange = !!rangeInfo;
        return { style, totalUnits, avgSellThru, newSkusThisSeason, existingSkusThisSeason, isInRange, skuCount: rows.length };
      })
      .filter(s => s.totalUnits > 30 && s.newSkusThisSeason === 0 && s.isInRange)
      .sort((a, b) => b.totalUnits - a.totalUnits)
      .slice(0, 20);

    // Colour Insights: colours with high avg sell-through across all SKUs
    const byColour: Record<string, { sellThrus: number[]; styles: Set<string>; totalUnits: number }> = {};
    for (const row of seasonRows) {
      const col = row.colour.toUpperCase();
      if (!byColour[col]) byColour[col] = { sellThrus: [], styles: new Set(), totalUnits: 0 };
      byColour[col].sellThrus.push(row.avgWeeklySellThru);
      byColour[col].styles.add(row.style);
      byColour[col].totalUnits += row.totalUnitsSold;
    }

    const colourInsights = Object.entries(byColour)
      .filter(([, v]) => v.sellThrus.length >= 2 && v.totalUnits > 20)
      .map(([colour, v]) => ({
        colour,
        avgSellThru: v.sellThrus.reduce((a, b) => a + b, 0) / v.sellThrus.length,
        styleCount: v.styles.size,
        totalUnits: v.totalUnits,
        inCurrentRange: rangeColours.has(colour),
      }))
      .sort((a, b) => b.avgSellThru - a.avgSellThru)
      .slice(0, 15);

    // SKU Coverage: carry-over SKUs from last season, with new-range coverage
    const skuCoverage = Object.entries(byStyle)
      .filter(([style]) => rangeByStyle[style])
      .map(([style, rows]) => {
        const totalUnits = rows.reduce((s, r) => s + r.totalUnitsSold, 0);
        const avgSellThru = rows.length > 0
          ? rows.reduce((s, r) => s + r.avgWeeklySellThru, 0) / rows.length
          : 0;
        const rangeInfo = rangeByStyle[style];
        return {
          style,
          lastSeasonSkus: rows.length,
          totalUnits,
          avgSellThru,
          newSkusThisSeason: rangeInfo?.newSkus ?? 0,
          existingSkusThisSeason: rangeInfo?.existingSkus ?? 0,
          rows,
        };
      })
      .filter(s => s.totalUnits > 0)
      .sort((a, b) => b.totalUnits - a.totalUnits);

    return { hotSellers, colourInsights, skuCoverage };
  }, [seasonRows, rangeByStyle, rangeColours]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const label = labelInput.trim() || file.name.replace(/\.[^.]+$/, "");
    setImporting(true);
    try {
      const rows = await parseSeasonExcel(file);
      if (rows.length === 0) {
        toast.error("No data rows found. Make sure you're uploading the correct file.");
        return;
      }
      await importMutation.mutateAsync({ label, rows });
      toast.success(`Imported ${rows.length} SKUs from "${label}"`);
      setLabelInput("");
      await refetchImports();
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse or import the file. Please check the format.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this import and all its data?")) return;
    await deleteMutation.mutateAsync({ id });
    if (selectedImportId === id) setSelectedImportId(null);
    await refetchImports();
    toast.success("Import deleted");
  }

  function toggleStyle(style: string) {
    setExpandedStyles(prev => {
      const next = new Set(prev);
      if (next.has(style)) next.delete(style);
      else next.add(style);
      return next;
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Import controls */}
      <div className="rounded-xl border bg-card p-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="font-display font-semibold text-base mb-4 text-foreground">Import Total Season Report</h3>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <input
            type="text"
            value={labelInput}
            onChange={e => setLabelInput(e.target.value)}
            placeholder="Label (e.g. Week 27 upload)"
            className="flex-1 rounded-lg border px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400"
            style={{ borderColor: "var(--border)" }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="gap-2"
            style={{ background: "oklch(0.72 0.16 65)", color: "white" }}
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? "Importing…" : "Upload Excel"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Upload the <strong>GlobalTotalSeasonReport</strong> file. The "SEASON BY SKU" sheet will be parsed automatically.
        </p>

        {/* Import history */}
        {imports.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Import History</p>
            {imports.map(imp => (
              <div
                key={imp.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors"
                style={{
                  background: activeImportId === imp.id ? "oklch(0.94 0.06 65)" : "var(--muted)",
                  border: activeImportId === imp.id ? "1px solid oklch(0.80 0.12 65)" : "1px solid transparent",
                }}
                onClick={() => setSelectedImportId(imp.id)}
              >
                <BarChart2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{imp.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {imp.rowCount} SKUs · {new Date(imp.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                {activeImportId === imp.id && (
                  <Badge variant="secondary" className="text-xs">Active</Badge>
                )}
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(imp.id); }}
                  className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* No data state */}
      {imports.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center" style={{ borderColor: "var(--border)" }}>
          <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium text-foreground">No season data imported yet</p>
          <p className="text-sm text-muted-foreground mt-1">Upload a Total Season Report to see analysis</p>
        </div>
      )}

      {/* Analysis sections */}
      {analysis && (
        <>
          {/* Hot Sellers */}
          <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)", background: "oklch(0.97 0.06 65)" }}>
              <TrendingUp className="w-4 h-4" style={{ color: "oklch(0.55 0.14 55)" }} />
              <h3 className="font-display font-semibold text-base" style={{ color: "oklch(0.45 0.14 55)" }}>
                Hot Sellers — No New SKUs This Season
              </h3>
              <Badge variant="secondary" className="ml-auto">{analysis.hotSellers.length} styles</Badge>
            </div>
            <p className="px-5 py-3 text-sm text-muted-foreground border-b" style={{ borderColor: "var(--border)" }}>
              These carry-over styles sold strongly last season but have <strong>no new colourways</strong> ranged for this season. Consider adding new SKUs.
            </p>
            {analysis.hotSellers.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground text-center">All hot sellers have new SKUs ranged — great coverage!</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Style</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Last Season Units</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Avg Sell-Thru</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Existing SKUs</th>
                    <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">New SKUs</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.hotSellers.map(s => (
                    <tr key={s.style} className="border-b hover:bg-muted/40 transition-colors" style={{ borderColor: "var(--border)" }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "oklch(0.55 0.14 55)" }} />
                          <span className="font-semibold text-foreground">{s.style}</span>
                        </div>
                      </td>
                      <td className="text-right px-4 py-3 tabular-nums font-bold text-foreground">{s.totalUnits.toLocaleString()}</td>
                      <td className="text-right px-4 py-3"><SellThruBadge value={s.avgSellThru} /></td>
                      <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{s.existingSkusThisSeason}</td>
                      <td className="text-right px-5 py-3">
                        <span className="text-sm font-semibold" style={{ color: "oklch(0.55 0.14 55)" }}>0 ⚠</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Colour Insights */}
          <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)", background: "oklch(0.94 0.08 155)" }}>
              <Palette className="w-4 h-4" style={{ color: "oklch(0.40 0.14 155)" }} />
              <h3 className="font-display font-semibold text-base" style={{ color: "oklch(0.40 0.14 155)" }}>
                Colour Insights — High Sell-Through
              </h3>
              <Badge variant="secondary" className="ml-auto">{analysis.colourInsights.length} colours</Badge>
            </div>
            <p className="px-5 py-3 text-sm text-muted-foreground border-b" style={{ borderColor: "var(--border)" }}>
              Colours with the highest average sell-through last season. Green = already in this season's range.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Colour</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Avg Sell-Thru</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Total Units</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Styles</th>
                    <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">In SS26 Range</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.colourInsights.map(c => (
                    <tr key={c.colour} className="border-b hover:bg-muted/40 transition-colors" style={{ borderColor: "var(--border)" }}>
                      <td className="px-5 py-3 font-medium text-foreground">{c.colour}</td>
                      <td className="text-right px-4 py-3"><SellThruBadge value={c.avgSellThru} /></td>
                      <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{c.totalUnits.toLocaleString()}</td>
                      <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{c.styleCount}</td>
                      <td className="text-right px-5 py-3">
                        {c.inCurrentRange ? (
                          <Badge className="text-xs" style={{ background: "oklch(0.72 0.18 155)", color: "white" }}>Yes</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs text-muted-foreground">Not ranged</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SKU Coverage */}
          <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
              <BarChart2 className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-display font-semibold text-base text-foreground">SKU Coverage — Last Season vs This Season</h3>
              <Badge variant="secondary" className="ml-auto">{analysis.skuCoverage.length} styles</Badge>
            </div>
            <p className="px-5 py-3 text-sm text-muted-foreground border-b" style={{ borderColor: "var(--border)" }}>
              All styles in both last season's data and this season's range. Click a row to see individual SKU breakdown.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Style</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Last Season Units</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Avg Sell-Thru</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Existing SKUs</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">New SKUs</th>
                </tr>
              </thead>
              <tbody>
                {analysis.skuCoverage.map(s => (
                  <>
                    <tr
                      key={s.style}
                      className="border-b hover:bg-muted/40 transition-colors cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                      onClick={() => toggleStyle(s.style)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {expandedStyles.has(s.style)
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          }
                          <span className="font-semibold text-foreground">{s.style}</span>
                        </div>
                      </td>
                      <td className="text-right px-4 py-3 tabular-nums font-bold text-foreground">{s.totalUnits.toLocaleString()}</td>
                      <td className="text-right px-4 py-3"><SellThruBadge value={s.avgSellThru} /></td>
                      <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{s.existingSkusThisSeason}</td>
                      <td className="text-right px-5 py-3">
                        <span className="tabular-nums font-semibold" style={{ color: s.newSkusThisSeason > 0 ? "oklch(0.40 0.14 155)" : "var(--muted-foreground)" }}>
                          {s.newSkusThisSeason}
                        </span>
                      </td>
                    </tr>
                    {expandedStyles.has(s.style) && s.rows.map((row, i) => (
                      <tr
                        key={`${s.style}-${i}`}
                        className="border-b"
                        style={{ borderColor: "var(--border)", background: "var(--muted)" }}
                      >
                        <td className="px-5 py-2 pl-12 text-xs text-muted-foreground">
                          {row.colourDescription}
                        </td>
                        <td className="text-right px-4 py-2 tabular-nums text-xs text-foreground">{row.totalUnitsSold.toLocaleString()}</td>
                        <td className="text-right px-4 py-2 text-xs"><SellThruBadge value={row.avgWeeklySellThru} /></td>
                        <td className="text-right px-4 py-2 text-xs text-muted-foreground">—</td>
                        <td className="text-right px-5 py-2 text-xs text-muted-foreground">—</td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
