import { useState, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { CheckCircle2, Clock, ChevronDown, ChevronRight, Upload, X, AlertTriangle, Trash2, Plus, Image as ImageIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import confetti from "canvas-confetti";

// Brand new lasts this season — manually confirmed list
const ALL_LASTS = [
  "BILLIE",
  "DAZIE",
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
  "OASIS",
];

const ALL_LASTS_UPPER = new Set(ALL_LASTS.map((l) => l.toUpperCase()));

// Short descriptor shown under each last name
const LAST_DESCRIPTIONS: Record<string, string> = {
  OASIS: "Casual Wedge",
};

// Reference photos for each last (shown in expanded card)
const LAST_PHOTOS: Record<string, string> = {
  OASIS: "/manus-storage/oasis-last_7e2d7a84.png",
};

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

// ─── Style Card with drag-and-drop image upload ────────────────────────────────
function StyleCard({
  styleName,
  imageUrl,
  isCustom,
  customStyleId,
  onImageUploaded,
  onDeleteCustomStyle,
}: {
  styleName: string;
  imageUrl?: string;
  isCustom?: boolean;
  customStyleId?: number;
  onImageUploaded: (style: string, url: string) => void;
  onDeleteCustomStyle?: (id: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImageMutation = trpc.styleImage.upload.useMutation({
    onSuccess: (data) => {
      onImageUploaded(styleName, data.url);
      toast.success(`Image uploaded for ${styleName}`);
    },
    onError: (err) => {
      toast.error(`Upload failed: ${err.message}`);
    },
  });

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please drop an image file");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target!.result as string).split(",")[1];
        uploadImageMutation.mutate({
          style: styleName,
          imageBase64: base64,
          mimeType: file.type,
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  }, [styleName, uploadImageMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col items-center gap-1 group relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />
      {/* Image area — drag target */}
      <div
        className="relative w-24 h-24 rounded-lg border overflow-hidden cursor-pointer transition-all"
        style={{
          borderColor: isDragging ? "oklch(0.55 0.14 260)" : "var(--border)",
          background: isDragging ? "oklch(0.94 0.04 260)" : imageUrl ? "white" : "var(--muted)",
          boxShadow: isDragging ? "0 0 0 2px oklch(0.55 0.14 260)" : undefined,
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        title="Click or drag an image to upload"
      >
        {uploading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "oklch(0.55 0.14 260)" }} />
          </div>
        ) : imageUrl ? (
          <>
            <img src={imageUrl} alt={styleName} className="w-full h-full object-contain" />
            {/* Upload overlay on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </>
        ) : isDragging ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <ImageIcon className="w-6 h-6" style={{ color: "oklch(0.55 0.14 260)" }} />
            <span className="text-[9px] font-medium" style={{ color: "oklch(0.55 0.14 260)" }}>Drop here</span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground/40">
            <ImageIcon className="w-5 h-5" />
            <span className="text-[9px]">Add image</span>
          </div>
        )}
      </div>

      {/* Style name */}
      <span className="text-[10px] font-medium text-foreground text-center leading-tight max-w-[80px] truncate">
        {styleName}
        {isCustom && (
          <span className="ml-1 text-[8px] px-1 py-0.5 rounded font-semibold" style={{ background: "oklch(0.92 0.08 155)", color: "oklch(0.35 0.14 155)" }}>NEW</span>
        )}
      </span>

      {/* Delete button for custom styles */}
      {isCustom && customStyleId !== undefined && onDeleteCustomStyle && (
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteCustomStyle(customStyleId); }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title={`Remove ${styleName}`}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}

// ─── Add Style Form ────────────────────────────────────────────────────────────
function AddStyleForm({
  lastName,
  onAdded,
  onCancel,
}: {
  lastName: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [styleName, setStyleName] = useState("");
  const [category, setCategory] = useState("");

  const addMutation = trpc.customStyle.add.useMutation({
    onSuccess: () => {
      toast.success(`${styleName.toUpperCase()} added to ${lastName}`);
      onAdded();
    },
    onError: (err) => {
      toast.error(`Failed to add style: ${err.message}`);
    },
  });

  const handleSubmit = () => {
    const name = styleName.trim().toUpperCase();
    if (!name) return;
    addMutation.mutate({ style: name, lastName, category: category.trim() || undefined });
  };

  return (
    <div className="flex items-center gap-2 mt-2 p-2 rounded-lg border" style={{ borderColor: "oklch(0.80 0.10 155)", background: "oklch(0.98 0.02 155)" }}>
      <input
        type="text"
        value={styleName}
        onChange={(e) => setStyleName(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel(); }}
        placeholder="Style name (e.g. CORFU)"
        className="flex-1 text-sm rounded border px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-400/40 font-medium uppercase"
        style={{ borderColor: "var(--border)" }}
        autoFocus
      />
      <input
        type="text"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category (optional)"
        className="w-36 text-sm rounded border px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-400/40"
        style={{ borderColor: "var(--border)" }}
      />
      <button
        onClick={handleSubmit}
        disabled={!styleName.trim() || addMutation.isPending}
        className="px-3 py-1.5 rounded text-xs font-medium text-white disabled:opacity-50 transition-colors"
        style={{ background: "oklch(0.45 0.14 155)" }}
      >
        {addMutation.isPending ? "Adding…" : "Add"}
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 rounded text-xs font-medium text-muted-foreground border transition-colors hover:bg-muted"
        style={{ borderColor: "var(--border)" }}
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LastApprovalTab() {
  const { mergedStyles, customStyleRows, refetchCustomStyles, refetchImageOverrides } = useCustomSkus();

  // Build style lookup per last (live, includes custom SKUs and custom styles)
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
  const { data: imageOverrideList = [], refetch: refetchImages } = trpc.styleImage.getAll.useQuery();
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
  const deleteCustomStyleMutation = trpc.customStyle.delete.useMutation({
    onSuccess: () => { refetchCustomStyles(); toast.success("Style removed"); },
    onError: (err) => toast.error(`Failed to remove style: ${err.message}`),
  });

  // Optimistic local state so the UI responds instantly without waiting for refetch
  const [localOverrides, setLocalOverrides] = useState<Record<string, "approved" | "waiting_revised">>({});
  // Per-size and proceed-with-samples local optimistic overrides
  const [localSizeOverrides, setLocalSizeOverrides] = useState<Record<string, { size65?: boolean; size7?: boolean; size95?: boolean; proceed?: boolean }>>({});
  const [expandedLast, setExpandedLast] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  // Per-last draft store: keyed by lastName — survives navigation between lasts
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "approved" | "waiting_revised">("all");
  const [deletingLast, setDeletingLast] = useState<string | null>(null);
  // Custom lasts from DB
  const { data: customLastsFromDb = [], refetch: refetchCustomLasts } = trpc.customLast.getAll.useQuery();
  const customLasts = customLastsFromDb;
  const addCustomLastMutation = trpc.customLast.add.useMutation({
    onSuccess: (_, variables) => {
      // Remove from local deleted set so it reappears immediately
      setLocalDeletedLasts((prev) => { const next = new Set(prev); next.delete(variables.lastName.toUpperCase().trim()); return next; });
      refetchCustomLasts();
    }
  });
  const deleteCustomLastMutation = trpc.customLast.delete.useMutation({ onSuccess: () => refetchCustomLasts() });
  // Add Last dialog state
  const [addLastDialogOpen, setAddLastDialogOpen] = useState(false);
  const [newLastName, setNewLastName] = useState("");
  // Track which last has the "Add Style" form open
  const [addingStyleToLast, setAddingStyleToLast] = useState<string | null>(null);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportRow[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Build a map of lastName → approval record (with local optimistic overrides applied)
  const approvalMap = useMemo(() => {
    const map: Record<string, {
      status: "approved" | "waiting_revised";
      notes: string | null;
      size65Approved: boolean;
      size7Approved: boolean;
      size95Approved: boolean;
      proceedWithSamples: boolean;
    }> = {};
    for (const a of approvals ?? []) {
      map[a.lastName] = {
        status: a.status,
        notes: a.notes ?? null,
        size65Approved: (a as any).size65Approved ?? false,
        size7Approved: (a as any).size7Approved ?? false,
        size95Approved: (a as any).size95Approved ?? false,
        proceedWithSamples: (a as any).proceedWithSamples ?? false,
      };
    }
    // Apply local status overrides on top
    for (const [lastName, status] of Object.entries(localOverrides)) {
      if (map[lastName]) {
        map[lastName] = { ...map[lastName], status };
      } else {
        map[lastName] = { status, notes: null, size65Approved: false, size7Approved: false, size95Approved: false, proceedWithSamples: false };
      }
    }
    // Apply local size/proceed overrides on top
    for (const [lastName, overrides] of Object.entries(localSizeOverrides)) {
      if (!map[lastName]) {
        map[lastName] = { status: "waiting_revised", notes: null, size65Approved: false, size7Approved: false, size95Approved: false, proceedWithSamples: false };
      }
      if (overrides.size65 !== undefined) map[lastName].size65Approved = overrides.size65;
      if (overrides.size7 !== undefined) map[lastName].size7Approved = overrides.size7;
      if (overrides.size95 !== undefined) map[lastName].size95Approved = overrides.size95;
      if (overrides.proceed !== undefined) map[lastName].proceedWithSamples = overrides.proceed;
    }
    return map;
  }, [approvals, localOverrides, localSizeOverrides]);

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

  // Build a set of custom style names for quick lookup
  const customStyleNames = useMemo(() => new Set(customStyleRows.map((cs) => cs.style.toUpperCase())), [customStyleRows]);

  const handleToggle = (lastName: string, current: "approved" | "waiting_revised") => {
    const next = current === "approved" ? "waiting_revised" : "approved";
    setLocalOverrides((prev) => ({ ...prev, [lastName]: next }));
    if (next === "approved") {
      // Subtle celebration — two quick bursts from the sides
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { x: 0.35, y: 0.55 },
        colors: ["#4ade80", "#86efac", "#bbf7d0", "#ffffff", "#fde68a"],
        scalar: 0.85,
        gravity: 1.2,
        drift: 0.5,
      });
      confetti({
        particleCount: 40,
        spread: 45,
        origin: { x: 0.65, y: 0.55 },
        colors: ["#4ade80", "#86efac", "#bbf7d0", "#ffffff", "#fde68a"],
        scalar: 0.85,
        gravity: 1.2,
        drift: -0.5,
      });
    }
    upsert.mutate(
      { lastName, status: next, notes: approvalMap[lastName]?.notes ?? null },
      {
        onError: () => {
          setLocalOverrides((prev) => ({ ...prev, [lastName]: current }));
        },
      }
    );
  };

  const handleSizeToggle = (lastName: string, field: "size65" | "size7" | "size95", current: boolean) => {
    const next = !current;
    setLocalSizeOverrides((prev) => ({ ...prev, [lastName]: { ...prev[lastName], [field]: next } }));
    const fieldMap = { size65: "size65Approved", size7: "size7Approved", size95: "size95Approved" } as const;
    upsert.mutate(
      { lastName, status: approvalMap[lastName]?.status ?? "waiting_revised", notes: approvalMap[lastName]?.notes ?? null, [fieldMap[field]]: next },
      { onError: () => setLocalSizeOverrides((prev) => ({ ...prev, [lastName]: { ...prev[lastName], [field]: current } })) }
    );
  };

  const handleProceedToggle = (lastName: string, current: boolean) => {
    const next = !current;
    setLocalSizeOverrides((prev) => ({ ...prev, [lastName]: { ...prev[lastName], proceed: next } }));
    upsert.mutate(
      { lastName, status: approvalMap[lastName]?.status ?? "waiting_revised", notes: approvalMap[lastName]?.notes ?? null, proceedWithSamples: next },
      { onError: () => setLocalSizeOverrides((prev) => ({ ...prev, [lastName]: { ...prev[lastName], proceed: current } })) }
    );
  };

  const handleDeleteLast = (lastName: string) => {
    setLocalDeletedLasts((prev) => new Set([...prev, lastName]));
    setDeletingLast(null);
    deleteLastMutation.mutate({ lastName });
  };

  const handleSaveNotes = (lastName: string) => {
    const draft = notesDrafts[lastName] ?? "";
    upsert.mutate({
      lastName,
      status: approvalMap[lastName]?.status ?? "waiting_revised",
      notes: draft || null,
    });
    setNotesDrafts((prev) => { const n = { ...prev }; delete n[lastName]; return n; });
    setEditingNotes(null);
  };

  const handleImageUploaded = useCallback((_style: string, _url: string) => {
    refetchImages();
    refetchImageOverrides();
  }, [refetchImages, refetchImageOverrides]);

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
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    const matched = importPreview.filter((r) => r.matched);
    try {
      for (const row of matched) {
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
            <div className="text-2xl font-bold text-foreground">{visibleLasts.length}</div>
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
        <div className="flex-shrink-0 pt-1 flex flex-col gap-2">
          {/* Add Last button */}
          <button
            onClick={() => { setNewLastName(""); setAddLastDialogOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:bg-muted/50"
            style={{ borderColor: "oklch(0.72 0.14 250)", background: "oklch(0.97 0.03 250)", color: "oklch(0.40 0.14 250)" }}
          >
            <Plus className="w-4 h-4" />
            Add Last
          </button>
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
          <p className="text-xs text-muted-foreground max-w-[140px] text-right">
            Excel with Last + Notes columns
          </p>
        </div>
      </div>

      {/* Add Last dialog */}
      {addLastDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddLastDialogOpen(false)}>
          <div
            className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground mb-1">Add New Last</h3>
            <p className="text-xs text-muted-foreground mb-4">Enter the last name (e.g. MIAMI). It will appear in the Last Approval tab.</p>
            <input
              type="text"
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLastName.trim()) {
                  addCustomLastMutation.mutate({ lastName: newLastName.trim() });
                  setAddLastDialogOpen(false);
                  toast.success(`Last "${newLastName.trim()}" added`);
                }
                if (e.key === "Escape") setAddLastDialogOpen(false);
              }}
              placeholder="LAST NAME"
              autoFocus
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground mb-4 uppercase"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setAddLastDialogOpen(false)}
                className="px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newLastName.trim()) return;
                  addCustomLastMutation.mutate({ lastName: newLastName.trim() });
                  setAddLastDialogOpen(false);
                  toast.success(`Last "${newLastName.trim()}" added`);
                }}
                disabled={!newLastName.trim() || addCustomLastMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: "oklch(0.50 0.14 250)" }}
              >
                Add Last
              </button>
            </div>
          </div>
        </div>
      )}

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
          const size65 = approval?.size65Approved ?? false;
          const size7 = approval?.size7Approved ?? false;
          const size95 = approval?.size95Approved ?? false;
          const proceed = approval?.proceedWithSamples ?? false;
          const styles = lastToStyles[lastName] ?? [];
          const isExpanded = expandedLast === lastName;
          const isEditingThisNotes = editingNotes === lastName;
          const isAddingStyle = addingStyleToLast === lastName;

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
                {/* Toggle button */}
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
                    {LAST_DESCRIPTIONS[lastName] && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: "oklch(0.94 0.04 260)", color: "oklch(0.40 0.14 260)" }}>
                        {LAST_DESCRIPTIONS[lastName]}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {lastNewSkuCount[lastName] ?? 0} new SKU{(lastNewSkuCount[lastName] ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {notes && !isExpanded && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{notes}</p>
                  )}
                </div>

                {/* Size approval checkboxes */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {([
                    { label: "6.5", field: "size65" as const, checked: size65 },
                    { label: "7",   field: "size7"  as const, checked: size7  },
                    { label: "9.5", field: "size95" as const, checked: size95 },
                  ]).map(({ label, field, checked }) => (
                    <button
                      key={field}
                      onClick={() => handleSizeToggle(lastName, field, checked)}
                      title={`Size ${label} ${checked ? "approved — click to uncheck" : "not yet approved"}`}
                      className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-all hover:opacity-80"
                      style={checked
                        ? { background: "oklch(0.92 0.08 155)", color: "oklch(0.35 0.14 155)", borderColor: "oklch(0.72 0.14 155)" }
                        : { background: "var(--muted)", color: "var(--muted-foreground)", borderColor: "var(--border)" }
                      }
                    >
                      {checked && <CheckCircle2 className="w-3 h-3" />}
                      <span>Sz {label}</span>
                    </button>
                  ))}
                  {/* Proceed with Samples — always clickable */}
                  <button
                    onClick={() => handleProceedToggle(lastName, proceed)}
                    title={proceed ? "Proceed with Samples — click to uncheck" : "Mark as Proceed with Samples"}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-all hover:opacity-80"
                    style={proceed
                      ? { background: "oklch(0.92 0.08 155)", color: "oklch(0.35 0.14 155)", borderColor: "oklch(0.72 0.14 155)" }
                      : { background: "var(--muted)", color: "var(--muted-foreground)", borderColor: "var(--border)" }
                    }
                  >
                    {proceed && <CheckCircle2 className="w-3 h-3" />}
                    <span>Proceed</span>
                  </button>
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

              {/* Size approval progress bar */}
              {(() => {
                const approvedCount = [size65, size7, size95].filter(Boolean).length;
                const pct = Math.round((approvedCount / 3) * 100);
                const barColor = approvedCount === 3
                  ? "oklch(0.65 0.18 155)"  // full green
                  : approvedCount === 2
                  ? "oklch(0.70 0.16 180)"  // teal
                  : approvedCount === 1
                  ? "oklch(0.72 0.16 65)"   // amber
                  : "var(--muted)";
                return (
                  <div className="px-4 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                      <span className="text-[10px] font-medium flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>
                        {approvedCount}/3 sizes
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Expanded section */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--border)" }}>
                  {/* Last reference photo */}
                  {LAST_PHOTOS[lastName] && (
                    <div className="mt-3 mb-3 flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Last Reference</p>
                        <img
                          src={LAST_PHOTOS[lastName]}
                          alt={`${lastName} last reference`}
                          className="w-32 h-24 object-contain rounded-lg border"
                          style={{ borderColor: "var(--border)", background: "var(--muted)" }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Styles on this last — with images */}
                  <div className="mt-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Styles on this last
                      </p>
                      {/* Add Style button */}
                      {!isAddingStyle && (
                        <button
                          onClick={() => setAddingStyleToLast(lastName)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors hover:bg-muted/50"
                          style={{ borderColor: "oklch(0.72 0.14 155)", color: "oklch(0.40 0.14 155)", background: "oklch(0.96 0.04 155)" }}
                        >
                          <Plus className="w-3 h-3" />
                          Add Style
                        </button>
                      )}
                    </div>

                    {/* Add Style form */}
                    {isAddingStyle && (
                      <AddStyleForm
                        lastName={lastName}
                        onAdded={() => {
                          setAddingStyleToLast(null);
                          refetchCustomStyles();
                        }}
                        onCancel={() => setAddingStyleToLast(null)}
                      />
                    )}

                    {/* Style cards grid */}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {styles.map((s) => {
                        const imgUrl = imageOverrides[s] ?? STYLE_IMAGE_MAP[s];
                        const isCustom = customStyleNames.has(s.toUpperCase());
                        const customStyleRow = customStyleRows.find((cs) => cs.style.toUpperCase() === s.toUpperCase());
                        return (
                          <StyleCard
                            key={s}
                            styleName={s}
                            imageUrl={imgUrl}
                            isCustom={isCustom}
                            customStyleId={customStyleRow?.id}
                            onImageUploaded={handleImageUploaded}
                            onDeleteCustomStyle={isCustom ? (id) => deleteCustomStyleMutation.mutate({ id }) : undefined}
                          />
                        );
                      })}
                      {styles.length === 0 && !isAddingStyle && (
                        <p className="text-xs text-muted-foreground italic">No styles on this last yet. Click "Add Style" to add one.</p>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                      Notes
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
