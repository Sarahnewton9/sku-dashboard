import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { resolveFobRequestSku } from "@shared/fobCostRequest";
import { parseFobCostGrid, type ParsedFobCostFile } from "@shared/fobCostImport";
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

async function parseCompletedCostFile(file: File): Promise<ParsedFobCostFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return parseFobCostGrid(grid);
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
  const [fileFormat, setFileFormat] = useState<ParsedFobCostFile["format"] | null>(null);
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
      if (row.cost == null) return { ...row, issue: "No valid USD FOB entered" };
      // SKU Dash request sheets deliberately omit the individual leather fields.
      // Resolve the display colour back to a complete Upper 1 / Upper 2 identity.
      const simplifiedRequestRow = !row.leather && !row.colour2 && !row.leather2;
      const matchedSku = simplifiedRequestRow
        ? resolveFobRequestSku(knownSkus, row.style, row.colour)
        : null;
      const resolvedRow = matchedSku
        ? { ...row, ...matchedSku, cost: row.cost, sourceRow: row.sourceRow }
        : row;
      const key = getSkuCompositeIdentity(resolvedRow.style, resolvedRow.colour, resolvedRow.leather, resolvedRow.colour2, resolvedRow.leather2);
      if (!knownSkuMap.has(key)) return { ...row, issue: "SKU is not in the active range" };
      if (seen.has(key)) return { ...resolvedRow, issue: "Duplicate spreadsheet row" };
      seen.add(key);
      return resolvedRow;
    });
  }, [knownSkuMap, knownSkus, parsedRows]);

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
    setFileFormat(null);
    setFormatError(null);
    try {
      const result = await parseCompletedCostFile(file);
      setParsedRows(result.rows);
      setFileFormat(result.format);
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
    setFileFormat(null);
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
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Import factory FOB costs</DialogTitle>
          <DialogDescription>Drag in the factory’s returned FOB file. SKU identity is checked before any cost is saved to {season}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <strong>Safe import:</strong> upload either the SKU Dash FOB request or the factory’s full cost list. Values such as <strong>US$34.50</strong>, <strong>$USD40</strong> and <strong>USD 40</strong> are read as USD. Only positive amounts with an exact active SKU match are saved.
          </div>

          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:bg-muted/30"
            style={{ borderColor: "var(--border)" }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void loadFile(file); }}
          >
            {isParsing ? <Loader2 className="mb-2 h-9 w-9 animate-spin text-muted-foreground" /> : <Upload className="mb-2 h-9 w-9 text-muted-foreground" />}
            <p className="text-sm font-medium text-foreground">{fileName || "Drop the returned factory cost file here, or click to select"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Accepted: .xlsx, .xls or .csv · Headers supported: FOB / $USD / Cost (USD)</p>
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
              <p className="text-xs text-muted-foreground">Recognised format: <strong>{fileFormat === "factory_list" ? "factory full cost list" : "SKU Dash FOB request"}</strong>.</p>

              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted"><tr><th className="px-3 py-2 text-left">Style</th><th className="px-3 py-2 text-left">Colour / Leather</th><th className="px-3 py-2 text-right">FOB (USD)</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
                  <tbody>{reviewedRows.slice(0, 12).map((row) => <tr key={`${row.sourceRow}-${row.style}-${row.colour}-${row.leather}`} className="border-t"><td className="px-3 py-2 font-medium">{row.style || "—"}</td><td className="px-3 py-2">{[row.colour, row.leather].filter(Boolean).join(" ") || "—"}{row.colour2 && <span className="text-muted-foreground"> / {[row.colour2, row.leather2].filter(Boolean).join(" ")}</span>}</td><td className="px-3 py-2 text-right font-mono">{row.cost != null ? `$${row.cost.toFixed(2)}` : "—"}</td><td className="px-3 py-2">{row.issue ? <span className="text-amber-700">{row.issue}</span> : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Ready</span>}</td></tr>)}</tbody>
                </table>
              </div>
              {reviewedRows.length > 12 && <p className="text-xs text-muted-foreground">Showing the first 12 rows. The counts above include the complete file.</p>}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={importCosts.isPending}>Cancel</Button>
          <Button onClick={() => importCosts.mutate({ season, costs: readyRows.map((row) => ({ style: row.style, colour: row.colour, leather: row.leather ?? "", colour2: row.colour2 ?? "", leather2: row.leather2 ?? "", cost: row.cost! })) })} disabled={readyRows.length === 0 || importCosts.isPending} className="gap-2">
            {importCosts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {importCosts.isPending ? "Importing…" : `Import ${readyRows.length} cost${readyRows.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
