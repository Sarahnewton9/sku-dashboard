/**
 * BuySessionsPanel — dedicated panel for managing buy sessions
 * Shows all sessions, allows creating, locking, and exporting each session independently
 */

import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { useCancelledStyles } from "@/hooks/useCancelledStyles";
import { Lock, Download, Plus, Clock, CheckCircle, Package, Trash2, Pencil, FileText, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";
import { displayColour, displayLeather, displayColourLeather } from "@/lib/utils";

export default function BuySessionsPanel() {
  const { mergedStyles } = useCustomSkus();
  const { cancelledSet: cancelledStyleSet } = useCancelledStyles();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [changesReportSessionId, setChangesReportSessionId] = useState<number | null>(null);

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

  // Changes Report
  const changesReportSession = allSessions.find((s) => s.id === changesReportSessionId);
  const changesReportSince = useMemo(() => {
    if (!changesReportSession) return new Date(0);
    return new Date((changesReportSession as any).createdAt ?? 0);
  }, [changesReportSession]);
  const { data: changesData, isLoading: changesLoading } = trpc.changesReport.get.useQuery(
    { since: changesReportSince },
    { enabled: changesReportSessionId !== null }
  );

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

  // Build lookup maps (uses mergedStyles to include custom-style SKUs)
  const styleInfoMap = useMemo(() => {
    const map: Record<string, { category: string; last: string }> = {};
    (mergedStyles as any[]).forEach((s: any) => { map[s.style] = { category: s.category, last: s.last }; });
    return map;
  }, [mergedStyles]);

  // Resolved category: sub-category override > trend flag (CASUAL FLAT) > static category
  const resolvedCategoryMap = useMemo(() => {
    const subCatMap: Record<string, string> = {};
    for (const sc of subCategoryList as any[]) subCatMap[sc.style] = sc.subCategory;
    const trendStyleSet = new Set((trendFlagList as any[]).map((t: any) => t.style));
    const map: Record<string, string> = {};
    (mergedStyles as any[]).forEach((s: any) => {
      if (subCatMap[s.style]) map[s.style] = subCatMap[s.style];
      else if (trendStyleSet.has(s.style)) map[s.style] = "CASUAL FLAT";
      else map[s.style] = s.category;
    });
    return map;
  }, [mergedStyles, subCategoryList, trendFlagList]);

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
      style: string; colourDesc: string; auQty: number; usaQty: number; nycQty: number;
    };

    const allItems = items as Array<{ style: string; colour: string; leather: string; auQty?: number; usaQty?: number; nycQty?: number }>;

    const rows: RowData[] = allItems
      .filter((item) => ((item.auQty ?? 0) + (item.usaQty ?? 0) + (item.nycQty ?? 0)) > 0 && !cancelledStyleSet.has(item.style))
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
          nycQty: item.nycQty ?? 0,
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

    // Determine which optional market columns to include
    const hasUsa = rows.some((r) => r.usaQty > 0);
    const hasNyc = rows.some((r) => r.nycQty > 0);

    // Filename uses session name
    const fileName = `${sessionName} BUY.xlsx`;

    // ── Layout ────────────────────────────────────────────────────────────────────
    // Columns: CATEGORY | LAST | SIZE 11 | STYLE | COLOUR | AU QTY [| USA QTY] [| NYC QTY]
    // Row 1: Title merged across all columns
    // Row 2: Empty spacer
    // Row 3: Bold header row
    // Rows 4+: Data rows (plain white)
    // Last row: TOTAL

    const COLS = 6 + (hasUsa ? 1 : 0) + (hasNyc ? 1 : 0);
    const sheetRows: (string | number)[][] = [];
    const rowTypes: string[] = [];

    const emptyRow = Array(COLS).fill("") as string[];
    const titleText = "TONY BIANCO — SUMMER 26 BUY SHEET";

    // Title
    sheetRows.push([titleText, ...Array(COLS - 1).fill("") as string[]]);
    rowTypes.push("title");
    // Spacer
    sheetRows.push([...emptyRow]);
    rowTypes.push("spacer");
    // Header
    const headerRow = ["CATEGORY", "LAST", "SIZE 11", "STYLE", "COLOUR", "AU QTY"];
    if (hasUsa) headerRow.push("USA QTY");
    if (hasNyc) headerRow.push("NYC QTY");
    sheetRows.push(headerRow);
    rowTypes.push("header");

    // Data rows
    for (const r of rows) {
      const dataRow: (string | number)[] = [r.category, r.last, r.size11, r.style, r.colourDesc, r.auQty];
      if (hasUsa) dataRow.push(r.usaQty > 0 ? r.usaQty : "");
      if (hasNyc) dataRow.push(r.nycQty > 0 ? r.nycQty : "");
      sheetRows.push(dataRow);
      rowTypes.push("data");
    }

    // Total row
    const totalAu = rows.reduce((s, r) => s + r.auQty, 0);
    const totalUsa = rows.reduce((s, r) => s + r.usaQty, 0);
    const totalNyc = rows.reduce((s, r) => s + r.nycQty, 0);
    const totalRow: (string | number)[] = ["TOTAL", "", "", "", " ", totalAu];
    if (hasUsa) totalRow.push(totalUsa);
    if (hasNyc) totalRow.push(totalNyc);
    sheetRows.push(totalRow);
    rowTypes.push("total");

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);

    // Column widths
    const qtyColWidths: { wch: number }[] = [{ wch: 10.875 }]; // AU QTY always
    if (hasUsa) qtyColWidths.push({ wch: 10.875 }); // USA QTY
    if (hasNyc) qtyColWidths.push({ wch: 10.875 }); // NYC QTY
    ws["!cols"] = [
      { wch: 20.875 }, // CATEGORY
      { wch: 14.875 }, // LAST
      { wch: 9.875  }, // SIZE 11
      { wch: 12.875 }, // STYLE
      { wch: 23.875 }, // COLOUR
      ...qtyColWidths,
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
    const qtyColIndices = [5, ...(hasUsa ? [6] : []), ...(hasNyc ? [hasUsa ? 7 : 6] : [])];

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

  function exportChangesReport() {
    if (!changesData) return;
    const today = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
    const sessionLabel = changesReportSession?.name ?? "Session";
    const fileName = `SS26_Changes_Report_${sessionLabel}_${today}.xlsx`;

    type Row = (string | number)[];
    const rows: Row[] = [];

    // Section: Cancelled Styles
    rows.push(["CANCELLED STYLES", "", "", ""]);
    rows.push(["Style", "Category", "Last", "Date Cancelled"]);
    if (changesData.cancelledStyles.length === 0) {
      rows.push(["— None —", "", "", ""]);
    } else {
      for (const s of changesData.cancelledStyles) {
        const info = (mergedStyles as any[]).find((m: any) => m.style === s.style);
        rows.push([
          s.style,
          info?.category ?? "",
          info?.last ?? "",
          new Date(s.cancelledAt).toLocaleDateString("en-AU"),
        ]);
      }
    }
    rows.push(["", "", "", ""]);

    // Section: Cancelled Colours
    rows.push(["CANCELLED COLOURS", "", "", "", ""]);
    rows.push(["Style", "Colour", "Category", "Last", "Date Cancelled"]);
    if (changesData.cancelledSkus.length === 0) {
      rows.push(["— None —", "", "", "", ""]);
    } else {
      for (const s of changesData.cancelledSkus) {
        const info = (mergedStyles as any[]).find((m: any) => m.style === s.style);
        rows.push([
          s.style,
          displayColourLeather(s.colour, s.leather, s.style),
          info?.category ?? "",
          info?.last ?? "",
          new Date(s.cancelledAt).toLocaleDateString("en-AU"),
        ]);
      }
    }
    rows.push(["", "", "", "", ""]);

    // Section: New Colours Added
    rows.push(["NEW COLOURS ADDED", "", "", "", ""]);
    rows.push(["Style", "Colour", "Category", "Last", "Date Added"]);
    if (changesData.newColours.length === 0) {
      rows.push(["— None —", "", "", "", ""]);
    } else {
      for (const s of changesData.newColours) {
        const info = (mergedStyles as any[]).find((m: any) => m.style === s.style);
        rows.push([
          s.style,
          displayColourLeather(s.colour, s.leather, s.style),
          info?.category ?? "",
          info?.last ?? "",
          new Date(s.createdAt).toLocaleDateString("en-AU"),
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];

    // Style section headers
    const sectionHeaderRows = [0, rows.indexOf(["CANCELLED COLOURS", "", "", "", ""]), rows.indexOf(["NEW COLOURS ADDED", "", "", "", ""])];
    for (let r = 0; r < rows.length; r++) {
      const isSectionHeader = sectionHeaderRows.includes(r);
      const isColHeader = rows[r][0] === "Style";
      for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        if (isSectionHeader) {
          ws[addr].s = {
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
            fill: { fgColor: { rgb: "3D2B1F" } },
            alignment: { horizontal: "left", vertical: "center" },
          };
        } else if (isColHeader) {
          ws[addr].s = {
            font: { bold: true, sz: 10 },
            fill: { fgColor: { rgb: "F5E6D3" } },
            alignment: { horizontal: "left", vertical: "center" },
          };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Changes Report");
    XLSX.writeFile(wb, fileName, { bookType: "xlsx", cellStyles: true });
    toast.success(`Exported changes report to ${fileName}`);
  }

  const selectedSession = allSessions.find((s) => s.id === selectedSessionId);
  const selectedTotal = (sessionItems as Array<{ auQty?: number; usaQty?: number; nycQty?: number; qty?: number }>).reduce((sum, item) => sum + (item.auQty ?? 0) + (item.usaQty ?? 0) + (item.nycQty ?? 0), 0);

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

                    {/* Changes Report button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setChangesReportSessionId(session.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      title="View changes made during this session (cancellations & new colours)"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Changes Report
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
                        SKUs in this session ({(sessionItems as Array<{ auQty?: number; usaQty?: number; nycQty?: number }>).filter((i) => ((i.auQty ?? 0) + (i.usaQty ?? 0) + (i.nycQty ?? 0)) > 0).length} with qty)
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
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">NYC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sessionItems as Array<{ style: string; colour: string; leather: string; auQty?: number; usaQty?: number; nycQty?: number }>)
                            .filter((i) => ((i.auQty ?? 0) + (i.usaQty ?? 0) + (i.nycQty ?? 0)) > 0)
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
                                  <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.55 0.18 300)" }}>{item.nycQty ?? 0}</td>
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
                            <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.55 0.18 300)" }}>
                              {(sessionItems as Array<{ nycQty?: number }>).reduce((s, i) => s + (i.nycQty ?? 0), 0)}
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

      {/* Changes Report Modal */}
      {changesReportSessionId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setChangesReportSessionId(null)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            style={{ border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-base font-bold text-foreground">Changes Report</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {changesReportSession?.name} — changes since session started
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportChangesReport}
                  disabled={changesLoading || !changesData}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Excel
                </button>
                <button
                  onClick={() => setChangesReportSessionId(null)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
              {changesLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8">Loading changes…</div>
              ) : !changesData ? (
                <div className="text-sm text-muted-foreground text-center py-8">No data available.</div>
              ) : (
                <>
                  {/* Cancelled Styles */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "oklch(0.45 0.18 25)" }}>Cancelled Styles</h4>
                    {changesData.cancelledStyles.length === 0 ? (
                      <p className="text-xs text-muted-foreground">— None —</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Style</th>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Category</th>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Last</th>
                            <th className="text-left py-1.5 font-semibold text-foreground">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changesData.cancelledStyles.map((s, i) => {
                            const info = (mergedStyles as any[]).find((m: any) => m.style === s.style);
                            return (
                              <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                                <td className="py-1.5 pr-3 font-medium text-foreground">{s.style}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{info?.category ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{info?.last ?? "—"}</td>
                                <td className="py-1.5 text-muted-foreground">{new Date(s.cancelledAt).toLocaleDateString("en-AU")}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Cancelled Colours */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "oklch(0.45 0.18 25)" }}>Cancelled Colours</h4>
                    {changesData.cancelledSkus.length === 0 ? (
                      <p className="text-xs text-muted-foreground">— None —</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Style</th>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Colour</th>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Category</th>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Last</th>
                            <th className="text-left py-1.5 font-semibold text-foreground">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changesData.cancelledSkus.map((s, i) => {
                            const info = (mergedStyles as any[]).find((m: any) => m.style === s.style);
                            return (
                              <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                                <td className="py-1.5 pr-3 font-medium text-foreground">{s.style}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{displayColourLeather(s.colour, s.leather, s.style)}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{info?.category ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{info?.last ?? "—"}</td>
                                <td className="py-1.5 text-muted-foreground">{new Date(s.cancelledAt).toLocaleDateString("en-AU")}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* New Colours Added */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "oklch(0.40 0.15 160)" }}>New Colours Added</h4>
                    {changesData.newColours.length === 0 ? (
                      <p className="text-xs text-muted-foreground">— None —</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Style</th>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Colour</th>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Category</th>
                            <th className="text-left py-1.5 pr-3 font-semibold text-foreground">Last</th>
                            <th className="text-left py-1.5 font-semibold text-foreground">Date Added</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changesData.newColours.map((s, i) => {
                            const info = (mergedStyles as any[]).find((m: any) => m.style === s.style);
                            return (
                              <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                                <td className="py-1.5 pr-3 font-medium text-foreground">{s.style}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{displayColourLeather(s.colour, s.leather, s.style)}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{info?.category ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{info?.last ?? "—"}</td>
                                <td className="py-1.5 text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-AU")}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
