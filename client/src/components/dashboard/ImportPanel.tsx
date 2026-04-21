/**
 * ImportPanel — modal for importing cost prices and RRP from Excel
 */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Props {
  onClose: () => void;
  onImportDone: () => void;
}

type ImportMode = "cost" | "rrp";

interface CostRow { style: string; colour: string; leather: string; cost: number; }
interface RrpRow { style: string; rrp: number; }

function parseCostExcel(file: File): Promise<CostRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const result: CostRow[] = [];
        for (const row of rows) {
          // Expected columns: LAST, PHOTO, STYLE, COLOR, REMARKS, COST
          // Also handle: Style, Colour, Leather, Cost (generic format)
          const style = String(row["STYLE"] ?? row["Style"] ?? row["style"] ?? "").trim().toUpperCase();
          const colour = String(row["COLOR"] ?? row["Colour"] ?? row["colour"] ?? row["COLOUR"] ?? "").trim().toUpperCase();
          const leather = String(row["LEATHER"] ?? row["Leather"] ?? row["leather"] ?? row["REMARKS"] ?? "").trim().toUpperCase();
          const costRaw = row["COST"] ?? row["Cost"] ?? row["cost"] ?? row["UNIT PRICE"] ?? "";
          const cost = parseFloat(String(costRaw).replace(/[^0-9.]/g, ""));
          if (style && colour && !isNaN(cost) && cost > 0) {
            result.push({ style, colour, leather, cost });
          }
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function parseRrpExcel(file: File): Promise<RrpRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const result: RrpRow[] = [];
        for (const row of rows) {
          const style = String(row["STYLE"] ?? row["Style"] ?? row["style"] ?? "").trim().toUpperCase();
          const rrpRaw = row["RRP"] ?? row["Rrp"] ?? row["rrp"] ?? row["PRICE"] ?? row["Price"] ?? "";
          const rrp = parseFloat(String(rrpRaw).replace(/[^0-9.]/g, ""));
          if (style && !isNaN(rrp) && rrp > 0) {
            result.push({ style, rrp });
          }
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function ImportPanel({ onClose, onImportDone }: Props) {
  const [mode, setMode] = useState<ImportMode>("cost");
  const [preview, setPreview] = useState<(CostRow | RrpRow)[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ updated: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importCostsMutation = trpc.sku.importCosts.useMutation({
    onSuccess: (data) => { setResult(data); onImportDone(); },
    onError: (err) => toast.error(`Import failed: ${err.message}`),
  });

  const importRrpMutation = trpc.style.importRrp.useMutation({
    onSuccess: (data) => { setResult(data); onImportDone(); },
    onError: (err) => toast.error(`Import failed: ${err.message}`),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      if (mode === "cost") {
        const rows = await parseCostExcel(file);
        setPreview(rows.slice(0, 10));
        toast.success(`Parsed ${rows.length} rows from ${file.name}`);
        // Store full data for import
        (window as any).__importData = rows;
      } else {
        const rows = await parseRrpExcel(file);
        setPreview(rows.slice(0, 10));
        toast.success(`Parsed ${rows.length} rows from ${file.name}`);
        (window as any).__importData = rows;
      }
    } catch (err) {
      toast.error("Failed to parse file. Check the format.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleImport() {
    const data = (window as any).__importData;
    if (!data?.length) { toast.error("No data to import. Please upload a file first."); return; }
    setImporting(true);
    try {
      if (mode === "cost") {
        await importCostsMutation.mutateAsync(data as CostRow[]);
      } else {
        await importRrpMutation.mutateAsync(data as RrpRow[]);
      }
      toast.success(`Import complete: ${data.length} records updated`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-[560px] max-w-full mx-4 rounded-2xl shadow-2xl bg-card overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-display font-bold text-lg text-foreground">Import Data</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {[
              { id: "cost" as ImportMode, label: "Cost Prices", desc: "Factory cost per SKU" },
              { id: "rrp" as ImportMode, label: "RRP", desc: "Retail price per style" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setPreview([]); setFileName(""); setResult(null); }}
                className="flex-1 px-4 py-3 rounded-xl border text-left transition-all"
                style={{
                  borderColor: mode === m.id ? "oklch(0.72 0.16 65)" : "var(--border)",
                  background: mode === m.id ? "oklch(0.97 0.06 65)" : "transparent",
                }}
              >
                <p className="font-semibold text-sm" style={{ color: mode === m.id ? "oklch(0.50 0.14 55)" : "var(--foreground)" }}>{m.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>

          {/* Format hint */}
          <div className="rounded-lg p-3 text-xs" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
            {mode === "cost" ? (
              <p><strong>Expected columns:</strong> STYLE, COLOR (or COLOUR), COST — plus optional LEATHER/REMARKS. Extra columns are ignored.</p>
            ) : (
              <p><strong>Expected columns:</strong> STYLE, RRP (or PRICE). One row per style. Extra columns are ignored.</p>
            )}
          </div>

          {/* Upload area */}
          <div
            className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors"
            style={{ borderColor: "var(--border)" }}
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">
              {fileName ? fileName : "Click to select Excel file (.xlsx, .xls)"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Preview (first {preview.length} rows)
              </p>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--muted)" }}>
                      {mode === "cost" ? (
                        <>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Style</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Colour</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Leather</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Cost</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Style</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">RRP</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                        {mode === "cost" ? (
                          <>
                            <td className="px-3 py-1.5 font-mono">{(row as CostRow).style}</td>
                            <td className="px-3 py-1.5">{(row as CostRow).colour}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{(row as CostRow).leather || "—"}</td>
                            <td className="px-3 py-1.5 text-right font-mono">${(row as CostRow).cost.toFixed(2)}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-1.5 font-mono">{(row as RrpRow).style}</td>
                            <td className="px-3 py-1.5 text-right font-mono">${(row as RrpRow).rrp.toFixed(2)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {(window as any).__importData?.length ?? 0} total rows ready to import
              </p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg" style={{ background: "oklch(0.94 0.08 155)", color: "oklch(0.40 0.14 155)" }}>
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Import complete — {result.updated} records updated</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-muted"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Close
          </button>
          <button
            onClick={handleImport}
            disabled={importing || preview.length === 0}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "#f59e0b", color: "white" }}
          >
            {importing ? "Importing…" : `Import ${mode === "cost" ? "Cost Prices" : "RRP"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
