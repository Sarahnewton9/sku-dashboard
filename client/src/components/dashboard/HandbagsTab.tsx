import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronRight, ShoppingBag } from "lucide-react";
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

const SECTION_ORDER = ["Core / Carry Over", "New Season", "Winter Recut"];

function sectionLabel(s: string | null) {
  if (!s) return "Other";
  return s;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

// ─── Inline qty cell ─────────────────────────────────────────────────────────

function QtyCell({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

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
      className="cursor-pointer min-w-[2.5rem] inline-block text-center hover:bg-muted rounded px-1 py-0.5 text-sm"
      onClick={() => { setDraft(String(value)); setEditing(true); }}
    >
      {value || <span className="text-muted-foreground">—</span>}
    </span>
  );
}

// ─── Price edit cell ─────────────────────────────────────────────────────────

function PriceCell({
  value,
  onSave,
  prefix = "$",
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  prefix?: string;
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

  // Mutations
  const upsertStyle = trpc.handbag.upsertStyle.useMutation({
    onSuccess: () => utils.handbag.listStyles.invalidate(),
    onError: () => toast.error("Failed to save"),
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
    // Sort sections
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

  function toggleStyle(style: string) {
    setExpandedStyles(prev => {
      const next = new Set(prev);
      if (next.has(style)) next.delete(style); else next.add(style);
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
                {[...styleMap.entries()].map(([styleName, colours]) => {
                  const isExpanded = expandedStyles.has(styleName);
                  const totalBought = colours.reduce((sum, c) => {
                    return sum + (buyTotals.get(`${c.style}|${c.colour}`)?.total ?? 0);
                  }, 0);
                  return (
                    <div key={styleName} className="border border-border rounded-lg overflow-hidden">
                      {/* Style header row */}
                      <button
                        onClick={() => toggleStyle(styleName)}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors text-left"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <span className="font-semibold text-sm w-28 shrink-0">{styleName}</span>
                        <span className="text-xs text-muted-foreground">{colours.length} colour{colours.length !== 1 ? "s" : ""}</span>
                        {totalBought > 0 && (
                          <Badge variant="outline" className="ml-auto text-xs border-amber-400 text-amber-600">
                            {totalBought} bought
                          </Badge>
                        )}
                      </button>
                      {/* Colour rows */}
                      {isExpanded && (
                        <div className="border-t border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/30 text-xs text-muted-foreground">
                                <th className="text-left px-4 py-2 font-medium w-36">Colour</th>
                                <th className="text-left px-4 py-2 font-medium w-36">Material</th>
                                <th className="text-right px-4 py-2 font-medium w-24">RRP</th>
                                <th className="text-right px-4 py-2 font-medium w-24">Cost</th>
                                <th className="text-right px-4 py-2 font-medium w-24">AU Bought</th>
                                <th className="text-right px-4 py-2 font-medium w-24">USA Bought</th>
                                <th className="text-right px-4 py-2 font-medium w-24">NYC Bought</th>
                                <th className="text-left px-4 py-2 font-medium">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {colours.map((c) => {
                                const totals = buyTotals.get(`${c.style}|${c.colour}`);
                                return (
                                  <tr key={c.colour} className="border-t border-border hover:bg-muted/20">
                                    <td className="px-4 py-2 font-medium">{c.colour}</td>
                                    <td className="px-4 py-2 text-muted-foreground">{c.material ?? "—"}</td>
                                    <td className="px-4 py-2 text-right">
                                      <PriceCell
                                        value={c.rrp}
                                        onSave={(v) => upsertStyle.mutate({ style: c.style, colour: c.colour, rrp: v })}
                                      />
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <PriceCell
                                        value={c.cost}
                                        onSave={(v) => upsertStyle.mutate({ style: c.style, colour: c.colour, cost: v })}
                                      />
                                    </td>
                                    <td className="px-4 py-2 text-right text-muted-foreground">{totals?.au || "—"}</td>
                                    <td className="px-4 py-2 text-right text-muted-foreground">{totals?.usa || "—"}</td>
                                    <td className="px-4 py-2 text-right text-muted-foreground">{totals?.nyc || "—"}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{c.notes ?? ""}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
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
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select or create a buy session to enter quantities</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {[...grouped.entries()].map(([section, styleMap]) => (
                <div key={section}>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 border-b border-border pb-1">
                    {section}
                  </div>
                  <div className="flex flex-col gap-1">
                    {[...styleMap.entries()].map(([styleName, colours]) => {
                      const isExpanded = expandedStyles.has(`buy-${styleName}`);
                      const sessionTotal = colours.reduce((sum, c) => {
                        const item = sessionItems.get(`${c.style}|${c.colour}`);
                        return sum + (item ? item.auQty + item.usaQty + item.nycQty : 0);
                      }, 0);
                      return (
                        <div key={styleName} className="border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => {
                              const key = `buy-${styleName}`;
                              setExpandedStyles(prev => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key); else next.add(key);
                                return next;
                              });
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors text-left"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                            <span className="font-semibold text-sm w-28 shrink-0">{styleName}</span>
                            <span className="text-xs text-muted-foreground">{colours.length} colour{colours.length !== 1 ? "s" : ""}</span>
                            {sessionTotal > 0 && (
                              <Badge variant="outline" className="ml-auto text-xs border-amber-400 text-amber-600">
                                {sessionTotal} units
                              </Badge>
                            )}
                          </button>
                          {isExpanded && (
                            <div className="border-t border-border">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/30 text-xs text-muted-foreground">
                                    <th className="text-left px-4 py-2 font-medium w-36">Colour</th>
                                    <th className="text-left px-4 py-2 font-medium w-36">Material</th>
                                    <th className="text-right px-4 py-2 font-medium w-24">RRP</th>
                                    <th className="text-center px-4 py-2 font-medium w-24">AU</th>
                                    <th className="text-center px-4 py-2 font-medium w-24">USA</th>
                                    <th className="text-center px-4 py-2 font-medium w-24">NYC</th>
                                    <th className="text-center px-4 py-2 font-medium w-20">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {colours.map((c) => {
                                    const item = sessionItems.get(`${c.style}|${c.colour}`);
                                    const au = item?.auQty ?? 0;
                                    const usa = item?.usaQty ?? 0;
                                    const nyc = item?.nycQty ?? 0;
                                    return (
                                      <tr key={c.colour} className="border-t border-border hover:bg-muted/20">
                                        <td className="px-4 py-2 font-medium">{c.colour}</td>
                                        <td className="px-4 py-2 text-muted-foreground">{c.material ?? "—"}</td>
                                        <td className="px-4 py-2 text-right text-muted-foreground">{fmt(c.rrp)}</td>
                                        <td className="px-4 py-2 text-center">
                                          <QtyCell value={au} onSave={(v) => handleQty(c.style, c.colour, "auQty", v)} />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                          <QtyCell value={usa} onSave={(v) => handleQty(c.style, c.colour, "usaQty", v)} />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                          <QtyCell value={nyc} onSave={(v) => handleQty(c.style, c.colour, "nycQty", v)} />
                                        </td>
                                        <td className="px-4 py-2 text-center font-medium">
                                          {au + usa + nyc > 0 ? au + usa + nyc : <span className="text-muted-foreground">—</span>}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
