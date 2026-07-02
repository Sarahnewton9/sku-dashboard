import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronRight, ShoppingBag, ImageIcon, X, Upload, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

// ─── Inline qty cell ─────────────────────────────────────────────────────────

function QtyCell({ value, onSave, disabled }: { value: number; onSave: (v: number) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (disabled) {
    return <span className="min-w-[2.5rem] inline-block text-center text-sm text-muted-foreground">{value || "—"}</span>;
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="w-16 text-center border border-amber-400 rounded px-1 py-0.5 text-sm bg-background"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = parseInt(draft, 10);
          if (!isNaN(n) && n >= 0) onSave(n);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
        }}
      />
    );
  }
  return (
    <span
      className="cursor-pointer min-w-[2.5rem] inline-block text-center hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded px-1 py-0.5 text-sm border border-transparent hover:border-amber-300 transition-colors"
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      title="Click to edit"
    >
      {value ? <span className="font-medium text-amber-700 dark:text-amber-400">{value}</span> : <span className="text-muted-foreground">—</span>}
    </span>
  );
}

// ─── Price edit cell ─────────────────────────────────────────────────────────

function PriceCell({ value, onSave, prefix = "$" }: { value: number | null; onSave: (v: number | null) => void; prefix?: string }) {
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
          if (e.key === "Escape") { setDraft(value != null ? String(value) : ""); setEditing(false); }
        }}
      />
    );
  }
  return (
    <span
      className="cursor-pointer hover:bg-muted rounded px-1 py-0.5 text-sm"
      onClick={() => { setDraft(value != null ? String(value) : ""); setEditing(true); }}
      title="Click to edit"
    >
      {value != null ? `${prefix}${value.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
    </span>
  );
}

// ─── Image cell ───────────────────────────────────────────────────────────────

function ImageCell({ style, colour, imageUrl }: { style: string; colour: string; imageUrl: string | null }) {
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
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadImage.mutate({ style, colour, imageBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  if (imageUrl) {
    return (
      <>
        <div className="relative group w-24 h-24 shrink-0">
          <img
            src={imageUrl}
            alt={`${style} ${colour}`}
            className="w-24 h-24 object-contain rounded-md border border-border cursor-pointer hover:opacity-90 transition-opacity bg-white"
            onClick={() => setLightbox(true)}
          />
          <button
            onClick={(e) => { e.stopPropagation(); removeImage.mutate({ style, colour }); }}
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
            <img src={imageUrl} alt={`${style} ${colour}`} className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-24 h-24 shrink-0 border-2 border-dashed border-border rounded-md flex flex-col items-center justify-center gap-0.5 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-muted-foreground hover:text-amber-600 disabled:opacity-50"
        title="Upload image"
      >
        {uploading ? (
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <ImageIcon className="w-4 h-4" />
            <span className="text-[9px] leading-tight">Upload</span>
          </>
        )}
      </button>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HandbagsTab() {
  const utils = trpc.useUtils();

  // Data
  const { data: styles = [] } = trpc.handbag.listStyles.useQuery();
  const { data: sessions = [] } = trpc.handbag.listSessions.useQuery();
  const { data: allBuyItems = [] } = trpc.handbag.listBuyItems.useQuery({});

  // UI state
  const [activeSession, setActiveSession] = useState<number | null>(null);
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());
  const [newSessionName, setNewSessionName] = useState("");
  const [showNewSession, setShowNewSession] = useState(false);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<BuySession | null>(null);
  const [activeTab, setActiveTab] = useState<"styles" | "buy">("styles");

  // Rename state
  const [renamingStyle, setRenamingStyle] = useState<string | null>(null);
  const [renameStyleDraft, setRenameStyleDraft] = useState("");
  const [renamingColour, setRenamingColour] = useState<{ style: string; colour: string } | null>(null);
  const [renameColourDraft, setRenameColourDraft] = useState("");

  // Add/Edit colour modal state
  type ColourModalMode = "add" | "edit";
  const [colourModal, setColourModal] = useState<{ mode: ColourModalMode; style: string; row?: HandbagStyle } | null>(null);
  const [modalColour, setModalColour] = useState("");
  const [modalMaterial, setModalMaterial] = useState("");
  const [modalSection, setModalSection] = useState("");
  const [modalRrp, setModalRrp] = useState("");
  const [modalCost, setModalCost] = useState("");

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
    if (!colour) { toast.error("Colour name is required"); return; }
    const rrp = modalRrp ? parseFloat(modalRrp) : null;
    const cost = modalCost ? parseFloat(modalCost) : null;
    const section = modalSection || null;
    const material = modalMaterial.trim() || null;

    if (colourModal.mode === "edit" && colourModal.row) {
      const old = colourModal.row;
      // If colour name changed, rename first then upsert other fields
      if (colour !== old.colour) {
        await new Promise<void>((resolve, reject) =>
          renameColour.mutate({ style: old.style, oldColour: old.colour, newColour: colour }, { onSuccess: () => resolve(), onError: () => reject() })
        ).catch(() => { toast.error("Failed to rename colour"); return; });
      }
      upsertStyle.mutate({ style: old.style, colour, material, section, rrp, cost });
    } else {
      upsertStyle.mutate({ style: colourModal.style, colour, material, section, rrp, cost });
    }
    setColourModal(null);
  }

  // Mutations
  const upsertStyle = trpc.handbag.upsertStyle.useMutation({
    onSuccess: () => utils.handbag.listStyles.invalidate(),
    onError: () => toast.error("Failed to save"),
  });

  const renameStyle = trpc.handbag.renameStyle.useMutation({
    onSuccess: () => { utils.handbag.listStyles.invalidate(); utils.handbag.listBuyItems.invalidate(); setRenamingStyle(null); toast.success("Style renamed"); },
    onError: () => toast.error("Failed to rename style"),
  });

  const renameColour = trpc.handbag.renameColour.useMutation({
    onSuccess: () => { utils.handbag.listStyles.invalidate(); utils.handbag.listBuyItems.invalidate(); setRenamingColour(null); toast.success("Colour renamed"); },
    onError: () => toast.error("Failed to rename colour"),
  });

  const createSession = trpc.handbag.createSession.useMutation({
    onSuccess: (data) => {
      utils.handbag.listSessions.invalidate();
      setActiveSession(data.id);
      setNewSessionName("");
      setShowNewSession(false);
      toast.success(`Session "${data.name}" created`);
    },
    onError: () => toast.error("Failed to create session"),
  });

  const deleteSession = trpc.handbag.deleteSession.useMutation({
    onSuccess: () => {
      utils.handbag.listSessions.invalidate();
      utils.handbag.listBuyItems.invalidate();
      setConfirmDeleteSession(null);
      if (activeSession === confirmDeleteSession?.id) setActiveSession(null);
      toast.success("Session deleted");
    },
  });

  const upsertBuyItem = trpc.handbag.upsertBuyItem.useMutation({
    onSuccess: () => utils.handbag.listBuyItems.invalidate(),
    onError: () => toast.error("Failed to save quantity"),
  });

  // Group styles by section then by style name
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, HandbagStyle[]>>();
    for (const s of styles as HandbagStyle[]) {
      const sec = sectionLabel(s.section);
      if (!map.has(sec)) map.set(sec, new Map());
      const styleMap = map.get(sec)!;
      if (!styleMap.has(s.style)) styleMap.set(s.style, []);
      styleMap.get(s.style)!.push(s);
    }
    const sorted = new Map<string, Map<string, HandbagStyle[]>>();
    const allSections = [...map.keys()].sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a);
      const bi = SECTION_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    for (const sec of allSections) sorted.set(sec, map.get(sec)!);
    return sorted;
  }, [styles]);

  // Build buy totals per style+colour across all sessions
  const buyTotals = useMemo(() => {
    const map = new Map<string, { au: number; usa: number; nyc: number; total: number }>();
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

  // Active session buy items
  const sessionItems = useMemo(() => {
    if (activeSession == null) return new Map<string, BuyItem>();
    const map = new Map<string, BuyItem>();
    for (const item of allBuyItems as BuyItem[]) {
      if (item.sessionId === activeSession) {
        map.set(`${item.style}|${item.colour}`, item);
      }
    }
    return map;
  }, [allBuyItems, activeSession]);

  function toggleStyle(key: string) {
    setExpandedStyles(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleQty(style: string, colour: string, field: "auQty" | "usaQty" | "nycQty", value: number) {
    if (activeSession == null) return;
    const key = `${style}|${colour}`;
    const existing = sessionItems.get(key);
    upsertBuyItem.mutate({
      sessionId: activeSession,
      style,
      colour,
      auQty: field === "auQty" ? value : (existing?.auQty ?? 0),
      usaQty: field === "usaQty" ? value : (existing?.usaQty ?? 0),
      nycQty: field === "nycQty" ? value : (existing?.nycQty ?? 0),
    });
  }

  const activeSessionObj = (sessions as BuySession[]).find(s => s.id === activeSession);

  // ─── Shared style rows renderer ────────────────────────────────────────────

  function renderStyleRows(section: string, styleMap: Map<string, HandbagStyle[]>, mode: "styles" | "buy") {
    return [...styleMap.entries()].map(([styleName, colours]) => {
      const expandKey = `${mode}-${styleName}`;
      const isExpanded = expandedStyles.has(expandKey);
      const totalBought = colours.reduce((sum, c) => sum + (buyTotals.get(`${c.style}|${c.colour}`)?.total ?? 0), 0);
      const sessionTotal = mode === "buy" ? colours.reduce((sum, c) => {
        const item = sessionItems.get(`${c.style}|${c.colour}`);
        return sum + (item ? item.auQty + item.usaQty + item.nycQty : 0);
      }, 0) : 0;

      return (
        <div key={styleName} className="border border-border rounded-lg overflow-hidden">
          {/* Style header */}
          <button
            onClick={() => toggleStyle(expandKey)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors text-left"
          >
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            {renamingStyle === styleName ? (
              <input
                autoFocus
                className="font-semibold text-sm w-36 border border-amber-400 rounded px-1.5 py-0.5 bg-background"
                value={renameStyleDraft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenameStyleDraft(e.target.value)}
                onBlur={() => {
                  const v = renameStyleDraft.trim().toUpperCase();
                  if (v && v !== styleName) renameStyle.mutate({ oldStyle: styleName, newStyle: v });
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
                className="font-semibold text-sm w-32 shrink-0 cursor-text hover:text-amber-500 transition-colors"
                title="Click to rename style"
                onClick={(e) => { e.stopPropagation(); setRenamingStyle(styleName); setRenameStyleDraft(styleName); }}
              >{styleName}</span>
            )}
            <span className="text-xs text-muted-foreground">{colours.length} colour{colours.length !== 1 ? "s" : ""}</span>
            <div className="ml-auto flex items-center gap-2">
              {totalBought > 0 && (
                <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                  {totalBought} bought
                </Badge>
              )}
              {mode === "buy" && sessionTotal > 0 && (
                <Badge className="text-xs bg-amber-500 text-white">
                  {sessionTotal} this session
                </Badge>
              )}
            </div>
          </button>

          {/* Colour rows */}
          {isExpanded && (
            <div className="border-t border-border">
              {mode === "styles" ? (
                /* ── BY STYLE view ── */
                <div className="divide-y divide-border">
                  {colours.map((c) => {
                    const totals = buyTotals.get(`${c.style}|${c.colour}`);
                    return (
                      <div key={c.colour} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 group/row">
                        {/* Image */}
                        <ImageCell style={c.style} colour={c.colour} imageUrl={c.imageUrl} />
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{c.colour}</div>
                          {c.material && <div className="text-xs text-muted-foreground">{c.material}</div>}
                          {c.section && (
                            <span className="mt-1 inline-block text-[10px] rounded px-1.5 py-0.5 border border-border bg-muted text-muted-foreground">
                              {c.section}
                            </span>
                          )}
                        </div>
                        {/* Prices */}
                        <div className="flex items-center gap-6 text-sm shrink-0">
                          <div className="text-right">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">RRP</div>
                            <span className="text-sm">{c.rrp != null ? `$${c.rrp.toFixed(2)}` : <span className="text-muted-foreground">—</span>}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Cost</div>
                            <span className="text-sm">{c.cost != null ? `$${c.cost.toFixed(2)}` : <span className="text-muted-foreground">—</span>}</span>
                          </div>
                        </div>
                        {/* Buy totals */}
                        <div className="flex items-center gap-3 shrink-0 border-l border-border pl-4">
                          {[
                            { label: "AU", val: totals?.au },
                            { label: "USA", val: totals?.usa },
                            { label: "NYC", val: totals?.nyc },
                          ].map(({ label, val }) => (
                            <div key={label} className="text-center w-12">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
                              <div className="text-sm font-medium">{val || <span className="text-muted-foreground">—</span>}</div>
                            </div>
                          ))}
                        </div>
                        {/* Edit button */}
                        <button
                          onClick={() => openEditColour(c)}
                          className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-muted-foreground hover:text-amber-600 shrink-0"
                          title="Edit colour"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {/* Add colour row */}
                  <button
                    onClick={() => openAddColour(colours[0]?.style ?? "")}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors border-t border-dashed border-border"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add colour
                  </button>
                </div>
              ) : (
                /* ── BUY view ── */
                <div className="divide-y divide-border">
                  {colours.map((c) => {
                    const item = sessionItems.get(`${c.style}|${c.colour}`);
                    const au = item?.auQty ?? 0;
                    const usa = item?.usaQty ?? 0;
                    const nyc = item?.nycQty ?? 0;
                    const allTotals = buyTotals.get(`${c.style}|${c.colour}`);
                    return (
                      <div key={c.colour} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20">
                        {/* Image */}
                        <ImageCell style={c.style} colour={c.colour} imageUrl={c.imageUrl} />
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{c.colour}</div>
                          {c.material && <div className="text-xs text-muted-foreground">{c.material}</div>}
                          {c.rrp && <div className="text-xs text-muted-foreground">RRP {fmt(c.rrp)}</div>}
                        </div>
                        {/* This session qty entry */}
                        <div className="flex items-center gap-3 shrink-0">
                          {[
                            { label: "AU", field: "auQty" as const, val: au },
                            { label: "USA", field: "usaQty" as const, val: usa },
                            { label: "NYC", field: "nycQty" as const, val: nyc },
                          ].map(({ label, field, val }) => (
                            <div key={label} className="text-center w-16">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
                              <QtyCell
                                value={val}
                                onSave={(v) => handleQty(c.style, c.colour, field, v)}
                                disabled={activeSession == null}
                              />
                            </div>
                          ))}
                          <div className="text-center w-14 border-l border-border pl-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Total</div>
                            <div className="text-sm font-semibold text-amber-600">
                              {au + usa + nyc || <span className="text-muted-foreground font-normal">—</span>}
                            </div>
                          </div>
                        </div>
                        {/* All-time totals */}
                        {allTotals && allTotals.total > 0 && (
                          <div className="text-right shrink-0 border-l border-border pl-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">All buys</div>
                            <div className="text-sm text-muted-foreground">{allTotals.total}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            Handbags — SS26
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {styles.length} colourways across {new Set((styles as HandbagStyle[]).map(s => s.style)).size} styles
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("styles")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === "styles" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            By Style
          </button>
          <button
            onClick={() => setActiveTab("buy")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === "buy" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            Buy
          </button>
        </div>
      </div>

      {/* ── BY STYLE TAB ── */}
      {activeTab === "styles" && (
        <div className="flex flex-col gap-6">
          {[...grouped.entries()].map(([section, styleMap]) => (
            <div key={section}>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 border-b border-border pb-1">
                {section}
              </div>
              <div className="flex flex-col gap-1">
                {renderStyleRows(section, styleMap, "styles")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BUY TAB ── */}
      {activeTab === "buy" && (
        <div className="flex flex-col gap-6">
          {/* Session selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Session:</span>
            {(sessions as BuySession[]).map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSession(s.id === activeSession ? null : s.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${s.id === activeSession ? "bg-amber-500 text-white border-amber-500" : "border-border bg-card hover:bg-muted"}`}
              >
                {s.name}
              </button>
            ))}
            {showNewSession ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  className="h-8 w-32 text-sm"
                  placeholder="e.g. 30.04"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSessionName.trim()) createSession.mutate({ name: newSessionName.trim() });
                    if (e.key === "Escape") { setShowNewSession(false); setNewSessionName(""); }
                  }}
                />
                <Button size="sm" variant="outline" onClick={() => { setShowNewSession(false); setNewSessionName(""); }}>Cancel</Button>
                <Button size="sm" onClick={() => { if (newSessionName.trim()) createSession.mutate({ name: newSessionName.trim() }); }}>Add</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowNewSession(true)}>
                <Plus className="w-3.5 h-3.5" /> New Session
              </Button>
            )}
            {activeSessionObj && (
              <button
                onClick={() => setConfirmDeleteSession(activeSessionObj)}
                className="ml-auto text-xs text-destructive hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Delete session
              </button>
            )}
          </div>

          {activeSession == null ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">No session selected</p>
              <p className="text-xs">Select a session above to enter quantities, or create a new one.</p>
              <p className="text-xs mt-3 opacity-70">You can still view all-time buy totals in the By Style tab.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {[...grouped.entries()].map(([section, styleMap]) => (
                <div key={section}>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 border-b border-border pb-1">
                    {section}
                  </div>
                  <div className="flex flex-col gap-1">
                    {renderStyleRows(section, styleMap, "buy")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit colour modal */}
      <Dialog open={!!colourModal} onOpenChange={(open) => { if (!open) setColourModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {colourModal?.mode === "add" ? `Add colour to ${colourModal.style}` : `Edit ${colourModal?.row?.colour}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Colour name *</label>
              <Input
                autoFocus
                placeholder="e.g. PETAL NAPPA"
                value={modalColour}
                onChange={(e) => setModalColour(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") submitColourModal(); }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Material</label>
              <Input
                placeholder="e.g. Suede"
                value={modalMaterial}
                onChange={(e) => setModalMaterial(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Section</label>
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
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">RRP</label>
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
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Cost</label>
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
            <Button variant="outline" onClick={() => setColourModal(null)}>Cancel</Button>
            <Button onClick={submitColourModal} className="bg-amber-500 hover:bg-amber-600 text-white">
              {colourModal?.mode === "add" ? "Add colour" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete session confirm dialog */}
      <Dialog open={!!confirmDeleteSession} onOpenChange={() => setConfirmDeleteSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete session "{confirmDeleteSession?.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete all buy quantities in this session.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteSession(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeleteSession && deleteSession.mutate({ id: confirmDeleteSession.id })}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
