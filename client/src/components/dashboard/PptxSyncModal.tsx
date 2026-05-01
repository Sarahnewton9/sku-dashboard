/**
 * PptxSyncModal — Upload a range review PPTX, parse it, review and EDIT the diff,
 * and apply changes (cancel red SKUs, mark specked SKUs, add new SKUs).
 */
import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { toast } from "sonner";
import {
  Upload, X, CheckCircle, FileText,
  Loader2, RefreshCw, Pencil, Trash2, Filter, PlusCircle, ScanSearch
} from "lucide-react";

type ActionType = "cancel_sku" | "mark_specked" | "mark_specked_no_sample" | "add_new" | "skip";

type EditableRow = {
  id: string;
  last: string;
  style: string;
  colour: string;
  leather: string;
  pptxStatus: string;
  currentStatus: string;
  action: ActionType;
  sampleStatus?: string; // for add_new rows
  removed: boolean;
  editing: boolean;
};

type ParseResult = {
  slideCount: number;
  toCancel: any[];
  toMarkSpecked: any[];
  toMarkSpeckedNoSample: any[];
  toAddNew: any[];
  alreadyCancelled: any[];
};

type Props = {
  onClose: () => void;
  onApplied: () => void;
};

const ACTION_CONFIG: Record<ActionType, { label: string; colour: string; bg: string }> = {
  add_new:                  { label: "Add New SKU",        colour: "#16A34A", bg: "#F0FDF4" },
  cancel_sku:               { label: "Cancel SKU",         colour: "#EF4444", bg: "#FEF2F2" },
  mark_specked:             { label: "Mark Specked ✓",     colour: "#A855F7", bg: "#FAF5FF" },
  mark_specked_no_sample:   { label: "Specked (no sample)", colour: "#06B6D4", bg: "#ECFEFF" },
  skip:                     { label: "Skip",               colour: "#9CA3AF", bg: "#F9FAFB" },
};

function buildRows(result: ParseResult): EditableRow[] {
  const rows: EditableRow[] = [];
  let idx = 0;
  const add = (items: any[], action: ActionType) => {
    for (const item of items) {
      rows.push({
        id: String(idx++),
        last: item.last ?? "",
        style: item.style ?? "",
        colour: item.colour ?? "",
        leather: item.leather ?? "",
        pptxStatus: item.pptxStatus ?? "",
        currentStatus: item.currentStatus ?? "",
        action,
        sampleStatus: item.sampleStatus,
        removed: false,
        editing: false,
      });
    }
  };
  // New SKUs first so they're most prominent
  add(result.toAddNew ?? [], "add_new");
  add(result.toCancel, "cancel_sku");
  add(result.toMarkSpecked, "mark_specked");
  add(result.toMarkSpeckedNoSample, "mark_specked_no_sample");
  return rows;
}

