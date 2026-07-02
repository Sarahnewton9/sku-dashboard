import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, X, ImageIcon, Pencil, ChevronDown, ChevronRight,
  ShoppingBag, Lock, Clock, Check, Download,
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type HandbagStyle = {
  id: number;
  style: string;
  colour: string;
  material: string | null;
  section: string | null;
  notes: string | null;
  rrp: number | null;
  cost: number | null;
  imageUrl: string | null;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECTION_ORDER = ["Core / Carry Over", "New Season"];

function sectionLabel(s: string | null) {
  return s ?? "Other";
}

// ─── Inline qty cell ─────────────────────────────────────────────────────────

function QtyCell({
  value,
  onSave,
  disabled,
}: {
  value: number;
  onSave: (v: number) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (disabled) {
    return (
      <span className="min-w-[2.5rem] inline-block text-center text-sm text-muted-foreground">
        {value || "—"}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="w-14 text-center border border-amber-400 rounded px-1 py-0.5 text-sm bg-background"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = parseInt(draft, 10);
          if (!isNaN(n) && n >= 0) onSave(n);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <span
      className="cursor-pointer min-w-[2.5rem] inline-block text-center hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded px-1 py-0.5 text-sm border border-transparent hover:border-amber-300 transition-colors"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      title="Click to edit"
    >
      {value ? (
        <span className="font-medium text-amber-700 dark:text-amber-400">{value}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </span>
  );
}

// ─── Price edit cell ─────────────────────────────────────────────────────────

function PriceCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  if (editing) {
    return (
      <input
        autoFocus
        className="w-20 text-center border border-amber-400 rounded px-1 py-0.5 text-sm bg-background"
        value={draft}
        placeholder="0.00"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = parseFloat(draft);
          onSave(isNaN(n) ? null : n);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value != null ? String(value) : "");
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <span
      className="cursor-pointer hover:bg-muted rounded px-1 py-0.5 text-sm"
      onClick={() => {
        setDraft(value != null ? String(value) : "");
        setEditing(true);
      }}
      title="Click to edit"
    >
      {value != null ? (
        `$${value.toFixed(2)}`
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </span>
  );
}

// ─── Colourway image cell (large, in expanded area) ───────────────────────────

function ImageCell({
  styleName,
  colour,
  imageUrl,
}: {
  styleName: string;
  colour: string;
  imageUrl: string | null;
}) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const uploadImage = trpc.handbag.uploadImage.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      toast.success("Image uploaded");
    },
    onError: () => toast.error("Upload failed"),
    onSettled: () => setUploading(false),
  });

  const removeImage = trpc.handbag.removeImage.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      toast.success("Image removed");
    },
  });

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadImage.mutate({ style: styleName, colour, imageBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  if (imageUrl) {
    return (
      <>
        <div className="relative group w-28 h-28 shrink-0" onClick={(e) => e.stopPropagation()}>
          <img
            src={imageUrl}
            alt={`${styleName} ${colour}`}
            className="w-28 h-28 object-contain rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity bg-white"
            onClick={() => setLightbox(true)}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeImage.mutate({ style: styleName, colour });
            }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove image"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        {lightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
          >
            <img
              src={imageUrl}
              alt={`${styleName} ${colour}`}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          fileRef.current?.click();
        }}
        disabled={uploading}
        className="w-28 h-28 shrink-0 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-muted-foreground hover:text-amber-600 disabled:opacity-50"
        title="Upload image"
      >
        {uploading ? (
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <ImageIcon className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Upload</span>
          </>
        )}
      </button>
    </>
  );
}

// ─── Style-level image cell (shown on collapsed header row) ───────────────────

function StyleImageCell({
  styleName,
  imageUrl,
}: {
  styleName: string;
  imageUrl: string | null;
}) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const uploadStyleImage = trpc.handbag.uploadStyleImage.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      toast.success("Style image uploaded");
    },
    onError: () => toast.error("Upload failed"),
    onSettled: () => setUploading(false),
  });

  const removeStyleImage = trpc.handbag.removeStyleImage.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      toast.success("Image removed");
    },
  });

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadStyleImage.mutate({ style: styleName, imageBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  if (imageUrl) {
    return (
      <>
        <div
          className="relative group w-16 h-10 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={imageUrl}
            alt={styleName}
            className="w-16 h-10 object-contain rounded border border-border cursor-pointer hover:opacity-90 transition-opacity bg-white"
            onClick={() => setLightbox(true)}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeStyleImage.mutate({ style: styleName });
            }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove image"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
        {lightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
          >
            <img
              src={imageUrl}
              alt={styleName}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          fileRef.current?.click();
        }}
        disabled={uploading}
        className="w-16 h-10 shrink-0 border-2 border-dashed border-border rounded flex flex-col items-center justify-center gap-0.5 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-muted-foreground hover:text-amber-600 disabled:opacity-50"
        title="Upload style image"
      >
        {uploading ? (
          <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <ImageIcon className="w-3.5 h-3.5" />
        )}
      </button>
    </>
  );
}

