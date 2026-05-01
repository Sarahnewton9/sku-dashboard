/**
 * BuySessionsPanel — dedicated panel for managing buy sessions
 * Shows all sessions, allows creating, locking, and exporting each session independently
 */

import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { Lock, Download, Plus, Clock, CheckCircle, Package, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";
import { displayColour, displayLeather, displayColourLeather } from "@/lib/utils";

export default function BuySessionsPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const { data: allSessions = [], refetch: refetchSessions } = trpc.buy.getSessions.useQuery();
  const { data: activeSession, refetch: refetchActive } = trpc.buy.getActive.useQuery();
  const { data: sessionItems = [], refetch: refetchItems } = trpc.buy.getItems.useQuery(
    { sessionId: selectedSessionId ?? 0 },
    { enabled: selectedSessionId !== null }
  );
  const { data: sessionTotals = {} } = trpc.buy.getSessionTotals.useQuery();
  const { data: skuMetaList = [] } = trpc.sku.getAll.useQuery();
  const { data: styleMetaList = [] } = trpc.style.getAll.useQuery();
  const { data: subCategoryList = [] } = trpc.styleSubCategory.getAll.useQuery();
  const { data: trendFlagList = [] } = trpc.trendFlag.getAll.useQuery();

  const createMutation = trpc.buy.create.useMutation({
    onSuccess: (session) => {
      toast.success(`Session "${session?.name}" created`);
      setShowCreate(false);
      setNewName("");
      refetchSessions();
      refetchActive();
      if (session?.id) setSelectedSessionId(session.id);
    },
    onError: (err) => toast.error(`Failed to create session: ${err.message}`),
  });

  const lockMutation = trpc.buy.lock.useMutation({
    onSuccess: () => {
      toast.success("Session locked — it is now read-only");
      refetchSessions();
      refetchActive();
    },
    onError: (err) => toast.error(`Failed to lock: ${err.message}`),
  });

  const deleteMutation = trpc.buy.delete.useMutation({
    onSuccess: () => {
      toast.success("Session deleted");
      setSelectedSessionId(null);
      refetchSessions();
      refetchActive();
    },
    onError: (err) => toast.error(`Failed to delete: ${err.message}`),
  });

  const renameMutation = trpc.buy.rename.useMutation({
    onSuccess: () => {
      toast.success("Session renamed");
      setEditingSessionId(null);
      refetchSessions();
    },
    onError: (err) => toast.error(`Failed to rename: ${err.message}`),
  });

  function handleRenameStart(sessionId: number, currentName: string, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditingName(currentName);
    setTimeout(() => editInputRef.current?.select(), 50);
  }

  function handleRenameSave(sessionId: number) {
    const name = editingName.trim();
    if (!name) { setEditingSessionId(null); return; }
    renameMutation.mutate({ sessionId, name });
  }

  function handleDelete(sessionId: number, sessionName: string) {
    if (!confirm(`Delete "${sessionName}"? This will permanently remove the session and all its buy quantities. This cannot be undone.`)) return;
    deleteMutation.mutate({ sessionId });
  }

  // Build lookup maps
  const styleInfoMap = useMemo(() => {
    const map: Record<string, { category: string; last: string }> = {};
    skuData.styles.forEach((s) => { map[s.style] = { category: s.category, last: s.last }; });
    return map;
  }, []);

  // Resolved category: sub-category override > trend flag (CASUAL FLAT) > static category
  const resolvedCategoryMap = useMemo(() => {
    const subCatMap: Record<string, string> = {};
    for (const sc of subCategoryList as any[]) subCatMap[sc.style] = sc.subCategory;
    const trendStyleSet = new Set((trendFlagList as any[]).map((t: any) => t.style));
    const map: Record<string, string> = {};
    skuData.styles.forEach((s) => {
      if (subCatMap[s.style]) map[s.style] = subCatMap[s.style];
      else if (trendStyleSet.has(s.style)) map[s.style] = "CASUAL FLAT";
      else map[s.style] = s.category;
    });
    return map;
  }, [subCategoryList, trendFlagList]);

  const skuMetaMap = useMemo(() => {
    const map: Record<string, { costPrice?: number | null; isSize11?: boolean }> = {};
    for (const m of skuMetaList as any[]) {
      map[`${m.style}|${m.colour}|${m.leather}`] = m;
    }
    return map;
  }, [skuMetaList]);

  // Style-level size 11 map: true if ANY SKU for that style has isSize11=true in the DB
  const styleSize11Map = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const m of skuMetaList as any[]) {
      if (m.isSize11) map[m.style] = true;
      else if (!(m.style in map)) map[m.style] = false;
    }
    return map;
  }, [skuMetaList]);

  const styleMetaMap = useMemo(() => {
    const map: Record<string, { rrp?: number | null }> = {};
    for (const m of styleMetaList as any[]) {
      map[m.style] = m;
    }
    return map;
  }, [styleMetaList]);

  function handleCreate() {
    const name = newName.trim() || `Buy — ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}`;
    createMutation.mutate({ name });
  }

  function handleLock(sessionId: number, sessionName: string) {
    if (!confirm(`Lock "${sessionName}"? This cannot be undone — the session will become read-only.`)) return;
    lockMutation.mutate({ sessionId });
  }

  function exportSession(sessionId: number, sessionName: string) {
    // Find the session object to get its date
    const session = allSessions.find((s) => s.id === sessionId);

    // Export only items for this session with AU qty > 0
    const items = sessionId === selectedSessionId ? sessionItems : [];
    if (items.length === 0) {
      toast.error("No items to export — select this session first to load its data, then export.");
      setSelectedSessionId(sessionId);
      return;
    }

    type RowData = {
      category: string; last: string; size11: string;
      style: string; colourDesc: string; auQty: number; usaQty: number;
    };

    const allItems = items as Array<{ style: string; colour: string; leather: string; auQty?: number; usaQty?: number }>;

    const rows: RowData[] = allItems
      .filter((item) => ((item.auQty ?? 0) + (item.usaQty ?? 0)) > 0)
      .map((item) => {
        const styleInfo = styleInfoMap[item.style];
        const colourDesc = displayColourLeather(item.colour, item.leather, item.style);
        return {
          category: resolvedCategoryMap[item.style] ?? styleInfo?.category ?? "",
          last: styleInfo?.last ?? "",
          size11: styleSize11Map[item.style] ? "Y" : "",
          style: item.style,
          colourDesc,
          auQty: item.auQty ?? 0,
          usaQty: item.usaQty ?? 0,
        };
      });

    if (rows.length === 0) {
      toast.error("No SKUs with quantities in this session.");
      return;
    }

    // Sort: category → style → colour
    rows.sort((a, b) => {
      const catCmp = a.category.localeCompare(b.category);
      if (catCmp !== 0) return catCmp;
      const styleCmp = a.style.localeCompare(b.style);
      if (styleCmp !== 0) return styleCmp;
      return a.colourDesc.localeCompare(b.colourDesc);
    });

    // Determine if any USA quantities exist — add USA column only if needed
    const hasUsa = rows.some((r) => r.usaQty > 0);

    // Filename uses session name
    const fileName = `${sessionName} BUY.xlsx`;

    // ── Layout ────────────────────────────────────────────────────────────────────
    // Columns: CATEGORY | LAST | SIZE 11 | STYLE | COLOUR | AU QTY [| USA QTY]
    // Row 1: Title merged across all columns
    // Row 2: Empty spacer
    // Row 3: Bold header row
    // Rows 4+: Data rows (plain white)
    // Last row: TOTAL

    const COLS = hasUsa ? 7 : 6;
    const sheetRows: (string | number)[][] = [];
    const rowTypes: string[] = [];

    const emptyRow = Array(COLS).fill("") as string[];
    const titleText = "TONY BIANCO \u2014 SUMMER 26 BUY SHEET";

    // Title
    sheetRows.push([titleText, ...Array(COLS - 1).fill("") as string[]]);
    rowTypes.push("title");
    // Spacer
    sheetRows.push([...emptyRow]);
    rowTypes.push("spacer");
    // Header
    const headerRow = ["CATEGORY", "LAST", "SIZE 11", "STYLE", "COLOUR", "AU QTY"];
    if (hasUsa) headerRow.push("USA QTY");
    sheetRows.push(headerRow);
    rowTypes.push("header");

    // Data rows
    for (const r of rows) {
      const dataRow: (string | number)[] = [r.category, r.last, r.size11, r.style, r.colourDesc, r.auQty];
      if (hasUsa) dataRow.push(r.usaQty > 0 ? r.usaQty : "");
      sheetRows.push(dataRow);
      rowTypes.push("data");
    }

    // Total row
    const totalAu = rows.reduce((s, r) => s + r.auQty, 0);
    const totalUsa = rows.reduce((s, r) => s + r.usaQty, 0);
    const totalRow: (string | number)[] = ["TOTAL", "", "", "", " ", totalAu];
    if (hasUsa) totalRow.push(totalUsa);
    sheetRows.push(totalRow);
    rowTypes.push("total");

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);

    // Column widths
    ws["!cols"] = [
      { wch: 20.875 }, // CATEGORY
      { wch: 14.875 }, // LAST
      { wch: 9.875  }, // SIZE 11
      { wch: 12.875 }, // STYLE
      { wch: 23.875 }, // COLOUR
      { wch: 10.875 }, // AU QTY
      ...(hasUsa ? [{ wch: 10.875 }] : []), // USA QTY (conditional)
    ];

    // Row heights
    ws["!rows"] = sheetRows.map((_, i) => {
      if (rowTypes[i] === "title")  return { hpt: 27.95 };
      if (rowTypes[i] === "spacer") return { hpt: 15.95 };
      if (rowTypes[i] === "header") return { hpt: 20.1 };
      if (rowTypes[i] === "total")  return { hpt: 18 };
      return { hpt: 15.95 };
    });

    // Merge title across all columns
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }];

    // Styles
    const darkFill = { patternType: "solid", fgColor: { rgb: "1A1A1A" } };
    const whiteFont = { name: "Calibri", sz: 12, bold: true, color: { rgb: "FFFFFF" } };
    const plainFont = { name: "Calibri", sz: 12, bold: false };
    const qtyColIndices = hasUsa ? [5, 6] : [5];

    // Apply styles
    for (let R = 0; R < sheetRows.length; R++) {
      const type = rowTypes[R];
      for (let C = 0; C < COLS; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };

        const isQtyCol = qtyColIndices.includes(C);

        if (type === "title") {
          ws[addr].s = {
            font: whiteFont,
            fill: darkFill,
            alignment: { horizontal: "center", vertical: "center" },
          };
        } else if (type === "spacer") {
          ws[addr].s = {};
        } else if (type === "header") {
          ws[addr].s = {
            font: whiteFont,
            fill: darkFill,
            alignment: { horizontal: "center", vertical: "center" },
          };
        } else if (type === "total") {
          ws[addr].s = {
            font: plainFont,
            alignment: { horizontal: isQtyCol ? "right" : "left", vertical: "center" },
          };
        } else {
          // plain data row — no fill
          ws[addr].s = {
            font: plainFont,
            alignment: { horizontal: isQtyCol ? "right" : "left", vertical: "center" },
          };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Buy Sheet");
    XLSX.writeFile(wb, fileName, { bookType: "xlsx", cellStyles: true });
    toast.success(`Exported ${rows.length} SKUs to ${fileName}`);
  }

  const selectedSession = allSessions.find((s) => s.id === selectedSessionId);
  const selectedTotal = (sessionItems as Array<{ auQty?: number; usaQty?: number; qty?: number }>).reduce((sum, item) => sum + (item.auQty ?? 0) + (item.usaQty ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Buy Sessions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Each session is an independent buy round. Lock a session to preserve it, then create a new one for the next week's buy.
          </p>
        </div>
        {showCreate ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
              placeholder={`Buy — ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}`}
              autoFocus
              className="px-3 py-2 rounded-lg border text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40 w-64"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "#f59e0b", color: "white" }}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-muted"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
        )}
      </div>

      {/* Sessions list */}
      {allSessions.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No buy sessions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first session to start entering buy quantities.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {[...allSessions].reverse().map((session) => {
            const isActive = !session.isLocked;
            const isSelected = session.id === selectedSessionId;

            return (
              <div
                key={session.id}
                className="rounded-xl border p-4 cursor-pointer transition-all"
                style={{
                  borderColor: isSelected ? "oklch(0.72 0.16 65)" : "var(--border)",
                  background: isSelected ? "oklch(0.97 0.04 65 / 0.6)" : "var(--card)",
                  boxShadow: isSelected ? "0 0 0 2px oklch(0.72 0.16 65 / 0.2)" : undefined,
                }}
                onClick={() => setSelectedSessionId(isSelected ? null : session.id)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isActive ? "oklch(0.96 0.08 65)" : "var(--muted)",
                      }}
                    >
                      {isActive
                        ? <Clock className="w-4 h-4" style={{ color: "oklch(0.55 0.14 55)" }} />
                        : <Lock className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {editingSessionId === session.id ? (
                          <input
                            ref={editInputRef}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleRenameSave(session.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); handleRenameSave(session.id); }
                              if (e.key === "Escape") { e.stopPropagation(); setEditingSessionId(null); }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="font-semibold text-foreground bg-transparent border-b border-foreground outline-none min-w-0 w-48"
                          />
                        ) : (
                          <span className="font-semibold text-foreground truncate">{session.name}</span>
                        )}
                        <button
                          onClick={(e) => handleRenameStart(session.id, session.name, e)}
                          className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          title="Rename session"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                            style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>
                            Active
                          </span>
                        )}
                        {session.isLocked && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                            Locked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          Created {new Date(session.createdAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        {session.isLocked && session.lockedAt && (
                          <span className="text-xs text-muted-foreground">
                            · Locked {new Date(session.lockedAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        )}
                        {((sessionTotals as Record<number, { au: number; usa: number; total: number }>)[session.id]?.total ?? 0) > 0 && (
                          <span className="text-xs font-semibold" style={{ color: "oklch(0.50 0.14 55)" }}>
                            · {(sessionTotals as Record<number, { au: number; usa: number; total: number }>)[session.id].total} pairs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Lock button — only for active sessions */}
                    {isActive && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleLock(session.id, session.name); }}
                        disabled={lockMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                        style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Lock
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(session.id, session.name); }}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                      style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                      title="Delete this session and all its quantities"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>

                    {/* Export button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); exportSession(session.id, session.name); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Buy Sheet
                    </button>
                  </div>
                </div>

                {/* Expanded session items preview */}
                {isSelected && sessionItems.length > 0 && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        SKUs in this session ({(sessionItems as Array<{ auQty?: number; usaQty?: number }>).filter((i) => ((i.auQty ?? 0) + (i.usaQty ?? 0)) > 0).length} with qty)
                      </span>
                      <span className="text-sm font-bold" style={{ color: "oklch(0.50 0.14 55)" }}>
                        {selectedTotal} total pairs
                      </span>
                    </div>
                    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">Style</th>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">Colour</th>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">Leather</th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">AU</th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">USA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sessionItems as Array<{ style: string; colour: string; leather: string; auQty?: number; usaQty?: number }>)
                            .filter((i) => ((i.auQty ?? 0) + (i.usaQty ?? 0)) > 0)
                            .sort((a, b) => a.style.localeCompare(b.style))
                            .map((item) => {
                              return (
                                <tr key={`${item.style}-${item.colour}-${item.leather}`}
                                  className="border-t" style={{ borderColor: "var(--border)" }}>
                                  <td className="px-3 py-2 font-medium text-foreground">{item.style}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{displayColour(item.colour, item.leather)}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{displayLeather(item.leather || "", item.style) || "—"}</td>
                                  <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.50 0.14 55)" }}>{item.auQty ?? 0}</td>
                                  <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.45 0.15 240)" }}>{item.usaQty ?? 0}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                            <td colSpan={3} className="px-3 py-2 font-semibold text-foreground text-xs">Total</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.50 0.14 55)" }}>
                              {(sessionItems as Array<{ auQty?: number }>).reduce((s, i) => s + (i.auQty ?? 0), 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.45 0.15 240)" }}>
                              {(sessionItems as Array<{ usaQty?: number }>).reduce((s, i) => s + (i.usaQty ?? 0), 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
                {isSelected && sessionItems.length === 0 && (
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground" style={{ borderColor: "var(--border)" }}>
                    No items in this session yet. Go to the By Style tab to enter quantities.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
