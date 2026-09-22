import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Ban,
  Download,
  ImageIcon,
  PackagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSeason } from "@/contexts/SeasonContext";
import { getSeasonDisplayLabel, getSeasonFileLabel } from "@shared/seasonLabel";
import {
  getHandbagSeasonality,
  HANDBAG_SEASONALITY_OPTIONS,
  normalizeHandbagSeasonality,
} from "@shared/handbagSeasonality";
import { formatHandbagDisplayLabel } from "@shared/handbagDisplayLabel";

type HandbagSku = {
  id: number;
  style: string;
  colour: string;
  material: string | null;
  status: string;
  seasonality: string | null;
  section: string | null;
  notes: string | null;
  rrp: number | null;
  cost: number | null;
  imageUrl: string | null;
  styleImageUrl: string | null;
  parentSeasonality: string | null;
  parentNotes: string | null;
};

type HandbagParent = {
  id: number;
  style: string;
  seasonality: string | null;
  notes: string | null;
  styleImageUrl: string | null;
};

type BuySession = { id: number; name: string; createdAt: Date };
type BuyItem = {
  id: number;
  sessionId: number;
  style: string;
  colour: string;
  auQty: number;
  usaQty: number;
  nycQty: number;
};

type HandbagStyleGroup = {
  style: string;
  parent: HandbagParent | null;
  skus: HandbagSku[];
  seasonality: string;
  notes: string;
  imageUrl: string | null;
};

type StyleDialogState = { mode: "add" | "edit"; group?: HandbagStyleGroup } | null;
type SkuDialogState = { mode: "add" | "edit"; style: string; sku?: HandbagSku } | null;

function money(value: number | null) {
  return value == null ? "—" : `$${value.toFixed(2)}`;
}

function createTotalsKey(style: string, colour: string) {
  return `${style}\u0000${colour}`;
}

function HandbagImage({
  style,
  colour,
  imageUrl,
  kind,
}: {
  style: string;
  colour?: string;
  imageUrl: string | null;
  kind: "style" | "sku";
}) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const uploadStyleImage = trpc.handbag.uploadStyleImage.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      utils.handbag.listParents.invalidate();
      toast.success("Style image uploaded");
    },
    onError: () => toast.error("Image upload failed"),
    onSettled: () => setUploading(false),
  });
  const uploadSkuImage = trpc.handbag.uploadImage.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      toast.success("SKU image uploaded");
    },
    onError: () => toast.error("Image upload failed"),
    onSettled: () => setUploading(false),
  });
  const removeStyleImage = trpc.handbag.removeStyleImage.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      utils.handbag.listParents.invalidate();
      toast.success("Style image removed");
    },
  });
  const removeSkuImage = trpc.handbag.removeImage.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      toast.success("SKU image removed");
    },
  });

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageBase64 = (event.target?.result as string).split(",")[1];
      if (kind === "style") {
        uploadStyleImage.mutate({ style, imageBase64, mimeType: file.type });
      } else if (colour) {
        uploadSkuImage.mutate({ style, colour, imageBase64, mimeType: file.type });
      }
    };
    reader.readAsDataURL(file);
  }

  const size = kind === "style" ? "w-14 h-14" : "w-11 h-11";
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = "";
        }}
      />
      {imageUrl ? (
        <div className={`relative group ${size} shrink-0`}>
          <img
            src={imageUrl}
            alt={colour ? `${style} ${colour}` : style}
            className={`${size} object-contain rounded-lg border border-border bg-white cursor-pointer`}
            onClick={() => setLightbox(true)}
          />
          <button
            className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center"
            onClick={() => kind === "style"
              ? removeStyleImage.mutate({ style })
              : colour && removeSkuImage.mutate({ style, colour })}
            title="Remove image"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={`${size} shrink-0 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/50 transition-colors disabled:opacity-50`}
          title={`Upload ${kind} image`}
        >
          {uploading ? <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </button>
      )}
      {lightbox && imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setLightbox(false)}>
          <img src={imageUrl} alt={style} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}

