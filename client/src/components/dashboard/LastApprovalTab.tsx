import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { CheckCircle2, Clock, ChevronDown, ChevronRight, Upload, X, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

// Brand new lasts this season — manually confirmed list
const ALL_LASTS = [
  "BILLIE",
  "DAZIE",
  "EDGY/EMBER",
  "ENVY",
  "FINCH",
  "HARLEY",
  "JAYDE",
  "LUCY",
  "MATISSE",
  "PIXIE",
  "ROXIE",
  "SALLY",
  "SIA",
  "TIANA",
  "TILDA",
  "VIVA",
];

const ALL_LASTS_UPPER = new Set(ALL_LASTS.map((l) => l.toUpperCase()));

// Build style lookup per last
const LAST_TO_STYLES: Record<string, string[]> = {};
const LAST_NEW_SKU_COUNT: Record<string, number> = {};
for (const s of skuData.styles) {
  if (!LAST_TO_STYLES[s.last]) LAST_TO_STYLES[s.last] = [];
  LAST_TO_STYLES[s.last].push(s.style);
  LAST_NEW_SKU_COUNT[s.last] = (LAST_NEW_SKU_COUNT[s.last] ?? 0) + (s.newSKUs ?? 0);
}

interface ImportRow {
  lastName: string;
  notes: string;
  status?: "approved" | "waiting_revised" | null;
  matched: boolean;
}

export default function LastApprovalTab() {
  const { data: approvals, refetch } = trpc.lastApproval.getAll.useQuery();
  const upsert = trpc.lastApproval.upsert.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => console.error("[LastApproval] upsert error:", err),
  });

  // Optimistic local state so the UI responds instantly without waiting for refetch
  const [localOverrides, setLocalOverrides] = useState<Record<string, "approved" | "waiting_revised">>({});
  const [expandedLast, setExpandedLast] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [filter, setFilter] = useState<"all" | "approved" | "waiting_revised">("all");

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportRow[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Build a map of lastName → approval record (with local optimistic overrides applied)
  const approvalMap = useMemo(() => {
    const map: Record<string, { status: "approved" | "waiting_revised"; notes: string | null }> = {};
    for (const a of approvals ?? []) {
      map[a.lastName] = { status: a.status, notes: a.notes ?? null };
    }
    // Apply local overrides on top
    for (const [lastName, status] of Object.entries(localOverrides)) {
      if (map[lastName]) {
        map[lastName] = { ...map[lastName], status };
      } else {
        map[lastName] = { status, notes: null };
      }
    }
    return map;
  }, [approvals, localOverrides]);

  const filteredLasts = useMemo(() => {
    return ALL_LASTS.filter((last) => {
      const status = approvalMap[last]?.status ?? "waiting_revised";
      if (filter === "all") return true;
      return status === filter;
    });
  }, [approvalMap, filter]);

  const approvedCount = ALL_LASTS.filter((l) => (approvalMap[l]?.status ?? "waiting_revised") === "approved").length;
  const waitingCount = ALL_LASTS.length - approvedCount;

  const handleToggle = (lastName: string, current: "approved" | "waiting_revised") => {
    const next = current === "approved" ? "waiting_revised" : "approved";
    setLocalOverrides((prev) => ({ ...prev, [lastName]: next }));
    upsert.mutate(
      { lastName, status: next, notes: approvalMap[lastName]?.notes ?? null },
      {
        onError: () => {
          setLocalOverrides((prev) => ({ ...prev, [lastName]: current }));
        },
      }
    );
  };

  const handleSaveNotes = (lastName: string) => {
    upsert.mutate({
      lastName,
      status: approvalMap[lastName]?.status ?? "waiting_revised",
      notes: notesValue || null,
    });
    setEditingNotes(null);
  };

  // ── Excel import ────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportPreview(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        if (rows.length === 0) {
          setImportError("The file appears to be empty.");
          return;
        }

        // Find columns — case-insensitive
        const firstRow = rows[0];
        const keys = Object.keys(firstRow);
        const lastCol = keys.find((k) => k.toLowerCase().includes("last"));
        const notesCol = keys.find((k) => k.toLowerCase().includes("note"));
        const statusCol = keys.find((k) => k.toLowerCase().includes("status") || k.toLowerCase().includes("approval"));

        if (!lastCol) {
          setImportError('Could not find a "Last" column. Please ensure your Excel has a column named "Last".');
          return;
        }
        if (!notesCol) {
          setImportError('Could not find a "Notes" column. Please ensure your Excel has a column named "Notes".');
          return;
        }

        const parsed: ImportRow[] = rows.map((row) => {
          const rawLast = String(row[lastCol!] ?? "").trim().toUpperCase();
          const notes = String(row[notesCol!] ?? "").trim();
          let status: "approved" | "waiting_revised" | null = null;
          if (statusCol) {
            const rawStatus = String(row[statusCol] ?? "").trim().toLowerCase();
            if (rawStatus.includes("approv")) status = "approved";
            else if (rawStatus.includes("wait") || rawStatus.includes("revis")) status = "waiting_revised";
          }
          return {
            lastName: rawLast,
            notes,
            status,
            matched: ALL_LASTS_UPPER.has(rawLast),
          };
        }).filter((r) => r.lastName !== "");

        if (parsed.length === 0) {
          setImportError("No rows found after parsing. Check the file format.");
          return;
        }

        setImportPreview(parsed);
      } catch {
        setImportError("Failed to read the file. Please check it is a valid .xlsx or .xlsm file.");
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    const matched = importPreview.filter((r) => r.matched);
    try {
      for (const row of matched) {
        // Find the canonical last name (preserving original casing)
        const canonical = ALL_LASTS.find((l) => l.toUpperCase() === row.lastName) ?? row.lastName;
        await upsert.mutateAsync({
          lastName: canonical,
          status: row.status ?? approvalMap[canonical]?.status ?? "waiting_revised",
          notes: row.notes || approvalMap[canonical]?.notes || null,
        });
      }
      await refetch();
      setImportPreview(null);
    } catch {
      setImportError("Some rows failed to save. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const matchedCount = importPreview?.filter((r) => r.matched).length ?? 0;
  const unmatchedCount = importPreview?.filter((r) => !r.matched).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header stats + import button */}
      <div className="flex items-start gap-4">
        <div className="grid grid-cols-3 gap-4 flex-1">
          <div
            className="rounded-xl p-4 cursor-pointer border transition-all"
            style={{
              background: filter === "all" ? "oklch(0.97 0.02 240)" : "var(--card)",
              borderColor: filter === "all" ? "oklch(0.72 0.10 240)" : "var(--border)",
            }}
            onClick={() => setFilter("all")}
          >
            <div className="text-2xl font-bold text-foreground">{ALL_LASTS.length}</div>
            <div className="text-sm text-muted-foreground mt-0.5">Total Lasts</div>
          </div>
          <div
            className="rounded-xl p-4 cursor-pointer border transition-all"
            style={{
              background: filter === "approved" ? "oklch(0.96 0.06 155)" : "var(--card)",
              borderColor: filter === "approved" ? "oklch(0.72 0.14 155)" : "var(--border)",
            }}
            onClick={() => setFilter(filter === "approved" ? "all" : "approved")}
          >
            <div className="text-2xl font-bold" style={{ color: "oklch(0.40 0.14 155)" }}>{approvedCount}</div>
            <div className="text-sm text-muted-foreground mt-0.5">Approved</div>
          </div>
          <div
            className="rounded-xl p-4 cursor-pointer border transition-all"
            style={{
              background: filter === "waiting_revised" ? "oklch(0.97 0.06 65)" : "var(--card)",
              borderColor: filter === "waiting_revised" ? "oklch(0.72 0.16 65)" : "var(--border)",
            }}
            onClick={() => setFilter(filter === "waiting_revised" ? "all" : "waiting_revised")}
          >
            <div className="text-2xl font-bold" style={{ color: "oklch(0.50 0.14 55)" }}>{waitingCount}</div>
            <div className="text-sm text-muted-foreground mt-0.5">Waiting on Revised</div>
          </div>
        </div>

        {/* Import button */}
        <div className="flex-shrink-0 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:bg-muted/50"
            style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}
          >
            <Upload className="w-4 h-4" />
            Import Notes
          </button>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-[140px] text-right">
            Excel with Last + Notes columns
          </p>
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="flex items-start gap-3 rounded-lg border px-4 py-3" style={{ borderColor: "oklch(0.80 0.12 25)", background: "oklch(0.97 0.04 25)" }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "oklch(0.55 0.14 25)" }} />
          <p className="text-sm" style={{ color: "oklch(0.45 0.14 25)" }}>{importError}</p>
          <button onClick={() => setImportError(null)} className="ml-auto flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Import preview */}
      {importPreview && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
            <div>
              <p className="font-semibold text-sm text-foreground">Import Preview</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {matchedCount} matched · {unmatchedCount > 0 ? `${unmatchedCount} unrecognised (will be skipped)` : "all recognised"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportPreview(null)}
                className="px-3 py-1.5 rounded text-xs font-medium border text-muted-foreground hover:bg-muted transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing || matchedCount === 0}
                className="px-3 py-1.5 rounded text-xs font-medium text-white disabled:opacity-50 transition-colors"
                style={{ background: "oklch(0.45 0.14 155)" }}
              >
                {importing ? "Saving…" : `Import ${matchedCount} row${matchedCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Match</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((row, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: "var(--border)", opacity: row.matched ? 1 : 0.45 }}>
                    <td className="px-4 py-2 font-medium text-foreground">{row.lastName}</td>
                    <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">{row.notes || <span className="italic opacity-50">—</span>}</td>
                    <td className="px-4 py-2">
                      {row.status === "approved" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.92 0.08 155)", color: "oklch(0.35 0.14 155)" }}>Approved</span>
                      ) : row.status === "waiting_revised" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.95 0.06 65)", color: "oklch(0.50 0.14 55)" }}>Waiting</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">unchanged</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {row.matched ? (
                        <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.50 0.14 155)" }} />
                      ) : (
                        <span className="text-xs text-muted-foreground italic">not found</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Last list */}
      <div className="space-y-2">
        {filteredLasts.map((lastName) => {
          const approval = approvalMap[lastName];
          const status = approval?.status ?? "waiting_revised";
          const notes = approval?.notes ?? null;
          const styles = LAST_TO_STYLES[lastName] ?? [];
          const isExpanded = expandedLast === lastName;
          const isEditingThisNotes = editingNotes === lastName;

          return (
            <div
              key={lastName}
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor: status === "approved" ? "oklch(0.80 0.10 155)" : "var(--border)",
                background: status === "approved" ? "oklch(0.98 0.02 155)" : "var(--card)",
              }}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Toggle button */}
                <button
                  onClick={() => handleToggle(lastName, status)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:opacity-80"
                  style={status === "approved"
                    ? { background: "oklch(0.92 0.08 155)", color: "oklch(0.35 0.14 155)", borderColor: "oklch(0.72 0.14 155)" }
                    : { background: "oklch(0.95 0.06 65)", color: "oklch(0.50 0.14 55)", borderColor: "oklch(0.72 0.16 65)" }
                  }
                  title={status === "approved" ? "Click to mark as Waiting on Revised" : "Click to mark as Approved"}
                >
                  {status === "approved" ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" /><span>Approved</span></>
                  ) : (
                    <><Clock className="w-3.5 h-3.5" /><span>Waiting on Revised</span></>
                  )}
                </button>

                {/* Last name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{lastName}</span>
                    <span className="text-xs text-muted-foreground">
                      {LAST_NEW_SKU_COUNT[lastName] ?? 0} new SKU{(LAST_NEW_SKU_COUNT[lastName] ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {notes && !isExpanded && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{notes}</p>
                  )}
                </div>

                {/* Style count */}
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {styles.length} {styles.length === 1 ? "style" : "styles"}
                </span>

                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedLast(isExpanded ? null : lastName)}
                  className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Expanded section */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--border)" }}>
                  {/* Styles on this last */}
                  <div className="mt-3 mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Styles on this last
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {styles.map((s) => (
                        <span
                          key={s}
                          className="text-xs px-2 py-0.5 rounded border font-medium text-foreground"
                          style={{ borderColor: "var(--border)", background: "var(--muted)" }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Notes
                    </p>
                    {isEditingThisNotes ? (
                      <div className="flex gap-2">
                        <textarea
                          className="flex-1 text-sm rounded border px-3 py-2 bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                          style={{ borderColor: "var(--border)" }}
                          rows={3}
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder="Add notes about this last..."
                          autoFocus
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleSaveNotes(lastName)}
                            className="px-3 py-1.5 rounded text-xs font-medium text-white"
                            style={{ background: "oklch(0.45 0.14 155)" }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="px-3 py-1.5 rounded text-xs font-medium text-muted-foreground border"
                            style={{ borderColor: "var(--border)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="text-sm text-muted-foreground rounded border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors min-h-[2.5rem]"
                        style={{ borderColor: "var(--border)" }}
                        onClick={() => {
                          setEditingNotes(lastName);
                          setNotesValue(notes ?? "");
                        }}
                      >
                        {notes ? notes : <span className="italic opacity-60">Click to add notes...</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
