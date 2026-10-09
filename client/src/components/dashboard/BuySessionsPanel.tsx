/**
 * BuySessionsPanel — dedicated panel for managing buy sessions
 * Shows all sessions, allows creating, locking, and exporting each session independently
 */

import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { useCancelledStyles } from "@/hooks/useCancelledStyles";
import { Lock, Download, Mail, Plus, Clock, CheckCircle, Package, Trash2, Pencil, FileText, X, Send } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";
import { displayColourLeather } from "@/lib/utils";
import { formatSkuExportLabel } from "@shared/skuExportLabel";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";
import { getBuyMarketTotal, getStoredBuyMarketTotals } from "@shared/buyMarketTotals";
import { isActiveBuySheetSessionItem } from "@shared/buySheetSkuExclusions";
import { buildCancelledSkuKeySet } from "@shared/cancelledSkuIdentity";
import { buildMarkdownSkuSet } from "@shared/markdownSku";
import { formatBuyShare, getBuyShare } from "@shared/buyShare";
import {
  buildAp21SkuColourDescriptionMap,
  resolveAp21SkuColourDescription,
} from "@shared/ap21SkuColourDescription";
import { hasSize11ForAllColourways } from "@shared/size11";
import { resolveStyleCategory } from "@shared/styleCategory";
import { useSeason } from "@/contexts/SeasonContext";
import { getSeasonDisplayLabel, getSeasonFileLabel } from "@shared/seasonLabel";
import { EmailExportDialog } from "./EmailExportDialog";
import { workbookToEmailAttachment } from "@/lib/exportEmailAttachment";

