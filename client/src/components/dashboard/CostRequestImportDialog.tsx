import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type KnownSku = {
  style: string;
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
};

type ImportedCostRow = KnownSku & {
  cost: number | null;
  sourceRow: number;
  issue?: string;
};

const normaliseHeader = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const normaliseText = (value: unknown) => String(value ?? "").trim().toUpperCase();

function findColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.includes(header));
}

function numberFromCell(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const cleaned = String(value ?? "").replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function parseCompletedCostFile(file: File): Promise<{ rows: ImportedCostRow[]; formatError?: string }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const headerRowIndex = grid.findIndex((row) => Array.isArray(row) && row.some((cell) => normaliseHeader(cell) === "STYLE"));
  if (headerRowIndex < 0) return { rows: [], formatError: "Could not find a STYLE header in the first worksheet." };

  const headers = (grid[headerRowIndex] ?? []).map(normaliseHeader);
  const styleColumn = findColumn(headers, ["STYLE"]);
  const colourColumn = findColumn(headers, ["UPPER 1 COLOUR", "COLOUR", "COLOR"]);
  const leatherColumn = findColumn(headers, ["UPPER 1 LEATHER", "LEATHER", "REMARKS"]);
  const colour2Column = findColumn(headers, ["UPPER 2 COLOUR"]);
  const leather2Column = findColumn(headers, ["UPPER 2 LEATHER"]);
  const costColumn = findColumn(headers, ["FACTORY COST AUD", "COST AUD", "COST", "UNIT PRICE"]);
  if (styleColumn < 0 || colourColumn < 0 || costColumn < 0) {
    return { rows: [], formatError: "Use the exported cost-request workbook, or provide STYLE, COLOUR and FACTORY COST (AUD) / COST columns." };
  }

  const rows: ImportedCostRow[] = [];
  for (let index = headerRowIndex + 1; index < grid.length; index += 1) {
    const row = grid[index] ?? [];
    const style = normaliseText(row[styleColumn]);
    const colour = normaliseText(row[colourColumn]);
    if (!style && !colour) continue;
    rows.push({
      style,
      colour,
      leather: leatherColumn >= 0 ? normaliseText(row[leatherColumn]) : "",
      colour2: colour2Column >= 0 ? normaliseText(row[colour2Column]) : "",
      leather2: leather2Column >= 0 ? normaliseText(row[leather2Column]) : "",
      cost: numberFromCell(row[costColumn]),
      sourceRow: index + 1,
    });
  }
  return { rows };
}

export function CostRequestImportDialog({
  open,
  onOpenChange,
  season,
  knownSkus,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  season: string;
  knownSkus: KnownSku[];
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ImportedCostRow[]>([]);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const utils = trpc.useUtils();

  const knownSkuMap = useMemo(() => {
    const map = new Map<string, KnownSku>();
    knownSkus.forEach((sku) => map.set(getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2), sku));
    return map;
  }, [knownSkus]);

  const reviewedRows = useMemo(() => {
    const seen = new Set<string>();
    return parsedRows.map((row) => {
      if (row.cost == null) return { ...row, issue: "No cost entered" };
      const key = getSkuCompositeIdentity(row.style, row.colour, row.leather, row.colour2, row.leather2);
      if (!knownSkuMap.has(key)) return { ...row, issue: "SKU is not in the active range" };
      if (seen.has(key)) return { ...row, issue: "Duplicate spreadsheet row" };
      seen.add(key);
      return row;
    });
  }, [knownSkuMap, parsedRows]);

  const readyRows = useMemo(() => reviewedRows.filter((row) => !row.issue && row.cost != null), [reviewedRows]);
  const issueRows = useMemo(() => reviewedRows.filter((row) => row.issue), [reviewedRows]);

  const importCosts = trpc.sku.importCostRequest.useMutation({
    onSuccess: async (result) => {
      await utils.sku.getSeasonCosts.invalidate({ season });
      toast.success(`${result.updated} SKU cost${result.updated === 1 ? "" : "s"} imported for ${season}`);
      onImported();
      onOpenChange(false);
    },
    onError: (error) => toast.error(`Could not import costs: ${error.message}`),
  });

  const loadFile = async (file: File) => {
    setIsParsing(true);
    setFileName(file.name);
    setFormatError(null);
    try {
      const result = await parseCompletedCostFile(file);
      setParsedRows(result.rows);
      setFormatError(result.formatError ?? null);
      if (!result.formatError) toast.success(`Read ${result.rows.length} row${result.rows.length === 1 ? "" : "s"} from ${file.name}`);
    } catch {
      setParsedRows([]);
      setFormatError("The file could not be read. Upload an .xlsx, .xls or .csv file.");
    } finally {
      setIsParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const reset = () => {
    setFileName("");
    setParsedRows([]);
    setFormatError(null);
  };

  const close = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Import completed cost request</DialogTitle>
          <DialogDescription>Upload the factory’s completed cost workbook. SKU identity is checked before any cost is saved to {season}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <strong>Safe import:</strong> only rows with a valid positive factory cost and an exact active SKU match will be imported. Blank, duplicate or unmatched rows are left untouched and listed below.
          </div>

          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:bg-muted/30"
            style={{ borderColor: "var(--border)" }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void loadFile(file); }}
          >
            {isParsing ? <Loader2 className="mb-2 h-9 w-9 animate-spin text-muted-foreground" /> : <Upload className="mb-2 h-9 w-9 text-muted-foreground" />}
            <p className="text-sm font-medium text-foreground">{fileName || "Drop the completed Excel file here, or click to select"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Accepted: .xlsx, .xls or .csv · Expected cost column: FACTORY COST (AUD)</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} />
          </div>

          {formatError && <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{formatError}</div>}

          {parsedRows.length > 0 && !formatError && (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Rows read</p><p className="text-lg font-semibold">{parsedRows.length}</p></div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Ready to import</p><p className="text-lg font-semibold text-emerald-900">{readyRows.length}</p></div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs text-amber-800">Skipped safely</p><p className="text-lg font-semibold text-amber-900">{issueRows.length}</p></div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted"><tr><th className="px-3 py-2 text-left">Style</th><th className="px-3 py-2 text-left">Colour / Leather</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
                  <tbody>{reviewedRows.slice(0, 12).map((row) => <tr key={`${row.sourceRow}-${row.style}-${row.colour}-${row.leather}`} className="border-t"><td className="px-3 py-2 font-medium">{row.style || "—"}</td><td className="px-3 py-2">{[row.colour, row.leather].filter(Boolean).join(" ") || "—"}{row.colour2 && <span className="text-muted-foreground"> / {[row.colour2, row.leather2].filter(Boolean).join(" ")}</span>}</td><td className="px-3 py-2 text-right font-mono">{row.cost != null ? `$${row.cost.toFixed(2)}` : "—"}</td><td className="px-3 py-2">{row.issue ? <span className="text-amber-700">{row.issue}</span> : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Ready</span>}</td></tr>)}</tbody>
                </table>
              </div>
              {reviewedRows.length > 12 && <p className="text-xs text-muted-foreground">Showing the first 12 rows. The counts above include the complete file.</p>}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={importCosts.isPending}>Cancel</Button>
          <Button onClick={() => importCosts.mutate({ season, costs: readyRows.map((row) => ({ style: row.style, colour: row.colour, leather: row.leather, colour2: row.colour2 ?? "", leather2: row.leather2 ?? "", cost: row.cost! })) })} disabled={readyRows.length === 0 || importCosts.isPending} className="gap-2">
            {importCosts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {importCosts.isPending ? "Importing…" : `Import ${readyRows.length} cost${readyRows.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