export default function PptxSyncModal({ onClose, onApplied }: Props) {
  const [step, setStep] = useState<"upload" | "parsing" | "review" | "applying" | "done">("upload");
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [slideCount, setSlideCount] = useState(0);
  const [fileName, setFileName] = useState<string>("");
  const [filterAction, setFilterAction] = useState<ActionType | "all">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rescanInfo, setRescanInfo] = useState<{ fileName: string; uploadedAt: Date } | null>(null);
  const buildDiffMutation = trpc.pptxSync.buildDiff.useMutation();
  const rescanMutation = trpc.pptxSync.rescan.useMutation();

  const applyMutation = trpc.pptxSync.applyChanges.useMutation({
    onSuccess: (data) => {
      setStep("done");
      const parts: string[] = [];
      if (data.added) parts.push(`${data.added} new SKU${data.added !== 1 ? "s" : ""} added`);
      if (data.cancelled) parts.push(`${data.cancelled} cancelled`);
      if (data.specked) parts.push(`${data.specked} marked specked`);
      if (data.speckedNoSample) parts.push(`${data.speckedNoSample} specked (no sample)`);
      toast.success(`Sync applied: ${parts.join(", ") || "no changes"}`);
      onApplied();
    },
    onError: (err) => {
      toast.error(`Apply failed: ${err.message}`);
      setStep("review");
    },
  });

  async function handleRescan() {
    setStep("parsing");
    setFileName("Re-scanning last uploaded PPTX…");
    try {
      const knownSkus = (skuData.rawSkus as readonly { style: string; colour: string; leather: string }[]).map((s) => ({
        style: s.style,
        colour: s.colour,
        leather: s.leather ?? "",
      }));
      const data = await rescanMutation.mutateAsync({ knownSkus });
      if (!data.success) throw new Error((data as any).error || "Rescan failed");
      setRescanInfo({ fileName: (data as any).fileName, uploadedAt: (data as any).uploadedAt });
      setFileName((data as any).fileName ?? "Last uploaded PPTX");
      setSlideCount(0);
      // Build rows from missed items only
      const missed = (data as any).missed ?? [];
      const rows: EditableRow[] = missed.map((item: any, idx: number) => ({
        id: String(idx),
        last: item.last ?? "",
        style: item.style ?? "",
        colour: item.colour ?? "",
        leather: item.leather ?? "",
        pptxStatus: item.pptxStatus ?? "",
        currentStatus: "no_meta",
        action: "add_new" as ActionType,
        sampleStatus: item.sampleStatus,
        removed: false,
        editing: false,
      }));
      setRows(rows);
      setStep("review");
      if (rows.length === 0) {
        toast.success("No missed SKUs found — the dashboard is up to date.");
      } else {
        toast.info(`Found ${rows.length} SKU${rows.length !== 1 ? "s" : ""} that were missed in the previous import.`);
      }
    } catch (err: any) {
      toast.error(`Re-scan failed: ${err.message}`);
      setStep("upload");
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".pptx")) {
      toast.error("Please select a .pptx file");
      return;
    }
    setFileName(file.name);
    setStep("parsing");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/pptx-upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Upload failed");
      }
      const { parsed } = await res.json();

      // Pass the full static SKU list so the server can detect new SKUs
      const knownSkus = (skuData.rawSkus as readonly { style: string; colour: string; leather: string }[]).map((s) => ({
        style: s.style,
        colour: s.colour,
        leather: s.leather ?? "",
      }));

      const data = await buildDiffMutation.mutateAsync({ parsed, knownSkus });
      if (!data) throw new Error("Failed to build diff");
      setSlideCount(data.slideCount);
      setRows(buildRows(data as unknown as ParseResult));
      setStep("review");
    } catch (err: any) {
      toast.error(`Parse failed: ${err.message}`);
      setStep("upload");
    }
  }

  function updateRow(id: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, removed: true, editing: false } : r)));
  }

  function restoreRow(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, removed: false } : r)));
  }

  function handleApply() {
    const active = rows.filter((r) => !r.removed && r.action !== "skip");
    setStep("applying");
    applyMutation.mutate({
      cancelSkus: active.filter((r) => r.action === "cancel_sku").map((r) => ({ style: r.style, colour: r.colour, leather: r.leather })),
      markSpecked: active.filter((r) => r.action === "mark_specked").map((r) => ({ style: r.style, colour: r.colour, leather: r.leather })),
      markSpeckedNoSample: active.filter((r) => r.action === "mark_specked_no_sample").map((r) => ({ style: r.style, colour: r.colour, leather: r.leather })),
      addNewSkus: active.filter((r) => r.action === "add_new").map((r) => ({
        style: r.style,
        colour: r.colour,
        leather: r.leather,
        sampleStatus: (r.sampleStatus === "received" ? "received" : "waiting") as "received" | "waiting",
      })),
    });
  }

  const activeRows = rows.filter((r) => !r.removed);
  const visibleRows = useMemo(() => {
    if (filterAction === "all") return activeRows;
    return activeRows.filter((r) => r.action === filterAction);
  }, [activeRows, filterAction]);

  const removedRows = rows.filter((r) => r.removed);
  const totalChanges = activeRows.filter((r) => r.action !== "skip").length;

  const countByAction = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of activeRows) {
      counts[r.action] = (counts[r.action] ?? 0) + 1;
    }
    return counts;
  }, [activeRows]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-4xl rounded-2xl shadow-2xl bg-card overflow-hidden flex flex-col"
        style={{ border: "1px solid var(--border)", maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.92 0.06 260)" }}>
            <FileText className="w-5 h-5" style={{ color: "oklch(0.40 0.14 260)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base text-foreground">Sync from Range Review PPTX</p>
            <p className="text-xs text-muted-foreground">
              Upload your range review PowerPoint to add new SKUs, cancel red SKUs, and update sample status
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">

          {/* Upload step */}
          {step === "upload" && (
            <div>
              <input ref={fileInputRef} type="file" accept=".pptx" className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-4 p-10 rounded-xl border-2 border-dashed transition-all hover:bg-muted/20"
                style={{ borderColor: "oklch(0.75 0.10 260)" }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.92 0.06 260)" }}>
                  <Upload className="w-7 h-7" style={{ color: "oklch(0.40 0.14 260)" }} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">Click to select your range review PPTX</p>
                  <p className="text-sm text-muted-foreground mt-1">New SKUs will be detected and added automatically</p>
                </div>
              </button>
              {/* Re-scan button */}
              <div className="mt-3 flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "oklch(0.88 0.06 30)", background: "oklch(0.97 0.02 30)" }}>
                <ScanSearch className="w-5 h-5 flex-shrink-0" style={{ color: "oklch(0.50 0.14 30)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">Re-scan last uploaded PPTX</p>
                  <p className="text-xs text-muted-foreground">Find SKUs that were missed due to the heading detection bug (now fixed)</p>
                </div>
                <button
                  onClick={handleRescan}
                  disabled={rescanMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                  style={{ background: "oklch(0.50 0.14 30)", color: "white" }}
                >
                  {rescanMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
                  Re-scan
                </button>
              </div>

              <div className="mt-4 rounded-xl p-4 text-xs space-y-1.5" style={{ background: "oklch(0.97 0.02 260)", border: "1px solid oklch(0.88 0.04 260)" }}>
                <p className="font-semibold text-foreground mb-2">Highlight colour key</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { bg: "#FF00FF", label: "Magenta — specked, sample here" },
                    { bg: "#00FFFF", label: "Cyan — specked, no sample yet" },
                    { bg: "#FFFF00", label: "Yellow — not specked yet", border: true },
                    { bg: "#FF0000", label: "Red — cancelled" },
                    { bg: "transparent", label: "No highlight — carry over / new (unspecked)", border: true },
                  ].map(({ bg, label, border }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: bg, border: border ? "1px solid #ccc" : undefined }} />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Parsing step */}
          {step === "parsing" && (
            <div className="flex flex-col items-center gap-6 py-10">
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: "oklch(0.40 0.14 260)" }} />
              <div className="text-center">
                <p className="font-semibold text-foreground">Parsing {fileName}…</p>
                <p className="text-sm text-muted-foreground mt-1">Reading slides, extracting styles, SKUs, and highlight colours</p>
              </div>
            </div>
          )}

          {/* Review step */}
          {step === "review" && (
            <div className="space-y-3">
              {/* Summary bar */}
              <div className="rounded-xl p-3 flex items-center gap-4 flex-wrap" style={{ background: "oklch(0.96 0.02 260)", border: "1px solid oklch(0.88 0.04 260)" }}>
                <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "oklch(0.40 0.14 260)" }} />
                <span className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">{fileName}</span>
                <span className="text-xs text-muted-foreground">{slideCount} slides</span>
                {(Object.keys(ACTION_CONFIG) as ActionType[]).map((a) => {
                  if (a === "skip") return null;
                  const cfg = ACTION_CONFIG[a];
                  const count = countByAction[a] ?? 0;
                  if (!count) return null;
                  return (
                    <span key={a} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.colour }}>
                      {count} {cfg.label}
                    </span>
                  );
                })}
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                {([
                  ["all", "All changes", "#6B7280"],
                  ["add_new", "New SKUs", "#16A34A"],
                  ["cancel_sku", "Cancel", "#EF4444"],
                  ["mark_specked", "Specked ✓", "#A855F7"],
                  ["mark_specked_no_sample", "Specked (no sample)", "#06B6D4"],
                ] as [ActionType | "all", string, string][]).map(([val, label, colour]) => {
                  const count = val === "all" ? activeRows.filter((r) => r.action !== "skip").length : (countByAction[val] ?? 0);
                  const isActive = filterAction === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setFilterAction(val)}
                      className="text-xs px-2.5 py-1 rounded-full font-medium transition-all border"
                      style={{
                        background: isActive ? colour + "20" : "transparent",
                        color: isActive ? colour : "var(--muted-foreground)",
                        borderColor: isActive ? colour + "60" : "var(--border)",
                      }}
                    >
                      {label} {count > 0 && <span className="ml-0.5 opacity-70">({count})</span>}
                    </button>
                  );
                })}
              </div>

              {/* Editable table */}
              {visibleRows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {activeRows.length === 0 ? "No changes needed — the dashboard already reflects the PPTX." : "No rows match this filter."}
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  {/* Table header */}
                  <div className="grid text-xs font-semibold text-muted-foreground px-3 py-2 border-b" style={{ gridTemplateColumns: "80px 90px 90px 1fr 180px 60px", borderColor: "var(--border)", background: "var(--muted)" }}>
                    <span>Last</span>
                    <span>Style</span>
                    <span>Colour</span>
                    <span>Leather</span>
                    <span>Action</span>
                    <span></span>
                  </div>
                  <div className="divide-y max-h-[45vh] overflow-y-auto" style={{ borderColor: "var(--border)" }}>
                    {visibleRows.map((row) => (
                      <EditableTableRow
                        key={row.id}
                        row={row}
                        onUpdate={(patch) => updateRow(row.id, patch)}
                        onRemove={() => removeRow(row.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Removed rows */}
              {removedRows.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">{removedRows.length} row{removedRows.length !== 1 ? "s" : ""} removed.</span>{" "}
                  {removedRows.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => restoreRow(r.id)}
                      className="underline hover:text-foreground ml-1 transition-colors"
                    >
                      Restore {r.style} {r.colour}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Applying step */}
          {step === "applying" && (
            <div className="flex flex-col items-center gap-6 py-10">
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: "oklch(0.40 0.14 260)" }} />
              <div className="text-center">
                <p className="font-semibold text-foreground">Applying changes…</p>
                <p className="text-sm text-muted-foreground mt-1">Adding new SKUs, cancelling SKUs, and updating sample status</p>
              </div>
            </div>
          )}

          {/* Done step */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-6 py-10">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "oklch(0.92 0.10 145)" }}>
                <CheckCircle className="w-9 h-9" style={{ color: "oklch(0.45 0.18 145)" }} />
              </div>
              <div className="text-center">
                <p className="font-bold text-foreground text-lg">Sync complete</p>
                <p className="text-sm text-muted-foreground mt-1">All changes have been applied. The dashboard will refresh automatically.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t gap-3 flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          {step === "review" && (
            <button
              onClick={() => { setStep("upload"); setRows([]); setFileName(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors hover:bg-muted"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Upload different file
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-muted"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {step === "done" ? "Close" : "Cancel"}
          </button>
          {step === "review" && totalChanges > 0 && (
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
              style={{ background: "oklch(0.40 0.14 260)", color: "white" }}
            >
              Apply {totalChanges} change{totalChanges !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Editable table row ──────────────────────────────────────────────────────

function EditableTableRow({
  row,
  onUpdate,
  onRemove,
}: {
  row: EditableRow;
  onUpdate: (patch: Partial<EditableRow>) => void;
  onRemove: () => void;
}) {
  const cfg = ACTION_CONFIG[row.action];

  if (row.editing) {
    return (
      <div className="px-3 py-2 space-y-2" style={{ background: "oklch(0.97 0.02 260)" }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          {(["last", "style", "colour", "leather"] as const).map((field) => (
            <div key={field}>
              <label className="text-xs text-muted-foreground capitalize">{field}</label>
              <input
                className="w-full mt-0.5 px-2 py-1 text-xs rounded border bg-background text-foreground"
                style={{ borderColor: "var(--border)" }}
                value={row[field]}
                onChange={(e) => onUpdate({ [field]: e.target.value.toUpperCase() })}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-muted-foreground">Action:</label>
          <select
            className="text-xs px-2 py-1 rounded border bg-background text-foreground"
            style={{ borderColor: "var(--border)" }}
            value={row.action}
            onChange={(e) => onUpdate({ action: e.target.value as ActionType })}
          >
            {(Object.keys(ACTION_CONFIG) as ActionType[]).map((a) => (
              <option key={a} value={a}>{ACTION_CONFIG[a].label}</option>
            ))}
          </select>
          {row.action === "add_new" && (
            <>
              <label className="text-xs text-muted-foreground ml-2">Sample:</label>
              <select
                className="text-xs px-2 py-1 rounded border bg-background text-foreground"
                style={{ borderColor: "var(--border)" }}
                value={row.sampleStatus ?? "waiting"}
                onChange={(e) => onUpdate({ sampleStatus: e.target.value })}
              >
                <option value="waiting">Waiting (not received)</option>
                <option value="received">Received</option>
              </select>
            </>
          )}
          <div className="flex-1" />
          <button
            onClick={() => onUpdate({ editing: false })}
            className="text-xs px-3 py-1 rounded font-semibold transition-colors"
            style={{ background: "oklch(0.40 0.14 260)", color: "white" }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid items-center px-3 py-2 text-xs hover:bg-muted/20 transition-colors group"
      style={{ gridTemplateColumns: "80px 90px 90px 1fr 180px 60px" }}
    >
      <span className="text-muted-foreground font-mono truncate">{row.last}</span>
      <span className="font-semibold text-foreground truncate">{row.style}</span>
      <span className="text-foreground truncate">{row.colour}</span>
      <span className="text-muted-foreground truncate">{row.leather}</span>
      <span className="flex items-center gap-1.5">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
          style={{ background: cfg.bg, color: cfg.colour }}
        >
          {row.action === "add_new" && <PlusCircle className="w-3 h-3" />}
          {cfg.label}
        </span>
        {row.action === "add_new" && (
          <span className="text-xs text-muted-foreground">
            {row.sampleStatus === "received" ? "✓ rcvd" : "waiting"}
          </span>
        )}
      </span>
      <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onUpdate({ editing: true })}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="Edit this row"
        >
          <Pencil className="w-3 h-3 text-muted-foreground" />
        </button>
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-red-50 transition-colors"
          title="Remove this row"
        >
          <Trash2 className="w-3 h-3 text-red-400" />
        </button>
      </span>
    </div>
  );
}