export default function BuySessionsPanel() {
  const { season } = useSeason();
  const { mergedStyles, mergedRawSkus } = useCustomSkus();
  const { cancelledSet: cancelledStyleSet } = useCancelledStyles(season);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [changesReportSessionId, setChangesReportSessionId] = useState<number | null>(null);
  const [emailSession, setEmailSession] = useState<{ id: number; name: string } | null>(null);
  const [changesEmailOpen, setChangesEmailOpen] = useState(false);

  const { data: allSessions = [], refetch: refetchSessions } = trpc.buy.getSessions.useQuery({ season });
  const { data: activeSession, refetch: refetchActive } = trpc.buy.getActive.useQuery({ season });
  const { data: sessionItems = [], refetch: refetchItems } = trpc.buy.getItems.useQuery(
    { sessionId: selectedSessionId ?? 0 },
    { enabled: selectedSessionId !== null }
  );
  const { data: sessionTotals = {} } = trpc.buy.getSessionTotals.useQuery({ season });
  const { data: cancelledSkuList = [] } = trpc.cancelledSku.list.useQuery({ season });
  const { data: exactCancelledSkuList = [] } = trpc.cancelledSku.listExact.useQuery({ season });
  const { data: markdownSkuList = [] } = trpc.markdown.list.useQuery();
  const { data: skuMetaList = [] } = trpc.sku.getAll.useQuery();
  const { data: styleMetaList = [] } = trpc.style.getAll.useQuery();
  const { data: subCategoryList = [] } = trpc.styleSubCategory.getAll.useQuery();
  const { data: trendFlagList = [] } = trpc.trendFlag.getAll.useQuery();
  const { data: ap21SkuColourDescriptionRows = [] } = trpc.ap21SkuColour.getAll.useQuery();

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
  const sendToTeamMutation = trpc.changesReport.sendToTeam.useMutation({
    onSuccess: (result) => {
      if (result.method === "smtp") {
        toast.success("Changes report sent to team via email");
      } else {
        toast.success("Changes report sent as notification (no SMTP configured)");
      }
    },
    onError: (err) => toast.error(`Failed to send: ${err.message}`),
  });

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

  // Keep each Upper 1/Upper 2 combination separate in the export lookup.
  const skuExportLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const sku of mergedRawSkus as Array<{
      style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null;
    }>) {
      map[getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2)] = formatSkuExportLabel(sku);
    }
    return map;
  }, [mergedRawSkus]);

  const cancelledBuySheetSkuKeys = useMemo(
    () => buildCancelledSkuKeySet([
      ...(cancelledSkuList as Array<{ style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null }>),
      ...(exactCancelledSkuList as Array<{ style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null }>),
    ]),
    [cancelledSkuList, exactCancelledSkuList],
  );

  const cancelledBuySheetStyleNames = useMemo(
    () => new Set(Array.from(cancelledStyleSet).map((style) => style.trim().toUpperCase())),
    [cancelledStyleSet],
  );

  const markdownBuySheetSkuSet = useMemo(
    () => buildMarkdownSkuSet(markdownSkuList as Array<{ styleCode: string; colour: string; status: string }>),
    [markdownSkuList],
  );

  function isBuySheetActiveItem(item: {
    style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null;
  }): boolean {
    return isActiveBuySheetSessionItem(item, {
      cancelledStyleNames: cancelledBuySheetStyleNames,
      cancelledSkuKeys: cancelledBuySheetSkuKeys,
      markdownSkuSet: markdownBuySheetSkuSet,
    });
  }

  const ap21SkuColourDescriptionMap = useMemo(
    () => buildAp21SkuColourDescriptionMap(ap21SkuColourDescriptionRows as any[]),
    [ap21SkuColourDescriptionRows],
  );

  // An explicit sub-category wins. Trend labels only collapse genuine Ballet
  // Flat / Loafer bases into Casual Flat; a Toe Cap or Slingback trend must
  // never turn a Dress Shoe into a Casual Flat in a Buy Sheet.
  const resolvedCategoryMap = useMemo(() => {
    const subCatMap: Record<string, string> = {};
    for (const sc of subCategoryList as any[]) subCatMap[sc.style] = sc.subCategory;
    const trendsByStyle: Record<string, { trendFlag?: string | null; trends?: string[] | null }> = {};
    for (const trend of trendFlagList as any[]) trendsByStyle[trend.style] = trend;
    const map: Record<string, string> = {};
    (mergedStyles as any[]).forEach((s: any) => {
      const trend = trendsByStyle[s.style];
      map[s.style] = resolveStyleCategory({
        baseCategory: s.category,
        subCategory: subCatMap[s.style],
        trendFlag: trend?.trendFlag,
        trends: trend?.trends,
      });
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

  // Style-level Size 11 applies only when every active colourway is confirmed.
  const styleSize11Map = useMemo(() => {
    const flagsByStyle: Record<string, boolean[]> = {};
    for (const sku of mergedRawSkus as Array<{ style: string; colour: string; leather: string }>) {
      const key = `${sku.style}|${sku.colour}|${sku.leather}`;
      (flagsByStyle[sku.style] ??= []).push(skuMetaMap[key]?.isSize11 === true);
    }
    const map: Record<string, boolean> = {};
    for (const [style, flags] of Object.entries(flagsByStyle)) {
      map[style] = hasSize11ForAllColourways(flags, Boolean);
    }
    return map;
  }, [mergedRawSkus, skuMetaMap]);

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

  function buildBuySessionWorkbook(sessionId: number, sessionName: string) {
    // Find the session object to get its date
    const session = allSessions.find((s) => s.id === sessionId);

    // Export only items for this session with AU qty > 0
    const items = sessionId === selectedSessionId ? sessionItems : [];
    if (items.length === 0) {
      throw new Error("Select this session first to load its data, then email or export the buy sheet.");
    }

    type RowData = {
      category: string; last: string; size11: string;
      style: string; colourDesc: string; ap21SkuColour: string; auQty: number; usaQty: number; nycQty: number; laQty: number; totalQty: number;
    };

    const allItems = items as Array<{
      style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null;
      qty?: number; auQty?: number; usaQty?: number; nycQty?: number; laQty?: number;
    }>;

    const rows: RowData[] = allItems
      .filter((item) => {
        const { au, usa, nyc, la } = getStoredBuyMarketTotals(item);
        return (au + usa + nyc + la) > 0 && isBuySheetActiveItem(item);
      })
      .map((item) => {
        const styleInfo = styleInfoMap[item.style];
        const colourDesc = skuExportLabelMap[getSkuCompositeIdentity(
          item.style, item.colour, item.leather, item.colour2, item.leather2,
        )]
          ?? displayColourLeather(item.colour, item.leather, item.style);
        const { au: auQty, usa: usaQty, nyc: nycQty, la: laQty } = getStoredBuyMarketTotals(item);
        return {
          category: resolvedCategoryMap[item.style] ?? styleInfo?.category ?? "",
          last: styleInfo?.last ?? "",
          size11: styleSize11Map[item.style] ? "Y" : "",
          style: item.style,
          colourDesc,
          // Exact factory-approved AP21 wording, scoped to the full Upper 1 +
          // Upper 2 identity. Development wording remains a safe fallback.
          ap21SkuColour: resolveAp21SkuColourDescription(item, colourDesc, ap21SkuColourDescriptionMap),
          auQty,
          usaQty,
          nycQty,
          laQty,
          totalQty: auQty + usaQty + nycQty + laQty,
        };
      });

    if (rows.length === 0) {
      throw new Error("No active SKUs with quantities in this session. Deleted or cancelled SKUs have been excluded.");
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
    const hasLa = rows.some((r) => r.laQty > 0);

    // Filename includes the active range season and session name.
    const fileName = `${getSeasonFileLabel(season)}_${sessionName}_BUY.xlsx`;

    // ── Layout ────────────────────────────────────────────────────────────────────
    // Columns: CATEGORY | LAST | SIZE 11 | STYLE | COLOUR | AP21 SKU COLOUR | market qty columns | TOTAL QTY | % BOUGHT
    // Row 1: Title merged across all columns
    // Row 2: Empty spacer
    // Row 3: Bold header row
    // Rows 4+: Data rows (plain white)
    // Last row: TOTAL

    const COLS = 9 + (hasUsa ? 1 : 0) + (hasNyc ? 1 : 0) + (hasLa ? 1 : 0);
    const sheetRows: (string | number)[][] = [];
    const rowTypes: string[] = [];

    const emptyRow = Array(COLS).fill("") as string[];
    const titleText = `TONY BIANCO — ${getSeasonDisplayLabel(season).toUpperCase()} BUY SHEET`;

    // Title
    sheetRows.push([titleText, ...Array(COLS - 1).fill("") as string[]]);
    rowTypes.push("title");
    // Spacer
    sheetRows.push([...emptyRow]);
    rowTypes.push("spacer");
    // Header
    const headerRow = ["CATEGORY", "LAST", "SIZE 11", "STYLE", "COLOUR", "AP21 SKU COLOUR", "AU QTY"];
    if (hasUsa) headerRow.push("USA QTY");
    if (hasNyc) headerRow.push("NYC QTY");
    if (hasLa) headerRow.push("LA QTY");
    headerRow.push("TOTAL QTY", "% BOUGHT");
    sheetRows.push(headerRow);
    rowTypes.push("header");

    // Data rows
    const sessionTotal = rows.reduce((sum, row) => sum + row.totalQty, 0);
    for (const r of rows) {
      const dataRow: (string | number)[] = [r.category, r.last, r.size11, r.style, r.colourDesc, r.ap21SkuColour, r.auQty];
      if (hasUsa) dataRow.push(r.usaQty > 0 ? r.usaQty : "");
      if (hasNyc) dataRow.push(r.nycQty > 0 ? r.nycQty : "");
      if (hasLa) dataRow.push(r.laQty > 0 ? r.laQty : "");
      dataRow.push(r.totalQty, getBuyShare(r.totalQty, sessionTotal) / 100);
      sheetRows.push(dataRow);
      rowTypes.push("data");
    }

    // Total row
    const totalAu = rows.reduce((s, r) => s + r.auQty, 0);
    const totalUsa = rows.reduce((s, r) => s + r.usaQty, 0);
    const totalNyc = rows.reduce((s, r) => s + r.nycQty, 0);
    const totalLa = rows.reduce((s, r) => s + r.laQty, 0);
    const totalRow: (string | number)[] = ["TOTAL", "", "", "", "", "", totalAu];
    if (hasUsa) totalRow.push(totalUsa);
    if (hasNyc) totalRow.push(totalNyc);
    if (hasLa) totalRow.push(totalLa);
    totalRow.push(sessionTotal, 1);
    sheetRows.push(totalRow);
    rowTypes.push("total");

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);

    // Column widths
    const qtyColWidths: { wch: number }[] = [{ wch: 10.875 }]; // AU QTY always
    if (hasUsa) qtyColWidths.push({ wch: 10.875 }); // USA QTY
    if (hasNyc) qtyColWidths.push({ wch: 10.875 }); // NYC QTY
    if (hasLa) qtyColWidths.push({ wch: 10.875 }); // LA QTY
    qtyColWidths.push({ wch: 11.875 }, { wch: 11.875 }); // TOTAL QTY, % BOUGHT
    ws["!cols"] = [
      { wch: 20.875 }, // CATEGORY
      { wch: 14.875 }, // LAST
      { wch: 9.875  }, // SIZE 11
      { wch: 12.875 }, // STYLE
      { wch: 23.875 }, // COLOUR
      { wch: 25.875 }, // AP21 SKU COLOUR
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
    const qtyColIndices = Array.from({ length: COLS - 6 }, (_, index) => 6 + index);

    // Apply styles
    for (let R = 0; R < sheetRows.length; R++) {
      const type = rowTypes[R];
      for (let C = 0; C < COLS; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };

        const isQtyCol = qtyColIndices.includes(C);

        // The final column is stored as a decimal for Excel's native percentage formatting.
        if (C === COLS - 1 && (type === "data" || type === "total")) {
          ws[addr].z = "0.0%";
        }

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
    return { wb, fileName, rowCount: rows.length };
  }

  function exportSession(sessionId: number, sessionName: string) {
    try {
      const { wb, fileName, rowCount } = buildBuySessionWorkbook(sessionId, sessionName);
    XLSX.writeFile(wb, fileName, { bookType: "xlsx", cellStyles: true });
      toast.success(`Exported ${rowCount} SKUs to ${fileName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export the buy sheet.");
      if (sessionId !== selectedSessionId) setSelectedSessionId(sessionId);
    }
  }

  function buildChangesReportWorkbook() {
    if (!changesData) throw new Error("Changes report data is still loading.");
    const today = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
    const sessionLabel = changesReportSession?.name ?? "Session";
    const fileName = `${getSeasonFileLabel(season)}_Changes_Report_${sessionLabel}_${today}.xlsx`;

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
    rows.push(["Style", "Colour / Leather", "Category", "Last", "Date Added"]);
    if (changesData.newColours.length === 0) {
      rows.push(["— None —", "", "", "", ""]);
    } else {
      for (const s of changesData.newColours) {
        const info = (mergedStyles as any[]).find((m: any) => m.style === s.style);
        rows.push([
          s.style,
          formatSkuExportLabel(s),
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
    return { wb, fileName, sessionLabel };
  }

  function exportChangesReport() {
    try {
      const { wb, fileName } = buildChangesReportWorkbook();
    XLSX.writeFile(wb, fileName, { bookType: "xlsx", cellStyles: true });
      toast.success(`Exported changes report to ${fileName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export changes report.");
    }
  }

  const selectedSession = allSessions.find((s) => s.id === selectedSessionId);
  type SessionPreviewItem = {
    style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null;
    auQty?: number; usaQty?: number; nycQty?: number; laQty?: number; qty?: number;
  };
  const getSessionItemMarkets = (item: SessionPreviewItem) => getStoredBuyMarketTotals(item);
  const getSessionItemTotal = (item: SessionPreviewItem) => getBuyMarketTotal(getSessionItemMarkets(item));
  const selectedRecordedSessionItems = sessionItems as SessionPreviewItem[];
  const selectedActiveSessionItems = selectedRecordedSessionItems.filter((item) => isBuySheetActiveItem(item));
  const selectedTotal = selectedActiveSessionItems.reduce(
    (sum, item) => sum + getSessionItemTotal(item),
    0,
  );
  const selectedRecordedTotal = selectedRecordedSessionItems.reduce(
    (sum, item) => sum + getSessionItemTotal(item),
    0,
  );
  const selectedExcludedTotal = selectedRecordedTotal - selectedTotal;

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
                            · {(sessionTotals as Record<number, { au: number; usa: number; total: number }>)[session.id].total} recorded pairs
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedSessionId !== session.id) {
                          setSelectedSessionId(session.id);
                          toast.message("Session selected — use Email Buy Sheet once its SKUs have loaded.");
                          return;
                        }
                        setEmailSession({ id: session.id, name: session.name });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email Buy Sheet
                    </button>
                  </div>
                </div>

                {/* Expanded session items preview */}
                {isSelected && selectedActiveSessionItems.length > 0 && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Buy Sheet SKUs in this session ({selectedActiveSessionItems.filter((item) => getSessionItemTotal(item) > 0).length} with qty)
                      </span>
                      <span className="text-sm font-bold" style={{ color: "oklch(0.50 0.14 55)" }}>
                        {selectedTotal} Buy Sheet pairs
                      </span>
                    </div>
                    {selectedExcludedTotal > 0 && (
                      <p className="mb-3 text-xs text-muted-foreground">
                        Recorded total: <strong className="text-foreground">{selectedRecordedTotal.toLocaleString()} pairs</strong>
                        {" · "}{selectedExcludedTotal.toLocaleString()} cancelled or deleted pairs excluded from the current Buy Sheet.
                      </p>
                    )}
                    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">Style</th>
                            <th colSpan={2} className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">Colour / Leather</th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">AU</th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">USA</th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">NYC</th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">LA</th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">% Bought</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedActiveSessionItems
                            .filter((item) => getSessionItemTotal(item) > 0)
                            .sort((a, b) => a.style.localeCompare(b.style))
                            .map((item) => {
                              const markets = getSessionItemMarkets(item);
                              const itemTotal = getSessionItemTotal(item);
                              return (
                                <tr key={getSkuCompositeIdentity(item.style, item.colour, item.leather, item.colour2, item.leather2)}
                                  className="border-t" style={{ borderColor: "var(--border)" }}>
                                  <td className="px-3 py-2 font-medium text-foreground">{item.style}</td>
                                  <td colSpan={2} className="px-3 py-2 text-muted-foreground">{formatSkuExportLabel(item)}</td>
                                  <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.50 0.14 55)" }}>{markets.au}</td>
                                  <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.45 0.15 240)" }}>{markets.usa}</td>
                                  <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.55 0.18 300)" }}>{markets.nyc}</td>
                                  <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.45 0.16 160)" }}>{markets.la}</td>
                                  <td className="px-3 py-2 text-right font-bold tabular-nums text-foreground">{itemTotal}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatBuyShare(itemTotal, selectedTotal)}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                            <td colSpan={3} className="px-3 py-2 font-semibold text-foreground text-xs">Total</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.50 0.14 55)" }}>
                              {selectedActiveSessionItems.reduce((sum, item) => sum + getSessionItemMarkets(item).au, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.45 0.15 240)" }}>
                              {selectedActiveSessionItems.reduce((sum, item) => sum + getSessionItemMarkets(item).usa, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.55 0.18 300)" }}>
                              {selectedActiveSessionItems.reduce((sum, item) => sum + getSessionItemMarkets(item).nyc, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: "oklch(0.45 0.16 160)" }}>
                              {selectedActiveSessionItems.reduce((sum, item) => sum + getSessionItemMarkets(item).la, 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums text-foreground">{selectedTotal}</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums text-muted-foreground">100.0%</td>
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
                {isSelected && sessionItems.length > 0 && selectedActiveSessionItems.length === 0 && (
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground" style={{ borderColor: "var(--border)" }}>
                    All quantities in this session belong to cancelled or deleted SKUs, so they are excluded from the current Buy Sheet.
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
                  onClick={() => setChangesEmailOpen(true)}
                  disabled={changesLoading || !changesData}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email Report
                </button>
                <button
                  onClick={() => {
                    if (!changesData || !changesReportSession) return;
                    sendToTeamMutation.mutate({
                      since: changesReportSince,
                      sessionName: changesReportSession.name ?? "Session",
                    });
                  }}
                  disabled={changesLoading || !changesData || sendToTeamMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  title="Send HTML email to fatih, amanda, anthony, alison, sarah.newton @tonybianco.com"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendToTeamMutation.isPending ? "Sending…" : "Send to Team"}
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
      {emailSession && (
        <EmailExportDialog
          open={true}
          onOpenChange={(open) => { if (!open) setEmailSession(null); }}
          exportType="Buy Sheet"
          exportScope={emailSession.name}
          season={getSeasonFileLabel(season)}
          defaultSubject={`TONY BIANCO ${getSeasonFileLabel(season)} — BUY ${emailSession.name.toUpperCase()}`}
          buildAttachment={async () => {
            const { wb, fileName } = buildBuySessionWorkbook(emailSession.id, emailSession.name);
            return workbookToEmailAttachment(wb, fileName);
          }}
        />
      )}
      {changesEmailOpen && changesReportSession && (
        <EmailExportDialog
          open={true}
          onOpenChange={(open) => { if (!open) setChangesEmailOpen(false); }}
          exportType="Buy Changes Report"
          exportScope={changesReportSession.name}
          season={getSeasonFileLabel(season)}
          defaultSubject={`TONY BIANCO ${getSeasonFileLabel(season)} — BUY CHANGES ${changesReportSession.name.toUpperCase()}`}
          buildAttachment={async () => {
            const { wb, fileName } = buildChangesReportWorkbook();
            return workbookToEmailAttachment(wb, fileName);
          }}
        />
      )}
    </div>
  );
}