// ─── Inline session bar (handbag-specific, no lock/unlock) ────────────────────

function HandbagSessionBar({
  sessions,
  selectedSessionId,
  onSelectSession,
  onDeselect,
  onCreated,
}: {
  sessions: BuySession[];
  selectedSessionId: number | null;
  onSelectSession: (id: number) => void;
  onDeselect: () => void;
  onCreated: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const createSession = trpc.handbag.createSession.useMutation({
    onSuccess: (data) => {
      utils.handbag.listSessions.invalidate();
      setShowCreate(false);
      setNewName("");
      onCreated(data.id);
      toast.success(`Session "${data.name}" created`);
    },
    onError: () => toast.error("Failed to create session"),
  });

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div
      className="rounded-xl border p-4 mb-2"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        {/* Session selector */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-shrink-0">
            Buy Session:
          </span>
          <div className="relative">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-muted/50"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              {selectedSession ? (
                <>
                  <Clock className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
                  <span className="truncate max-w-48">{selectedSession.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">No session selected</span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
            </button>

            {showHistory && (
              <div
                className="absolute top-full left-0 mt-1 w-72 rounded-xl border shadow-lg z-20 overflow-hidden"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    All Buy Sessions
                  </p>
                </div>
                <button
                  onClick={() => {
                    onDeselect();
                    setShowHistory(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors border-b"
                  style={{
                    borderColor: "var(--border)",
                    background:
                      selectedSessionId === null ? "oklch(0.97 0.04 65 / 0.6)" : undefined,
                  }}
                >
                  <span className="text-muted-foreground text-sm">— No session —</span>
                </button>
                {sessions.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    No sessions yet
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {[...sessions].reverse().map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          onSelectSession(s.id);
                          setShowHistory(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
                        style={{
                          background:
                            selectedSessionId === s.id
                              ? "oklch(0.97 0.04 65 / 0.6)"
                              : undefined,
                        }}
                      >
                        <Clock
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: "#f59e0b" }}
                        />
                        <span className="flex-1 truncate font-medium text-foreground">
                          {s.name}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(s.createdAt).toLocaleDateString("en-AU", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                        {selectedSessionId === s.id && (
                          <Check className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedSession && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
              style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}
            >
              Active
            </span>
          )}
        </div>

        {/* Create new session */}
        {showCreate ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim())
                  createSession.mutate({ name: newName.trim() });
                if (e.key === "Escape") setShowCreate(false);
              }}
              placeholder="e.g. 30.04"
              autoFocus
              className="px-3 py-1.5 rounded-lg border text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40 w-40"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              onClick={() => {
                if (newName.trim()) createSession.mutate({ name: newName.trim() });
              }}
              disabled={createSession.isPending || !newName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: "#f59e0b", color: "white" }}
            >
              {createSession.isPending ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-muted"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Session
          </button>
        )}
      </div>

      {!selectedSession && (
        <p className="text-xs text-muted-foreground mt-2">
          Select a session to enter buy quantities, or create a new one to start a fresh buy round.
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HandbagsTab() {
  const utils = trpc.useUtils();

  // Data
  const { data: styles = [] } = trpc.handbag.listStyles.useQuery();
  const { data: sessions = [] } = trpc.handbag.listSessions.useQuery();
  const { data: allBuyItems = [] } = trpc.handbag.listBuyItems.useQuery({});

  // Session state
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // Expanded styles
  const [expandedStyle, setExpandedStyle] = useState<string | null>(null);

  // Rename state
  const [renamingStyle, setRenamingStyle] = useState<string | null>(null);
  const [renameStyleDraft, setRenameStyleDraft] = useState("");
  const [renamingColour, setRenamingColour] = useState<{
    style: string;
    colour: string;
  } | null>(null);
  const [renameColourDraft, setRenameColourDraft] = useState("");

  // Inline add colour draft per style
  const [addColourDraft, setAddColourDraft] = useState<
    Record<string, { colour: string; material: string; section: string }>
  >({});

  // Add/Edit colour modal
  type ColourModalMode = "add" | "edit";
  const [colourModal, setColourModal] = useState<{
    mode: ColourModalMode;
    style: string;
    row?: HandbagStyle;
  } | null>(null);
  const [modalColour, setModalColour] = useState("");
  const [modalMaterial, setModalMaterial] = useState("");
  const [modalSection, setModalSection] = useState("");
  const [modalRrp, setModalRrp] = useState("");
  const [modalCost, setModalCost] = useState("");

  // Delete session confirm
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<BuySession | null>(null);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const upsertStyle = trpc.handbag.upsertStyle.useMutation({
    onSuccess: () => utils.handbag.listStyles.invalidate(),
    onError: () => toast.error("Failed to save"),
  });

  const renameStyleMutation = trpc.handbag.renameStyle.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      utils.handbag.listBuyItems.invalidate();
      setRenamingStyle(null);
      toast.success("Style renamed");
    },
    onError: () => toast.error("Failed to rename style"),
  });

  const renameColourMutation = trpc.handbag.renameColour.useMutation({
    onSuccess: () => {
      utils.handbag.listStyles.invalidate();
      utils.handbag.listBuyItems.invalidate();
      setRenamingColour(null);
      toast.success("Colour renamed");
    },
    onError: () => toast.error("Failed to rename colour"),
  });

  const upsertBuyItem = trpc.handbag.upsertBuyItem.useMutation({
    onSuccess: () => utils.handbag.listBuyItems.invalidate(),
    onError: () => toast.error("Failed to save quantity"),
  });

  const deleteSession = trpc.handbag.deleteSession.useMutation({
    onSuccess: () => {
      utils.handbag.listSessions.invalidate();
      utils.handbag.listBuyItems.invalidate();
      if (selectedSessionId === confirmDeleteSession?.id) setSelectedSessionId(null);
      setConfirmDeleteSession(null);
      toast.success("Session deleted");
    },
  });

  // ─── Derived data ───────────────────────────────────────────────────────────

  // Group all colourways by style name (flat, no section grouping at top level)
  const styleGroups = useMemo(() => {
    const map = new Map<string, HandbagStyle[]>();
    for (const s of styles as HandbagStyle[]) {
      if (!map.has(s.style)) map.set(s.style, []);
      map.get(s.style)!.push(s);
    }
    return map;
  }, [styles]);

  // All-session buy totals per style+colour key
  const buyTotals = useMemo(() => {
    const map = new Map<
      string,
      { au: number; usa: number; nyc: number; total: number }
    >();
    for (const item of allBuyItems as BuyItem[]) {
      const key = `${item.style}|${item.colour}`;
      const existing = map.get(key) ?? { au: 0, usa: 0, nyc: 0, total: 0 };
      existing.au += item.auQty;
      existing.usa += item.usaQty;
      existing.nyc += item.nycQty;
      existing.total += item.auQty + item.usaQty + item.nycQty;
      map.set(key, existing);
    }
    return map;
  }, [allBuyItems]);

  // Active session buy items map
  const sessionItemMap = useMemo(() => {
    if (selectedSessionId == null) return new Map<string, BuyItem>();
    const map = new Map<string, BuyItem>();
    for (const item of allBuyItems as BuyItem[]) {
      if (item.sessionId === selectedSessionId) {
        map.set(`${item.style}|${item.colour}`, item);
      }
    }
    return map;
  }, [allBuyItems, selectedSessionId]);

  // Grand totals across all sessions
  const grandTotals = useMemo(() => {
    let au = 0;
    let usa = 0;
    let nyc = 0;
    for (const d of Array.from(buyTotals.values())) {
      au += d.au;
      usa += d.usa;
      nyc += d.nyc;
    }
    return { au, usa, nyc, total: au + usa + nyc };
  }, [buyTotals]);

  // Sorted style names
  const sortedStyleNames = useMemo(() => {
    return Array.from(styleGroups.keys()).sort();
  }, [styleGroups]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function handleQty(
    styleName: string,
    colour: string,
    field: "auQty" | "usaQty" | "nycQty",
    value: number
  ) {
    if (selectedSessionId == null) return;
    const key = `${styleName}|${colour}`;
    const existing = sessionItemMap.get(key);
    upsertBuyItem.mutate({
      sessionId: selectedSessionId,
      style: styleName,
      colour,
      auQty: field === "auQty" ? value : (existing?.auQty ?? 0),
      usaQty: field === "usaQty" ? value : (existing?.usaQty ?? 0),
      nycQty: field === "nycQty" ? value : (existing?.nycQty ?? 0),
    });
  }

  function openAddColour(styleName: string) {
    setColourModal({ mode: "add", style: styleName });
    setModalColour("");
    setModalMaterial("");
    setModalSection("New Season");
    setModalRrp("");
    setModalCost("");
  }

  function openEditColour(row: HandbagStyle) {
    setColourModal({ mode: "edit", style: row.style, row });
    setModalColour(row.colour);
    setModalMaterial(row.material ?? "");
    setModalSection(row.section ?? "");
    setModalRrp(row.rrp != null ? String(row.rrp) : "");
    setModalCost(row.cost != null ? String(row.cost) : "");
  }

  async function submitColourModal() {
    if (!colourModal) return;
    const colour = modalColour.trim().toUpperCase();
    if (!colour) {
      toast.error("Colour name is required");
      return;
    }
    const rrp = modalRrp ? parseFloat(modalRrp) : null;
    const cost = modalCost ? parseFloat(modalCost) : null;
    const section = modalSection || null;
    const material = modalMaterial.trim() || null;

    if (colourModal.mode === "edit" && colourModal.row) {
      const old = colourModal.row;
      if (colour !== old.colour) {
        await new Promise<void>((resolve, reject) =>
          renameColourMutation.mutate(
            { style: old.style, oldColour: old.colour, newColour: colour },
            { onSuccess: () => resolve(), onError: () => reject() }
          )
        ).catch(() => {
          toast.error("Failed to rename colour");
          return;
        });
      }
      upsertStyle.mutate({ style: old.style, colour, material: material ?? undefined, section: section ?? undefined, rrp, cost });
    } else {
      upsertStyle.mutate({ style: colourModal.style, colour, material: material ?? undefined, section: section ?? undefined, rrp, cost });
    }
    setColourModal(null);
  }

  // ─── Render colourway row (shared between bought and unbought) ───────────────

  function renderColourRow(c: HandbagStyle, sessionActive: boolean) {
    const key = `${c.style}|${c.colour}`;
    const allTotals = buyTotals.get(key);
    const sessionItem = sessionItemMap.get(key);
    const au = sessionItem?.auQty ?? 0;
    const usa = sessionItem?.usaQty ?? 0;
    const nyc = sessionItem?.nycQty ?? 0;
    const sessionTotal = au + usa + nyc;
    const hasBought = (allTotals?.total ?? 0) > 0;

    return (
      <div
        key={c.colour}
        className="flex items-start gap-4 px-4 py-3 hover:bg-muted/20 group/row"
        style={{
          background: sessionTotal > 0 ? "oklch(0.97 0.06 65 / 0.4)" : undefined,
        }}
      >
        {/* Large colourway image */}
        <ImageCell styleName={c.style} colour={c.colour} imageUrl={c.imageUrl} />

        {/* Info block */}
        <div className="flex-1 min-w-0 pt-1">
          {/* Colour name — click to rename */}
          <div className="flex items-center gap-2 mb-0.5">
            {renamingColour?.style === c.style && renamingColour?.colour === c.colour ? (
              <input
                autoFocus
                className="font-semibold text-sm w-40 border border-amber-400 rounded px-1.5 py-0.5 bg-background"
                value={renameColourDraft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenameColourDraft(e.target.value.toUpperCase())}
                onBlur={() => {
                  const v = renameColourDraft.trim().toUpperCase();
                  if (v && v !== c.colour)
                    renameColourMutation.mutate({
                      style: c.style,
                      oldColour: c.colour,
                      newColour: v,
                    });
                  else setRenamingColour(null);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setRenamingColour(null);
                }}
              />
            ) : (
              <span
                className="font-semibold text-sm cursor-text hover:text-amber-500 transition-colors"
                title="Click to rename"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingColour({ style: c.style, colour: c.colour });
                  setRenameColourDraft(c.colour);
                }}
              >
                {c.colour}
              </span>
            )}
            {/* Section badge */}
            {c.section && (
              <span
                className="text-[10px] rounded px-1.5 py-0.5 border border-border bg-muted text-muted-foreground"
              >
                {c.section}
              </span>
            )}
          </div>
          {c.material && (
            <div className="text-xs text-muted-foreground mb-1">{c.material}</div>
          )}

          {/* Prices */}
          <div className="flex items-center gap-4 mt-1">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                RRP
              </div>
              <PriceCell
                value={c.rrp}
                onSave={(v) =>
                  upsertStyle.mutate({
                    style: c.style,
                    colour: c.colour,
                    material: c.material ?? undefined,
                    section: c.section ?? undefined,
                    rrp: v,
                    cost: c.cost,
                  })
                }
              />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                Cost
              </div>
              <PriceCell
                value={c.cost}
                onSave={(v) =>
                  upsertStyle.mutate({
                    style: c.style,
                    colour: c.colour,
                    material: c.material ?? undefined,
                    section: c.section ?? undefined,
                    rrp: c.rrp,
                    cost: v,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* All-session total */}
        <div className="shrink-0 pt-1 text-center w-16">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
            Total
          </div>
          {hasBought ? (
            <div>
              <span
                className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: "oklch(0.94 0.08 65)",
                  color: "oklch(0.45 0.14 55)",
                }}
              >
                {allTotals!.total}
              </span>
              <div className="text-[9px] tabular-nums text-muted-foreground mt-0.5">
                AU {allTotals!.au} · USA {allTotals!.usa}
                {allTotals!.nyc > 0 ? ` · NYC ${allTotals!.nyc}` : ""}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </div>

        {/* Session qty entry */}
        {sessionActive && (
          <div className="shrink-0 pt-1">
            <div className="flex items-center gap-2">
              {(
                [
                  { label: "AU", field: "auQty" as const, val: au },
                  { label: "USA", field: "usaQty" as const, val: usa },
                  { label: "NYC", field: "nycQty" as const, val: nyc },
                ] as const
              ).map(({ label, field, val }) => (
                <div key={label} className="text-center w-14">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                    {label}
                  </div>
                  <QtyCell
                    value={val}
                    onSave={(v) => handleQty(c.style, c.colour, field, v)}
                    disabled={selectedSessionId == null}
                  />
                </div>
              ))}
              <div className="text-center w-12 border-l border-border pl-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                  This buy
                </div>
                <div className="text-sm font-semibold text-amber-600">
                  {sessionTotal || (
                    <span className="text-muted-foreground font-normal">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEditColour(c);
          }}
          className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-muted-foreground hover:text-amber-600 shrink-0 mt-1"
          title="Edit colour"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ─── Render a single style block ─────────────────────────────────────────────

  function renderStyleBlock(styleName: string, colours: HandbagStyle[]) {
    const isExpanded = expandedStyle === styleName;
    const totalBought = colours.reduce(
      (sum, c) => sum + (buyTotals.get(`${c.style}|${c.colour}`)?.total ?? 0),
      0
    );
    const sessionTotal = colours.reduce((sum, c) => {
      const item = sessionItemMap.get(`${c.style}|${c.colour}`);
      return sum + (item ? item.auQty + item.usaQty + item.nycQty : 0);
    }, 0);

    const headerImageUrl =
      colours[0]?.styleImageUrl ??
      colours.find((c) => c.imageUrl)?.imageUrl ??
      null;

    const sessionActive = selectedSessionId != null;

    // Split into bought (any all-session qty > 0) and not-bought
    const boughtColours = colours.filter(
      (c) => (buyTotals.get(`${c.style}|${c.colour}`)?.total ?? 0) > 0
    );
    const unboughtColours = colours.filter(
      (c) => (buyTotals.get(`${c.style}|${c.colour}`)?.total ?? 0) === 0
    );

    // Inline add colour draft
    const draft = addColourDraft[styleName];

    return (
      <div
        key={styleName}
        className="border border-border rounded-xl overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Style header row */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
          style={{
            background: isExpanded ? "oklch(0.97 0.04 65 / 0.6)" : "var(--card)",
          }}
          onClick={() => setExpandedStyle(isExpanded ? null : styleName)}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}

          {/* Style image thumbnail */}
          <StyleImageCell styleName={styleName} imageUrl={headerImageUrl} />

          {/* Style name — click to rename */}
          {renamingStyle === styleName ? (
            <input
              autoFocus
              className="font-semibold text-sm w-36 border border-amber-400 rounded px-1.5 py-0.5 bg-background"
              value={renameStyleDraft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setRenameStyleDraft(e.target.value.toUpperCase())}
              onBlur={() => {
                const v = renameStyleDraft.trim().toUpperCase();
                if (v && v !== styleName)
                  renameStyleMutation.mutate({ oldStyle: styleName, newStyle: v });
                else setRenamingStyle(null);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setRenamingStyle(null);
              }}
            />
          ) : (
            <span
              className="font-semibold text-sm shrink-0 cursor-text hover:text-amber-500 transition-colors"
              title="Click to rename style"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingStyle(styleName);
                setRenameStyleDraft(styleName);
              }}
            >
              {styleName}
            </span>
          )}

          <span className="text-xs text-muted-foreground">
            {colours.length} colour{colours.length !== 1 ? "s" : ""}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {totalBought > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium border"
                style={{
                  borderColor: "oklch(0.80 0.12 65)",
                  color: "oklch(0.50 0.14 55)",
                  background: "oklch(0.96 0.06 65)",
                }}
              >
                {totalBought} bought
              </span>
            )}
            {sessionActive && sessionTotal > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                style={{ background: "#f59e0b" }}
              >
                {sessionTotal} this session
              </span>
            )}
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-border">
            {/* Session context banner */}
            {selectedSessionId != null && (
              <div
                className="flex items-center gap-2 px-4 py-2 border-b"
                style={{
                  borderColor: "var(--border)",
                  background: "oklch(0.97 0.05 65 / 0.5)",
                }}
              >
                <span className="text-xs font-semibold text-muted-foreground">
                  ✏️ Entering qtys for:
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: "oklch(0.50 0.14 55)" }}
                >
                  {(sessions as BuySession[]).find((s) => s.id === selectedSessionId)?.name}
                </span>
              </div>
            )}

            {/* Inline Add colour form — always visible */}
            <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
              {draft ? (
                <div
                  className="flex items-center gap-2 p-2 rounded-lg border"
                  style={{
                    borderColor: "oklch(0.80 0.10 65)",
                    background: "oklch(0.98 0.02 65 / 0.5)",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Colour (e.g. PETAL NAPPA)"
                    value={draft.colour}
                    onChange={(e) =>
                      setAddColourDraft((prev) => ({
                        ...prev,
                        [styleName]: { ...prev[styleName], colour: e.target.value.toUpperCase() },
                      }))
                    }
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" && draft.colour.trim()) {
                        upsertStyle.mutate({
                          style: styleName,
                          colour: draft.colour.trim(),
                          material: draft.material.trim() || undefined,
                          section: draft.section || undefined,
                          rrp: null,
                          cost: null,
                        });
                        setAddColourDraft((prev) => {
                          const n = { ...prev };
                          delete n[styleName];
                          return n;
                        });
                      }
                      if (e.key === "Escape")
                        setAddColourDraft((prev) => {
                          const n = { ...prev };
                          delete n[styleName];
                          return n;
                        });
                    }}
                    className="flex-1 px-2 py-1 rounded border text-xs bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Material (e.g. Suede)"
                    value={draft.material}
                    onChange={(e) =>
                      setAddColourDraft((prev) => ({
                        ...prev,
                        [styleName]: { ...prev[styleName], material: e.target.value },
                      }))
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    className="flex-1 px-2 py-1 rounded border text-xs bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <select
                    value={draft.section}
                    onChange={(e) =>
                      setAddColourDraft((prev) => ({
                        ...prev,
                        [styleName]: { ...prev[styleName], section: e.target.value },
                      }))
                    }
                    className="px-2 py-1 rounded border text-xs bg-background focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">— section —</option>
                    {SECTION_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!draft.colour.trim()) return;
                      upsertStyle.mutate({
                        style: styleName,
                        colour: draft.colour.trim(),
                        material: draft.material.trim() || undefined,
                        section: draft.section || undefined,
                        rrp: null,
                        cost: null,
                      });
                      setAddColourDraft((prev) => {
                        const n = { ...prev };
                        delete n[styleName];
                        return n;
                      });
                    }}
                    disabled={!draft.colour.trim() || upsertStyle.isPending}
                    className="px-3 py-1 rounded text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: "oklch(0.65 0.16 65)" }}
                  >
                    {upsertStyle.isPending ? "Adding…" : "Add"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddColourDraft((prev) => {
                        const n = { ...prev };
                        delete n[styleName];
                        return n;
                      });
                    }}
                    className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddColourDraft((prev) => ({
                      ...prev,
                      [styleName]: { colour: "", material: "", section: "New Season" },
                    }));
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/50 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add colour
                </button>
              )}
            </div>

            {/* Bought colourways */}
            {boughtColours.length > 0 && (
              <div>
                <div
                  className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "oklch(0.50 0.14 55)", background: "oklch(0.97 0.04 65 / 0.4)" }}
                >
                  Bought ({boughtColours.length})
                </div>
                <div className="divide-y divide-border">
                  {boughtColours.map((c) => renderColourRow(c, sessionActive))}
                </div>
              </div>
            )}

            {/* Unbought colourways */}
            {unboughtColours.length > 0 && (
              <div>
                <div
                  className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border-t"
                  style={{
                    color: "var(--muted-foreground)",
                    borderColor: "var(--border)",
                    background: "var(--muted)",
                  }}
                >
                  Not yet bought ({unboughtColours.length})
                </div>
                <div className="divide-y divide-border">
                  {unboughtColours.map((c) => renderColourRow(c, sessionActive))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Export ───────────────────────────────────────────────────────────────────

  function handleExport() {
    if (styles.length === 0) {
      toast.error("No handbag styles to export");
      return;
    }

    // Build rows: one row per colourway, sorted by style then colour
    const sorted = [...(styles as HandbagStyle[])].sort((a, b) =>
      a.style.localeCompare(b.style) || a.colour.localeCompare(b.colour)
    );

    const COLS = 8; // STYLE | COLOUR | MATERIAL | SECTION | RRP | COST | AU BOUGHT | USA BOUGHT
    const sheetRows: (string | number)[][] = [];
    const rowTypes: string[] = [];

    const emptyRow = Array(COLS).fill("") as string[];

    // Title
    sheetRows.push(["TONY BIANCO — HANDBAGS SS26", ...Array(COLS - 1).fill("") as string[]]);
    rowTypes.push("title");
    // Spacer
    sheetRows.push([...emptyRow]);
    rowTypes.push("spacer");
    // Header
    sheetRows.push(["STYLE", "COLOUR", "MATERIAL", "SECTION", "RRP", "COST", "AU BOUGHT", "USA BOUGHT"]);
    rowTypes.push("header");

    let prevStyle = "";
    for (const c of sorted) {
      const totals = buyTotals.get(`${c.style}|${c.colour}`);
      const dataRow: (string | number)[] = [
        c.style !== prevStyle ? c.style : "",
        c.colour,
        c.material ?? "",
        c.section ?? "",
        c.rrp != null ? c.rrp : "",
        c.cost != null ? c.cost : "",
        totals?.au ?? 0,
        totals?.usa ?? 0,
      ];
      sheetRows.push(dataRow);
      rowTypes.push(c.style !== prevStyle ? "data-first" : "data");
      prevStyle = c.style;
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);

    ws["!cols"] = [
      { wch: 18 }, // STYLE
      { wch: 24 }, // COLOUR
      { wch: 16 }, // MATERIAL
      { wch: 20 }, // SECTION
      { wch: 10 }, // RRP
      { wch: 10 }, // COST
      { wch: 12 }, // AU BOUGHT
      { wch: 12 }, // USA BOUGHT
    ];

    ws["!rows"] = sheetRows.map((_, i) => {
      if (rowTypes[i] === "title")  return { hpt: 27.95 };
      if (rowTypes[i] === "spacer") return { hpt: 15.95 };
      if (rowTypes[i] === "header") return { hpt: 20.1 };
      return { hpt: 15.95 };
    });

    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }];

    const darkFill = { patternType: "solid", fgColor: { rgb: "1A1A1A" } };
    const whiteFont = { name: "Calibri", sz: 12, bold: true, color: { rgb: "FFFFFF" } };
    const boldFont  = { name: "Calibri", sz: 11, bold: true };
    const plainFont = { name: "Calibri", sz: 11, bold: false };
    const numCols = [4, 5, 6, 7]; // RRP, COST, AU BOUGHT, USA BOUGHT

    for (let R = 0; R < sheetRows.length; R++) {
      const type = rowTypes[R];
      for (let C = 0; C < COLS; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        const isNum = numCols.includes(C);
        if (type === "title") {
          ws[addr].s = { font: whiteFont, fill: darkFill, alignment: { horizontal: "center", vertical: "center" } };
        } else if (type === "spacer") {
          ws[addr].s = {};
        } else if (type === "header") {
          ws[addr].s = { font: whiteFont, fill: darkFill, alignment: { horizontal: isNum ? "right" : "center", vertical: "center" } };
        } else if (type === "data-first") {
          ws[addr].s = { font: boldFont, alignment: { horizontal: isNum ? "right" : "left", vertical: "center" } };
        } else {
          ws[addr].s = { font: plainFont, alignment: { horizontal: isNum ? "right" : "left", vertical: "center" } };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Handbags");
    const today = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
    XLSX.writeFile(wb, `Handbags_SS26_${today}.xlsx`, { bookType: "xlsx", cellStyles: true });
    toast.success(`Exported ${sorted.length} colourways`);
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  const totalColourways = styles.length;
  const totalStyles = styleGroups.size;

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            Handbags — SS26
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalColourways} colourways across {totalStyles} styles
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={styles.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 dark:hover:bg-amber-950/20 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Session bar */}
      <HandbagSessionBar
        sessions={sessions as BuySession[]}
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
        onDeselect={() => setSelectedSessionId(null)}
        onCreated={(id) => setSelectedSessionId(id)}
      />

      {/* Grand total buy summary */}
      {grandTotals.total > 0 && (
        <div
          className="flex items-center gap-4 px-4 py-2.5 rounded-xl border"
          style={{
            background: "oklch(0.97 0.05 65 / 0.6)",
            borderColor: "oklch(0.85 0.08 65)",
          }}
        >
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "oklch(0.50 0.14 55)" }}
          >
            Total Bought
          </span>
          <div className="flex items-center gap-3 text-sm">
            <span
              className="font-semibold tabular-nums"
              style={{ color: "oklch(0.35 0.12 55)" }}
            >
              AU <span className="text-base font-bold">{grandTotals.au.toLocaleString()}</span>
            </span>
            <span className="text-muted-foreground">·</span>
            <span
              className="font-semibold tabular-nums"
              style={{ color: "oklch(0.35 0.12 55)" }}
            >
              USA <span className="text-base font-bold">{grandTotals.usa.toLocaleString()}</span>
            </span>
            {grandTotals.nyc > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: "oklch(0.35 0.12 55)" }}
                >
                  NYC{" "}
                  <span className="text-base font-bold">
                    {grandTotals.nyc.toLocaleString()}
                  </span>
                </span>
              </>
            )}
            <span className="text-muted-foreground">·</span>
            <span
              className="font-bold tabular-nums text-base"
              style={{ color: "oklch(0.45 0.16 55)" }}
            >
              {grandTotals.total.toLocaleString()} units total
            </span>
          </div>
        </div>
      )}

      {/* Style list */}
      <div className="flex flex-col gap-2">
        {sortedStyleNames.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No handbag styles yet</p>
          </div>
        ) : (
          sortedStyleNames.map((styleName) =>
            renderStyleBlock(styleName, styleGroups.get(styleName)!)
          )
        )}
      </div>

      {/* Add / Edit colour modal */}
      <Dialog
        open={!!colourModal}
        onOpenChange={(open) => {
          if (!open) setColourModal(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {colourModal?.mode === "add"
                ? `Add colour to ${colourModal.style}`
                : `Edit ${colourModal?.row?.colour}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                Colour name *
              </label>
              <Input
                autoFocus
                placeholder="e.g. PETAL NAPPA"
                value={modalColour}
                onChange={(e) => setModalColour(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitColourModal();
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                Material
              </label>
              <Input
                placeholder="e.g. Suede"
                value={modalMaterial}
                onChange={(e) => setModalMaterial(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                Section
              </label>
              <select
                value={modalSection}
                onChange={(e) => setModalSection(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— no section —</option>
                <option value="Core / Carry Over">Core / Carry Over</option>
                <option value="New Season">New Season</option>
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                  RRP
                </label>
                <Input
                  placeholder="0.00"
                  value={modalRrp}
                  onChange={(e) => setModalRrp(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                  Cost
                </label>
                <Input
                  placeholder="0.00"
                  value={modalCost}
                  onChange={(e) => setModalCost(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColourModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitColourModal}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {colourModal?.mode === "add" ? "Add colour" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete session confirm dialog */}
      <Dialog
        open={!!confirmDeleteSession}
        onOpenChange={() => setConfirmDeleteSession(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete session "{confirmDeleteSession?.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all buy quantities in this session.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteSession(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmDeleteSession &&
                deleteSession.mutate({ id: confirmDeleteSession.id })
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