function QtyInput({
  value,
  disabled,
  onSave,
}: {
  value: number;
  disabled: boolean;
  onSave: (nextValue: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <Input
      type="number"
      min="0"
      value={draft}
      disabled={disabled}
      onFocus={() => setDraft(String(value))}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const nextValue = Math.max(0, Number.parseInt(draft, 10) || 0);
        if (nextValue !== value) onSave(nextValue);
        setDraft(String(nextValue));
      }}
      className="h-8 w-16 text-center text-xs disabled:opacity-45"
    />
  );
}

export default function HandbagsTab() {
  const utils = trpc.useUtils();
  const { season } = useSeason();
  const { data: skuRows = [], isLoading: isLoadingSkus } = trpc.handbag.listStyles.useQuery();
  const { data: parents = [] } = trpc.handbag.listParents.useQuery();
  const { data: sessions = [] } = trpc.handbag.listSessions.useQuery();
  const { data: buyItems = [] } = trpc.handbag.listBuyItems.useQuery({});

  const [search, setSearch] = useState("");
  const [seasonalityFilter, setSeasonalityFilter] = useState("All");
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const [styleDialog, setStyleDialog] = useState<StyleDialogState>(null);
  const [skuDialog, setSkuDialog] = useState<SkuDialogState>(null);
  const [styleDraft, setStyleDraft] = useState({ style: "", seasonality: "W27", notes: "" });
  const [skuDraft, setSkuDraft] = useState({ colour: "", material: "", seasonality: "W27", rrp: "", cost: "", notes: "" });

  const createStyle = trpc.handbag.createStyle.useMutation({
    onSuccess: () => {
      utils.handbag.listParents.invalidate();
      utils.handbag.listStyles.invalidate();
      toast.success("Handbag style added");
    },
    onError: (error) => toast.error(error.message || "Unable to add handbag style"),
  });
  const updateStyleDetails = trpc.handbag.updateStyleDetails.useMutation({
    onSuccess: () => {
      utils.handbag.listParents.invalidate();
      utils.handbag.listStyles.invalidate();
      toast.success("Style details saved");
    },
    onError: () => toast.error("Unable to save style details"),
  });
  const upsertSku = trpc.handbag.upsertStyle.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      utils.handbag.listParents.invalidate();
      toast.success("Handbag SKU saved");
    },
    onError: (error) => toast.error(error.message || "Unable to save handbag SKU"),
  });
  const updateSku = trpc.handbag.updateSku.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      utils.handbag.listParents.invalidate();
      utils.handbag.listBuyItems.invalidate();
    },
    onError: (error) => toast.error(error.message || "Unable to update handbag SKU"),
  });
  const cancelSku = trpc.handbag.cancelSku.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      toast.success("Handbag SKU cancelled");
    },
    onError: (error) => toast.error(error.message || "Unable to cancel handbag SKU"),
  });
  const restoreSku = trpc.handbag.restoreSku.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      toast.success("Handbag SKU restored");
    },
    onError: (error) => toast.error(error.message || "Unable to restore handbag SKU"),
  });
  const updateBuyItem = trpc.handbag.upsertBuyItem.useMutation({
    onSuccess: () => utils.handbag.listBuyItems.invalidate(),
    onError: () => toast.error("Unable to save buy quantity"),
  });
  const createSession = trpc.handbag.createSession.useMutation({
    onSuccess: (newSession) => {
      utils.handbag.listSessions.invalidate();
      setSelectedSessionId(newSession.id);
      setNewSessionName("");
      toast.success(`Buy session “${newSession.name}” created`);
    },
    onError: () => toast.error("Unable to create buy session"),
  });

  const parentByStyle = useMemo(() => {
    const map = new Map<string, HandbagParent>();
    for (const parent of parents as HandbagParent[]) map.set(parent.style, parent);
    return map;
  }, [parents]);

  const groups = useMemo(() => {
    const map = new Map<string, HandbagSku[]>();
    for (const sku of skuRows as HandbagSku[]) {
      const rows = map.get(sku.style) ?? [];
      rows.push(sku);
      map.set(sku.style, rows);
    }
    for (const parent of parents as HandbagParent[]) {
      if (!map.has(parent.style)) map.set(parent.style, []);
    }

    return Array.from(map.entries()).map(([style, skus]) => {
      const parent = parentByStyle.get(style) ?? null;
      const seasonality = parent?.seasonality
        ?? skus.find((sku) => getHandbagSeasonality(sku, null) !== "Unassigned")?.seasonality
        ?? skus.find((sku) => sku.section)?.section
        ?? "Unassigned";
      return {
        style,
        parent,
        skus: [...skus].sort((a, b) => a.colour.localeCompare(b.colour)),
        seasonality,
        notes: parent?.notes ?? skus.find((sku) => sku.parentNotes)?.parentNotes ?? "",
        imageUrl: parent?.styleImageUrl ?? skus.find((sku) => sku.styleImageUrl)?.styleImageUrl ?? null,
      } satisfies HandbagStyleGroup;
    }).sort((a, b) => a.style.localeCompare(b.style));
  }, [skuRows, parents, parentByStyle]);

  const visibleGroups = useMemo(() => {
    const query = search.trim().toUpperCase();
    return groups.map((group) => {
      const rangeSkus = showCancelled ? group.skus : group.skus.filter((sku) => sku.status !== "cancelled");
      const matchingSkus = rangeSkus.filter((sku) => {
        const skuSeasonality = getHandbagSeasonality(sku, group.seasonality);
        const matchesSearch = !query || [group.style, sku.colour, sku.material ?? "", sku.notes ?? "", skuSeasonality]
          .some((value) => value.toUpperCase().includes(query));
        const matchesSeasonality = seasonalityFilter === "All" || skuSeasonality === seasonalityFilter;
        return matchesSearch && matchesSeasonality;
      });
      const styleMatchesSearch = !query || [group.style, group.notes, group.seasonality]
        .some((value) => value.toUpperCase().includes(query));
      const parentMatchesSeasonality = seasonalityFilter === "All" || group.seasonality === seasonalityFilter;
      if (matchingSkus.length > 0) return { ...group, skus: matchingSkus };
      if (rangeSkus.length === 0 && group.skus.length === 0 && styleMatchesSearch && parentMatchesSeasonality) return group;
      return null;
    }).filter((group): group is HandbagStyleGroup => group !== null);
  }, [groups, search, seasonalityFilter, showCancelled]);

  const buyTotals = useMemo(() => {
    const totals = new Map<string, { auQty: number; usaQty: number; nycQty: number; total: number }>();
    for (const item of buyItems as BuyItem[]) {
      const key = createTotalsKey(item.style, item.colour);
      const current = totals.get(key) ?? { auQty: 0, usaQty: 0, nycQty: 0, total: 0 };
      current.auQty += item.auQty;
      current.usaQty += item.usaQty;
      current.nycQty += item.nycQty;
      current.total += item.auQty + item.usaQty + item.nycQty;
      totals.set(key, current);
    }
    return totals;
  }, [buyItems]);

  const activeBuyItems = useMemo(() => {
    const items = new Map<string, BuyItem>();
    if (selectedSessionId == null) return items;
    for (const item of buyItems as BuyItem[]) {
      if (item.sessionId === selectedSessionId) items.set(createTotalsKey(item.style, item.colour), item);
    }
    return items;
  }, [buyItems, selectedSessionId]);

  const grandTotal = useMemo(
    () => Array.from(buyTotals.values()).reduce((sum, total) => sum + total.total, 0),
    [buyTotals],
  );

  function openAddStyle() {
    setStyleDraft({ style: "", seasonality: "W27", notes: "" });
    setStyleDialog({ mode: "add" });
  }

  function openEditStyle(group: HandbagStyleGroup) {
    setStyleDraft({ style: group.style, seasonality: group.seasonality === "Unassigned" ? "" : group.seasonality, notes: group.notes });
    setStyleDialog({ mode: "edit", group });
  }

  function openAddSku(style: string, defaultSeasonality: string) {
    setSkuDraft({ colour: "", material: "", seasonality: defaultSeasonality === "Unassigned" ? "W27" : defaultSeasonality, rrp: "", cost: "", notes: "" });
    setSkuDialog({ mode: "add", style });
  }

  function openEditSku(sku: HandbagSku, parentSeasonality: string) {
    setSkuDraft({
      colour: sku.colour,
      material: sku.material ?? "",
      seasonality: getHandbagSeasonality(sku, parentSeasonality) === "Unassigned" ? "" : getHandbagSeasonality(sku, parentSeasonality),
      rrp: sku.rrp == null ? "" : String(sku.rrp),
      cost: sku.cost == null ? "" : String(sku.cost),
      notes: sku.notes ?? "",
    });
    setSkuDialog({ mode: "edit", style: sku.style, sku });
  }

  async function saveStyle() {
    if (!styleDialog) return;
    const style = styleDraft.style.trim().toUpperCase();
    if (!style) {
      toast.error("Style name is required");
      return;
    }
    const data = { seasonality: normalizeHandbagSeasonality(styleDraft.seasonality), notes: styleDraft.notes.trim() || null };
    if (styleDialog.mode === "add") {
      await createStyle.mutateAsync({ style, ...data });
    } else {
      await updateStyleDetails.mutateAsync({ style, ...data });
    }
    setStyleDialog(null);
  }

  async function saveSku() {
    if (!skuDialog) return;
    const colour = skuDraft.colour.trim().toUpperCase();
    if (!colour) {
      toast.error("SKU colour is required");
      return;
    }
    const rrp = skuDraft.rrp.trim() ? Number.parseFloat(skuDraft.rrp) : null;
    const cost = skuDraft.cost.trim() ? Number.parseFloat(skuDraft.cost) : null;
    const material = skuDraft.material.trim().toUpperCase();
    const details = {
      style: skuDialog.style,
      colour,
      material: material || undefined,
      seasonality: normalizeHandbagSeasonality(skuDraft.seasonality),
      notes: skuDraft.notes.trim() || undefined,
      rrp: Number.isFinite(rrp) ? rrp : null,
      cost: Number.isFinite(cost) ? cost : null,
    };
    if (skuDialog.mode === "edit" && skuDialog.sku) {
      const result = await updateSku.mutateAsync({
        ...details,
        oldColour: skuDialog.sku.colour,
        material: material || null,
        notes: skuDraft.notes.trim() || null,
      });
      if (result.outcome === "duplicate_cancelled") {
        toast.success(`${formatHandbagDisplayLabel(result.retainedColour)} was kept; ${formatHandbagDisplayLabel(result.sourceColour)} was cancelled and its buy quantities were retained.`);
      } else {
        toast.success("Handbag SKU updated");
      }
    } else {
      await upsertSku.mutateAsync(details);
    }
    setSkuDialog(null);
  }

  function saveQuantity(sku: HandbagSku, field: "auQty" | "usaQty" | "nycQty", value: number) {
    if (selectedSessionId == null) return;
    const existing = activeBuyItems.get(createTotalsKey(sku.style, sku.colour));
    updateBuyItem.mutate({
      sessionId: selectedSessionId,
      style: sku.style,
      colour: sku.colour,
      auQty: field === "auQty" ? value : existing?.auQty ?? 0,
      usaQty: field === "usaQty" ? value : existing?.usaQty ?? 0,
      nycQty: field === "nycQty" ? value : existing?.nycQty ?? 0,
    });
  }

  function handleExport() {
    const exportRows = visibleGroups.flatMap((group) => group.skus.map((sku) => {
      const totals = buyTotals.get(createTotalsKey(sku.style, sku.colour)) ?? { auQty: 0, usaQty: 0, nycQty: 0, total: 0 };
      return {
        style: formatHandbagDisplayLabel(group.style, ""),
        styleSeasonality: formatHandbagDisplayLabel(group.seasonality, ""),
        colour: formatHandbagDisplayLabel(sku.colour, ""),
        material: formatHandbagDisplayLabel(sku.material, ""),
        skuSeasonality: formatHandbagDisplayLabel(getHandbagSeasonality(sku, group.seasonality), ""),
        rrp: sku.rrp ?? "",
        cost: sku.cost ?? "",
        notes: sku.notes ?? "",
        au: totals.auQty,
        usa: totals.usaQty,
        nyc: totals.nycQty,
        total: totals.total,
      };
    }));

    if (exportRows.length === 0) {
      toast.error("There are no handbag SKUs in the current view to export");
      return;
    }

    const headings = ["STYLE", "STYLE SEASONALITY", "COLOUR / SKU", "MATERIAL", "SKU SEASONALITY", "RRP", "COST", "NOTES", "AU BOUGHT", "USA BOUGHT", "NYC BOUGHT", "TOTAL BOUGHT"];
    const rows: (string | number)[][] = [
      [`TONY BIANCO — HANDBAGS ${getSeasonDisplayLabel(season).toUpperCase()}`, ...Array(headings.length - 1).fill("")],
      [],
      headings,
      ...exportRows.map((row) => [
        row.style, row.styleSeasonality, row.colour, row.material, row.skuSeasonality,
        row.rrp, row.cost, row.notes, row.au, row.usa, row.nyc, row.total,
      ]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headings.length - 1 } }];
    worksheet["!cols"] = [
      { wch: 18 }, { wch: 20 }, { wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 12 },
      { wch: 12 }, { wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    ];
    worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: rows.length - 1, c: headings.length - 1 } }) };

    const darkFill = { patternType: "solid", fgColor: { rgb: "35100C" } };
    const amberFill = { patternType: "solid", fgColor: { rgb: "F9E4B7" } };
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      for (let columnIndex = 0; columnIndex < headings.length; columnIndex++) {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        if (!worksheet[address]) worksheet[address] = { v: "", t: "s" };
        const numeric = columnIndex >= 5 && columnIndex !== 7;
        if (rowIndex === 0) {
          worksheet[address].s = { fill: darkFill, font: { name: "Calibri", sz: 13, bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } };
        } else if (rowIndex === 2) {
          worksheet[address].s = { fill: amberFill, font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "35100C" } }, alignment: { horizontal: numeric ? "right" : "left", vertical: "center" } };
        } else {
          worksheet[address].s = { font: { name: "Calibri", sz: 10 }, alignment: { horizontal: numeric ? "right" : "left", vertical: "top", wrapText: columnIndex === 7 } };
        }
      }
    }
    worksheet["!rows"] = rows.map((_, index) => ({ hpt: index === 0 ? 30 : index === 1 ? 10 : index === 2 ? 22 : 18 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Handbags");
    const date = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
    XLSX.writeFile(workbook, `Handbags_${getSeasonFileLabel(season)}_${date}.xlsx`, { bookType: "xlsx", cellStyles: true });
    toast.success(`Exported ${exportRows.length} handbag SKUs`);
  }

  return (
    <div className="p-6 space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Handbags — {getSeasonDisplayLabel(season)}</h1>
              <p className="text-sm text-muted-foreground">One-page handbag range manager for styles, SKUs, seasonality and buys.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport} disabled={visibleGroups.every((group) => group.skus.length === 0)}>
            <Download className="w-4 h-4 mr-2" /> Export Excel
          </Button>
          <Button variant={showCancelled ? "secondary" : "outline"} onClick={() => setShowCancelled((show) => !show)}>
            <Ban className="w-4 h-4 mr-2" /> {showCancelled ? "Hide cancelled" : "Show cancelled"}
          </Button>
          <Button className="bg-amber-600 hover:bg-amber-700" onClick={openAddStyle}>
            <Plus className="w-4 h-4 mr-2" /> Add style
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search handbag styles, SKUs, material or notes…" className="pl-9" />
        </div>
        <select
          value={seasonalityFilter}
          onChange={(event) => setSeasonalityFilter(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="All">All seasonalities</option>
          {HANDBAG_SEASONALITY_OPTIONS.map((option) => <option key={option} value={option}>{formatHandbagDisplayLabel(option)}</option>)}
          <option value="Unassigned">Unassigned</option>
        </select>
        <div className="h-10 px-3 rounded-md bg-amber-50 border border-amber-200 flex items-center text-sm text-amber-800 whitespace-nowrap">
          {visibleGroups.length} style{visibleGroups.length === 1 ? "" : "s"} · {visibleGroups.reduce((sum, group) => sum + group.skus.length, 0)} SKUs
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium">Handbag buy</p>
          <p className="text-xs text-muted-foreground">Choose a session to enter quantities. Total bought across all sessions: <strong>{grandTotal.toLocaleString()}</strong>.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={selectedSessionId?.toString() ?? ""}
            onChange={(event) => setSelectedSessionId(event.target.value ? Number(event.target.value) : null)}
            className="h-9 min-w-52 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">No session selected</option>
            {(sessions as BuySession[]).map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
          </select>
          <Input value={newSessionName} onChange={(event) => setNewSessionName(event.target.value)} placeholder="New session name" className="h-9 w-40" onKeyDown={(event) => event.key === "Enter" && newSessionName.trim() && createSession.mutate({ name: newSessionName.trim() })} />
          <Button size="sm" variant="outline" disabled={!newSessionName.trim() || createSession.isPending} onClick={() => createSession.mutate({ name: newSessionName.trim() })}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New session
          </Button>
        </div>
      </section>

      {isLoadingSkus ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Loading handbag range…</div>
      ) : visibleGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-35" />
          <p className="font-medium">No handbag styles match this view</p>
          <Button className="mt-3" variant="outline" onClick={openAddStyle}><Plus className="w-4 h-4 mr-2" />Add handbag style</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((group) => (
            <article key={group.style} className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="p-4 flex flex-col gap-4 xl:flex-row xl:items-center">
                <HandbagImage style={group.style} imageUrl={group.imageUrl} kind="style" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold tracking-tight">{group.style}</h2>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{formatHandbagDisplayLabel(group.seasonality)}</span>
                    <span className="text-xs text-muted-foreground">{group.skus.length} SKU{group.skus.length === 1 ? "" : "S"}</span>
                  </div>
                  {group.notes && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{group.notes}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditStyle(group)}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Style details</Button>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => openAddSku(group.style, group.seasonality)}><PackagePlus className="w-3.5 h-3.5 mr-1.5" /> Add SKU</Button>
                </div>
              </div>

              {group.skus.length === 0 ? (
                <div className="border-t border-border px-4 py-5 text-sm text-muted-foreground flex items-center justify-between">
                  <span>No SKUs yet. Add the first colourway when ready.</span>
                  <Button size="sm" variant="outline" onClick={() => openAddSku(group.style, group.seasonality)}><Plus className="w-3.5 h-3.5 mr-1" /> Add SKU</Button>
                </div>
              ) : (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full min-w-[1120px] text-sm">
                    <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">SKU</th>
                        <th className="px-3 py-2 text-left font-semibold">Material</th>
                        <th className="px-3 py-2 text-left font-semibold">Seasonality</th>
                        <th className="px-3 py-2 text-right font-semibold">RRP</th>
                        <th className="px-3 py-2 text-right font-semibold">Cost</th>
                        <th className="px-3 py-2 text-left font-semibold">Notes</th>
                        <th className="px-3 py-2 text-center font-semibold">Total bought</th>
                        <th className="px-3 py-2 text-center font-semibold">AU</th>
                        <th className="px-3 py-2 text-center font-semibold">USA</th>
                        <th className="px-3 py-2 text-center font-semibold">NYC</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.skus.map((sku) => {
                        const key = createTotalsKey(sku.style, sku.colour);
                        const totals = buyTotals.get(key) ?? { total: 0, auQty: 0, usaQty: 0, nycQty: 0 };
                        const active = activeBuyItems.get(key) ?? { auQty: 0, usaQty: 0, nycQty: 0 };
                        const cancelled = sku.status === "cancelled";
                        return (
                          <tr key={key} className={cancelled ? "bg-rose-50/50 opacity-75" : "hover:bg-amber-50/30"}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3"><HandbagImage style={sku.style} colour={sku.colour} imageUrl={sku.imageUrl} kind="sku" /><span className={cancelled ? "font-medium line-through" : "font-medium"}>{formatHandbagDisplayLabel(sku.colour)}</span>{cancelled && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">CANCELLED</span>}</div>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">{formatHandbagDisplayLabel(sku.material)}</td>
                            <td className="px-3 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{formatHandbagDisplayLabel(getHandbagSeasonality(sku, group.seasonality))}</span></td>
                            <td className="px-3 py-3 text-right tabular-nums">{money(sku.rrp)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{money(sku.cost)}</td>
                            <td className="px-3 py-3 max-w-48 truncate text-muted-foreground" title={sku.notes ?? ""}>{sku.notes || "—"}</td>
                            <td className="px-3 py-3 text-center"><span className="font-semibold tabular-nums text-amber-700">{totals.total || "—"}</span></td>
                            <td className="px-3 py-3 text-center"><QtyInput value={active.auQty} disabled={selectedSessionId == null} onSave={(value) => saveQuantity(sku, "auQty", value)} /></td>
                            <td className="px-3 py-3 text-center"><QtyInput value={active.usaQty} disabled={selectedSessionId == null} onSave={(value) => saveQuantity(sku, "usaQty", value)} /></td>
                            <td className="px-3 py-3 text-center"><QtyInput value={active.nycQty} disabled={selectedSessionId == null} onSave={(value) => saveQuantity(sku, "nycQty", value)} /></td>
                            <td className="px-3 py-3 text-right">{cancelled ? <Button size="sm" variant="outline" onClick={() => restoreSku.mutate({ style: sku.style, colour: sku.colour })} disabled={restoreSku.isPending}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore</Button> : <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEditSku(sku, group.seasonality)} title="Edit SKU"><Pencil className="w-3.5 h-3.5" /></Button>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Dialog open={styleDialog !== null} onOpenChange={(open) => !open && setStyleDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{styleDialog?.mode === "add" ? "Add handbag style" : `Edit ${styleDialog?.group?.style}`}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">STYLE NAME *</label>
              <Input autoFocus value={styleDraft.style} disabled={styleDialog?.mode === "edit"} placeholder="e.g. ARIA" onChange={(event) => setStyleDraft((draft) => ({ ...draft, style: event.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">SEASONALITY</label>
              <select value={styleDraft.seasonality} onChange={(event) => setStyleDraft((draft) => ({ ...draft, seasonality: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Unassigned</option>
                {HANDBAG_SEASONALITY_OPTIONS.map((option) => <option key={option} value={option}>{formatHandbagDisplayLabel(option)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">STYLE NOTES</label>
              <Textarea value={styleDraft.notes} placeholder="Optional buying or development notes" onChange={(event) => setStyleDraft((draft) => ({ ...draft, notes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setStyleDialog(null)}>Cancel</Button><Button className="bg-amber-600 hover:bg-amber-700" onClick={saveStyle} disabled={createStyle.isPending || updateStyleDetails.isPending}>{styleDialog?.mode === "add" ? "Add style" : "Save details"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={skuDialog !== null} onOpenChange={(open) => !open && setSkuDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{skuDialog?.mode === "add" ? `Add SKU to ${skuDialog?.style}` : `Edit ${skuDialog?.sku?.colour}`}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">COLOUR / SKU *</label>
              <Input autoFocus value={skuDraft.colour} placeholder="e.g. BLACK PEBBLE" onChange={(event) => setSkuDraft((draft) => ({ ...draft, colour: event.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">MATERIAL</label>
              <Input value={skuDraft.material} placeholder="e.g. PEBBLE" onChange={(event) => setSkuDraft((draft) => ({ ...draft, material: event.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">SEASONALITY</label>
              <select value={skuDraft.seasonality} onChange={(event) => setSkuDraft((draft) => ({ ...draft, seasonality: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Unassigned</option>
                {HANDBAG_SEASONALITY_OPTIONS.map((option) => <option key={option} value={option}>{formatHandbagDisplayLabel(option)}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className="text-xs font-medium text-muted-foreground">RRP</label>
              <Input type="number" min="0" step="0.01" value={skuDraft.rrp} placeholder="0.00" onChange={(event) => setSkuDraft((draft) => ({ ...draft, rrp: event.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">COST</label>
              <Input type="number" min="0" step="0.01" value={skuDraft.cost} placeholder="0.00" onChange={(event) => setSkuDraft((draft) => ({ ...draft, cost: event.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">SKU NOTES</label>
              <Textarea value={skuDraft.notes} placeholder="Optional SKU notes" onChange={(event) => setSkuDraft((draft) => ({ ...draft, notes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>{skuDialog?.mode === "edit" && skuDialog.sku && <Button variant="destructive" onClick={async () => { await cancelSku.mutateAsync({ style: skuDialog.style, colour: skuDialog.sku!.colour }); setSkuDialog(null); }} disabled={cancelSku.isPending}>Cancel SKU</Button>}<Button variant="outline" onClick={() => setSkuDialog(null)}>Close</Button><Button className="bg-amber-600 hover:bg-amber-700" onClick={saveSku} disabled={upsertSku.isPending || updateSku.isPending}>{skuDialog?.mode === "add" ? "Add SKU" : "Save SKU"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
