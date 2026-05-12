import React, { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { CheckCircle2, Clock, ChevronDown, ChevronRight, Upload, X, AlertTriangle, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

// Brand new lasts this season — manually confirmed list
const ALL_LASTS = [
  "BILLIE",
  "DAZIE",
  "EDGY",
  "EMBER",
  "ENVY",
  "FINCH",
  "HARLEY",
  "JAYDE",
  "LUCY",
  "MATISSE",
  "MISTY",
  "PIXIE",
  "ROXIE",
  "SALLY",
  "SIA",
  "TIANA",
  "TILDA",
  "VIVA",
];

const ALL_LASTS_UPPER = new Set(ALL_LASTS.map((l) => l.toUpperCase()));

  // Static STYLE_IMAGE_MAP fallback (used when no DB override)
const STYLE_IMAGE_MAP: Record<string, string> = {};
for (const s of skuData.styles) {
  if ((s as any).imageUrl) STYLE_IMAGE_MAP[s.style] = (s as any).imageUrl;
}

interface ImportRow {
  lastName: string;
  notes: string;
  status?: "approved" | "waiting_revised" | null;
  matched: boolean;
}

export default function LastApprovalTab() {
  const { mergedStyles } = useCustomSkus();

  // Build style lookup per last (live, includes custom SKUs)
  const { lastToStyles, lastNewSkuCount } = useMemo(() => {
    const lastToStyles: Record<string, string[]> = {};
    const lastNewSkuCount: Record<string, number> = {};
    for (const s of mergedStyles as typeof skuData.styles) {
      if (!lastToStyles[s.last]) lastToStyles[s.last] = [];
      lastToStyles[s.last].push(s.style);
      lastNewSkuCount[s.last] = (lastNewSkuCount[s.last] ?? 0) + (s.newSKUs ?? 0);
    }
    return { lastToStyles, lastNewSkuCount };
  }, [mergedStyles]);

  const { data: approvals, refetch } = trpc.lastApproval.getAll.useQuery();
  const { data: deletedLastsFromDb = [], refetch: refetchDeleted } = trpc.lastApproval.getDeleted.useQuery();
  const { data: imageOverrideList = [] } = trpc.styleImage.getAll.useQuery();
  const imageOverrides = useMemo(
    () => imageOverrideList.reduce<Record<string, string>>((acc, o) => { acc[o.style] = o.imageUrl; return acc; }, {}),
    [imageOverrideList]
  );
  const upsert = trpc.lastApproval.upsert.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => console.error("[LastApproval] upsert error:", err),
  });
  const deleteLastMutation = trpc.lastApproval.delete.useMutation({
    onSuccess: () => { refetchDeleted(); },
    onError: (err) => console.error("[LastApproval] delete error:", err),
  });

  // Optimistic local state so the UI responds instantly without waiting for refetch
  const [localOverrides, setLocalOverrides] = useState<Record<string, "approved" | "waiting_revised">>({});
  const [expandedLast, setExpandedLast] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  // Per-last draft store: keyed by lastName — survives navigation between lasts
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "approved" | "waiting_revised">("all");
  const [deletingLast, setDeletingLast] = useState<string | null>(null);
  const [customLasts, setCustomLasts] = useState<string[]>([]);

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

  // Merged list: static lasts + any custom ones added, minus deleted ones
  const activeLasts = useMemo(() => {
    const deleted = new Set(Object.keys(approvalMap).filter((k) => approvalMap[k]?.status === undefined));
    return [...ALL_LASTS, ...customLasts].filter((l) => !deleted.has(l + "__deleted"));
  }, [approvalMap, customLasts]);

  // Track which lasts have been locally deleted (optimistic, synced with DB)
  const [localDeletedLasts, setLocalDeletedLasts] = useState<Set<string>>(new Set());

  // Merge DB-deleted lasts with local optimistic deletes
  const deletedLastsSet = useMemo(() => {
    const set = new Set(deletedLastsFromDb);
    localDeletedLasts.forEach(l => set.add(l));
    return set;
  }, [deletedLastsFromDb, localDeletedLasts]);

  const visibleLasts = useMemo(() => {
    return [...ALL_LASTS, ...customLasts].filter((l) => !deletedLastsSet.has(l));
  }, [customLasts, deletedLastsSet]);

  const filteredLasts = useMemo(() => {
    return visibleLasts.filter((last) => {
      const status = approvalMap[last]?.status ?? "waiting_revised";
      if (filter === "all") return true;
      return status === filter;
    });
  }, [approvalMap, filter, visibleLasts]);

  const approvedCount = visibleLasts.filter((l) => (approvalMap[l]?.status ?? "waiting_revised") === "approved").length;
  const waitingCount = visibleLasts.length - approvedCount;

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

  const handleDeleteLast = (lastName: string) => {
    // Optimistic local update
    setLocalDeletedLasts((prev) => new Set([...prev, lastName]));
    setDeletingLast(null);
    // Persist to DB
    deleteLastMutation.mutate({ lastName });
  };

  const handleSaveNotes = (lastName: string) => {
    const draft = notesDrafts[lastName] ?? "";
    upsert.mutate({
      lastName,
      status: approvalMap[lastName]?.status ?? "waiting_revised",
      notes: draft || null,
    });
    // Clear the draft for this last after saving
    setNotesDrafts((prev) => { const n = { ...prev }; delete n[lastName]; return n; });
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
          const styles = lastToStyles[lastName] ?? [];
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
              {/* Main row — entire row is clickable to expand */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedLast(isExpanded ? null : lastName)}
              >
                {/* Toggle button — stop propagation so it doesn't also expand */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggle(lastName, status); }}
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
                      {lastNewSkuCount[lastName] ?? 0} new SKU{(lastNewSkuCount[lastName] ?? 0) !== 1 ? "s" : ""}
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

                {/* Delete button */}
                {deletingLast === lastName ? (
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-muted-foreground">Remove?</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteLast(lastName); }}
                      className="px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ background: "oklch(0.50 0.18 25)" }}
                    >Yes</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingLast(null); }}
                      className="px-2 py-0.5 rounded text-xs font-medium border text-muted-foreground"
                      style={{ borderColor: "var(--border)" }}
                    >No</button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingLast(lastName); }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex-shrink-0 opacity-40 hover:opacity-100"
                    title="Remove this last"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                )}

                {/* Expand chevron */}
                <div className="p-1 flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded section */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--border)" }}>
                  {/* Styles on this last — with images */}
                  <div className="mt-3 mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Styles on this last
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {styles.map((s) => (
                        <div
                          key={s}
                          className="flex flex-col items-center gap-1"
                        >
                          {(imageOverrides[s] ?? STYLE_IMAGE_MAP[s]) ? (
                            <img
                              src={imageOverrides[s] ?? STYLE_IMAGE_MAP[s]}
                              alt={s}
                              className="w-24 h-24 object-contain rounded-lg border bg-white"
                              style={{ borderColor: "var(--border)" }}
                            />
                          ) : (
                            <div
                              className="w-24 h-24 rounded-lg border flex items-center justify-center text-muted-foreground/40"
                              style={{ borderColor: "var(--border)", background: "var(--muted)" }}
                            >
                              <span className="text-[9px]">No img</span>
                            </div>
                          )}
                          <span
                            className="text-[10px] font-medium text-foreground text-center leading-tight max-w-[64px] truncate"
                          >{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                      Notes
                      {/* Unsaved draft indicator */}
                      {notesDrafts[lastName] !== undefined && notesDrafts[lastName] !== (notes ?? "") && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved draft" />
                      )}
                    </p>
                    {isEditingThisNotes ? (
                      <div className="flex gap-2">
                        <textarea
                          className="flex-1 text-sm rounded border px-3 py-2 bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                          style={{ borderColor: "var(--border)" }}
                          rows={3}
                          value={notesDrafts[lastName] ?? ""}
                          onChange={(e) => setNotesDrafts((prev) => ({ ...prev, [lastName]: e.target.value }))}
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
                          // Only seed the draft from DB if there's no unsaved draft already
                          setNotesDrafts((prev) => ({
                            ...prev,
                            [lastName]: prev[lastName] !== undefined ? prev[lastName] : (notes ?? ""),
                          }));
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
