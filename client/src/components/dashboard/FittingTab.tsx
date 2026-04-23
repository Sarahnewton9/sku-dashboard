import React, { useState, useCallback, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronDown, ChevronRight, Upload, X, ImageIcon, Download,
  CheckCircle, RotateCcw, Search, Plus, Calendar, User, ZoomIn,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────────────────────────

const NEW_LASTS = [
  "DAZIE", "SIA", "SALLY", "TIANA", "BILLIE", "MATISSE",
  "EDGY", "EMBER", "TILDA", "LUCY", "ENVY", "FINCH",
  "HARLEY", "JAYDE", "ROXIE", "VIVA", "PIXIE",
];

export const FIT_LABELS: Record<string, string> = {
  tts: "True to Size",
  runs_small: "Runs Small",
  runs_large: "Runs Large",
};

export const FIT_COLOURS: Record<string, string> = {
  tts: "bg-green-100 text-green-800 border-green-200",
  runs_small: "bg-amber-100 text-amber-800 border-amber-200",
  runs_large: "bg-blue-100 text-blue-800 border-blue-200",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface StyleEntry {
  style: string;
  last: string;
  category: string;
  imageUrl?: string;
  hasNew: boolean;
  isAllNew: boolean;
  newSKUs: number;
  totalSKUs: number;
}

interface FittingSession {
  id: number;
  style: string;
  fitModel: string;
  sessionDate: string;
  notes?: string | null;
  images: Array<{ id: number; sessionId: number; style: string; imageUrl: string; fileKey: string }>;
}

// ─── Build style list ─────────────────────────────────────────────────────────

function buildStyleList(): StyleEntry[] {
  return skuData.styles
    .filter((s) => {
      const lastUpper = (s.last ?? "").toUpperCase();
      const isOnNewLast = NEW_LASTS.some((nl) => lastUpper.includes(nl));
      return isOnNewLast || s.isAllNew;
    })
    .map((s) => ({
      style: s.style,
      last: s.last,
      category: s.category,
      imageUrl: s.imageUrl,
      hasNew: s.hasNew,
      isAllNew: s.isAllNew,
      newSKUs: s.newSKUs,
      totalSKUs: s.totalSKUs,
    }))
    .sort((a, b) => a.last.localeCompare(b.last) || a.style.localeCompare(b.style));
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Fitting"
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onUploadImage,
  onDeleteImage,
  onUpdateSession,
  onDeleteSession,
}: {
  session: FittingSession;
  onUploadImage: (sessionId: number, style: string, file: File) => void;
  onDeleteImage: (id: number) => void;
  onUpdateSession: (id: number, fitModel: string, sessionDate: string, notes: string | null) => void;
  onDeleteSession: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localModel, setLocalModel] = useState(session.fitModel);
  const [localDate, setLocalDate] = useState(session.sessionDate);
  const [localNotes, setLocalNotes] = useState(session.notes ?? "");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onUpdateSession(session.id, localModel, localDate, localNotes || null);
    setEditing(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadImage(session.id, session.style, file);
    e.target.value = "";
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* Session header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3 text-sm">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          {editing ? (
            <input
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              placeholder="Fit model name"
              className="border border-border rounded px-2 py-0.5 text-sm bg-background w-40"
            />
          ) : (
            <span className="font-medium">{session.fitModel || "—"}</span>
          )}
          <Calendar className="w-3.5 h-3.5 text-muted-foreground ml-2" />
          {editing ? (
            <input
              type="date"
              value={localDate}
              onChange={(e) => setLocalDate(e.target.value)}
              className="border border-border rounded px-2 py-0.5 text-sm bg-background"
            />
          ) : (
            <span className="text-muted-foreground">
              {session.sessionDate ? new Date(session.sessionDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="h-7 text-xs">Cancel</Button>
              <Button size="sm" onClick={handleSave} className="h-7 text-xs">Save</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 text-xs text-muted-foreground">Edit</Button>
              <Button
                size="sm" variant="ghost"
                onClick={() => { if (confirm("Delete this fitting session and all its images?")) onDeleteSession(session.id); }}
                className="h-7 text-xs text-destructive hover:text-destructive"
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Session notes */}
      {editing ? (
        <div className="px-4 pt-3">
          <Textarea
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            placeholder="Session notes (fit observations, adjustments needed...)"
            className="text-sm min-h-[60px] resize-none"
          />
        </div>
      ) : session.notes ? (
        <div className="px-4 pt-3 text-sm text-muted-foreground italic">{session.notes}</div>
      ) : null}

      {/* Images */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          {session.images.map((img) => (
            <div key={img.id} className="relative group">
              <button
                onClick={() => setLightboxSrc(img.imageUrl)}
                className="block w-20 h-20 rounded border border-border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
              >
                <img src={img.imageUrl} alt="Fitting" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
              <button
                onClick={() => onDeleteImage(img.id)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 border-2 border-dashed border-border rounded flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Add Photo</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        </div>
      </div>
    </div>
  );
}

// ─── Style Fit Row ────────────────────────────────────────────────────────────

function StyleFitRow({
  entry,
  styleMeta,
  sessions,
  onFitUpdate,
  onCreateSession,
  onUploadImage,
  onDeleteImage,
  onUpdateSession,
  onDeleteSession,
  onApprove,
  onUndoApproval,
  imageOverrides,
}: {
  entry: StyleEntry;
  styleMeta: Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null }>;
  sessions: FittingSession[];
  onFitUpdate: (style: string, fitRating: string | null, notes: string | null) => void;
  onCreateSession: (style: string) => void;
  onUploadImage: (sessionId: number, style: string, file: File) => void;
  onDeleteImage: (id: number) => void;
  onUpdateSession: (id: number, fitModel: string, sessionDate: string, notes: string | null) => void;
  onDeleteSession: (id: number) => void;
  onApprove: (style: string) => void;
  onUndoApproval: (style: string) => void;
  imageOverrides: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localFit, setLocalFit] = useState<string | null | undefined>(undefined);

  const meta = styleMeta[entry.style];
  const fitRating = localFit !== undefined ? localFit : (meta?.fitRating ?? null);
  const isApproved = meta?.fitApproved ?? false;
  const totalImages = sessions.reduce((sum, s) => sum + s.images.length, 0);
  const effectiveImageUrl = imageOverrides[entry.style] ?? entry.imageUrl;

  const handleFitChange = (val: string) => {
    const newVal = val === "none" ? null : val;
    setLocalFit(newVal);
    onFitUpdate(entry.style, newVal, meta?.fittingNotes ?? null);
  };

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${isApproved ? "border-green-200 bg-green-50/30" : "border-border bg-card"}`}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-muted-foreground">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        {effectiveImageUrl && (
          <img src={effectiveImageUrl} alt={entry.style} className="w-10 h-10 object-cover rounded" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{entry.style}</span>
            <span className="text-xs text-muted-foreground">{entry.last}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{entry.category}</span>
            {entry.isAllNew && (
              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">All New</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isApproved && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded">
              <CheckCircle className="w-3 h-3" /> Approved
            </span>
          )}
          {fitRating && !isApproved && (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${FIT_COLOURS[fitRating]}`}>
              {FIT_LABELS[fitRating]}
            </span>
          )}
          {sessions.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />{sessions.length}
            </span>
          )}
          {totalImages > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="w-3 h-3" />{totalImages}
            </span>
          )}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 p-4 space-y-4">
          {/* Fit Rating */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overall Fit Rating</label>
            <Select value={fitRating ?? "none"} onValueChange={handleFitChange}>
              <SelectTrigger className="h-9 text-sm max-w-xs">
                <SelectValue placeholder="Select fit rating..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No rating —</SelectItem>
                <SelectItem value="tts">True to Size</SelectItem>
                <SelectItem value="runs_small">Runs Small</SelectItem>
                <SelectItem value="runs_large">Runs Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fitting Sessions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Fitting Sessions ({sessions.length})
              </label>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => onCreateSession(entry.style)}
              >
                <Plus className="w-3 h-3" />
                New Session
              </Button>
            </div>
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-2">
                No fitting sessions yet. Click "New Session" to record a fitting with model name, date, notes and photos.
              </p>
            )}
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onUploadImage={onUploadImage}
                  onDeleteImage={onDeleteImage}
                  onUpdateSession={onUpdateSession}
                  onDeleteSession={onDeleteSession}
                />
              ))}
            </div>
          </div>

          {/* Approve / Undo buttons */}
          <div className="flex items-center justify-end pt-1 border-t border-border">
            {!isApproved ? (
              <Button
                size="sm"
                className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                onClick={(e) => { e.stopPropagation(); onApprove(entry.style); setExpanded(false); }}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve Fit
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); onUndoApproval(entry.style); }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo Approval
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Session Dialog ───────────────────────────────────────────────────────

function NewSessionDialog({
  style,
  onConfirm,
  onClose,
}: {
  style: string;
  onConfirm: (fitModel: string, sessionDate: string) => void;
  onClose: () => void;
}) {
  const [fitModel, setFitModel] = useState("");
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split("T")[0]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold text-base">New Fitting Session — {style}</h3>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Fit Model</label>
            <input
              type="text"
              value={fitModel}
              onChange={(e) => setFitModel(e.target.value)}
              placeholder="e.g. Sarah, Size 38"
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => { onConfirm(fitModel, sessionDate); onClose(); }}
            disabled={!fitModel.trim()}
          >
            Create Session
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Export Dialog ────────────────────────────────────────────────────────────

function ExportDialog({
  styleList,
  styleMeta,
  sessionsMap,
  imageOverrides,
  onClose,
}: {
  styleList: StyleEntry[];
  styleMeta: Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null }>;
  sessionsMap: Record<string, FittingSession[]>;
  imageOverrides: Record<string, string>;
  onClose: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  // For each style, which session IDs to include (default: all)
  const [selectedSessions, setSelectedSessions] = useState<Record<string, Set<number>>>(() => {
    const init: Record<string, Set<number>> = {};
    styleList.forEach((s) => {
      const sessions = sessionsMap[s.style] ?? [];
      init[s.style] = new Set(sessions.map((sess) => sess.id));
    });
    return init;
  });

  const stylesWithData = styleList.filter((s) => {
    const meta = styleMeta[s.style];
    const sessions = sessionsMap[s.style] ?? [];
    return meta?.fitRating || sessions.some((sess) => sess.images.length > 0 || sess.notes);
  });

  const toggleSession = (style: string, sessionId: number) => {
    setSelectedSessions((prev) => {
      const next = { ...prev };
      const set = new Set(next[style] ?? []);
      if (set.has(sessionId)) set.delete(sessionId);
      else set.add(sessionId);
      next[style] = set;
      return next;
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = stylesWithData.map((s) => {
        const meta = styleMeta[s.style];
        const sessions = (sessionsMap[s.style] ?? []).filter((sess) => selectedSessions[s.style]?.has(sess.id));
        const fitLabel = meta?.fitRating ? FIT_LABELS[meta.fitRating] : "—";
        const fitColour = meta?.fitRating === "tts" ? "#166534" : meta?.fitRating === "runs_small" ? "#92400e" : "#1e40af";
        const effectiveImageUrl = imageOverrides[s.style] ?? s.imageUrl;

        const sessionHtml = sessions.map((sess) => {
          const imgHtml = sess.images.length > 0
            ? sess.images.map((img) => `<img src="${img.imageUrl}" style="width:90px;height:90px;object-fit:cover;border-radius:4px;margin:2px;" />`).join("")
            : "<span style='color:#999;font-size:11px;'>No photos</span>";
          const dateStr = sess.sessionDate ? new Date(sess.sessionDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";
          return `
            <div style="margin-top:8px;padding:8px;background:#f9f9f9;border-radius:6px;border:1px solid #eee;">
              <div style="font-size:11px;color:#555;margin-bottom:6px;">
                <strong>${sess.fitModel || "—"}</strong> &nbsp;·&nbsp; ${dateStr}
              </div>
              ${sess.notes ? `<div style="font-size:11px;color:#333;margin-bottom:6px;font-style:italic;">${sess.notes}</div>` : ""}
              <div style="display:flex;flex-wrap:wrap;gap:4px;">${imgHtml}</div>
            </div>
          `;
        }).join("");

        return `
          <tr style="border-bottom:2px solid #ddd;page-break-inside:avoid;">
            <td style="padding:12px 8px;vertical-align:top;width:90px;">
              ${effectiveImageUrl ? `<img src="${effectiveImageUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;" />` : "<span style='color:#999;font-size:11px;'>No image</span>"}
            </td>
            <td style="padding:12px 8px;vertical-align:top;width:140px;">
              <strong style="font-size:13px;">${s.style}</strong><br/>
              <span style="font-size:11px;color:#666;">${s.last} · ${s.category}</span>
            </td>
            <td style="padding:12px 8px;vertical-align:top;width:110px;">
              <span style="font-size:12px;font-weight:600;color:${fitColour};">${fitLabel}</span>
            </td>
            <td style="padding:12px 8px;vertical-align:top;">${sessionHtml || "<span style='color:#999;font-size:11px;'>No sessions selected</span>"}</td>
          </tr>
        `;
      }).join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Fitting Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #555; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; padding: 8px; border-bottom: 2px solid #ddd; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Fitting Report</h1>
  <div class="meta">Tony Bianco &nbsp;&nbsp; ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</div>
  <table>
    <thead>
      <tr>
        <th>Image</th>
        <th>Style</th>
        <th>Fit Rating</th>
        <th>Sessions &amp; Photos</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Fitting_Report_${new Date().toISOString().split("T")[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${stylesWithData.length} styles`, { description: "Open in browser and use Print → Save as PDF." });
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
        <h3 className="font-semibold text-base shrink-0">Export Fitting Report</h3>
        <p className="text-sm text-muted-foreground shrink-0">
          Select which fitting sessions to include for each style. Only styles with fit data are shown.
        </p>

        {stylesWithData.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">No fitting data to export yet.</p>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-3 pr-1">
            {stylesWithData.map((s) => {
              const sessions = sessionsMap[s.style] ?? [];
              return (
                <div key={s.style} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.style}</span>
                    <span className="text-xs text-muted-foreground">{s.last}</span>
                  </div>
                  {sessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No sessions — fit rating only</p>
                  ) : (
                    <div className="space-y-1">
                      {sessions.map((sess) => {
                        const checked = selectedSessions[s.style]?.has(sess.id) ?? true;
                        const dateStr = sess.sessionDate ? new Date(sess.sessionDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";
                        return (
                          <label key={sess.id} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSession(s.style, sess.id)}
                              className="rounded"
                            />
                            <span className="font-medium">{sess.fitModel || "—"}</span>
                            <span className="text-muted-foreground">{dateStr}</span>
                            <span className="text-muted-foreground">({sess.images.length} photos)</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2 shrink-0 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleExport} disabled={exporting || stylesWithData.length === 0}>
            {exporting ? "Exporting..." : `Export ${stylesWithData.length} Styles`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FittingTab() {
  const [exportOpen, setExportOpen] = useState(false);
  const [newSessionStyle, setNewSessionStyle] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const baseStyleList = buildStyleList();

  // ── Cancelled styles + cancelled SKUs ─────────────────────────────────────
  const { data: cancelledStylesRaw = [] } = trpc.styles.listCancelled.useQuery();
  const cancelledStyleSet = useMemo(
    () => new Set((cancelledStylesRaw as any[]).map((r: any) => r.style as string)),
    [cancelledStylesRaw]
  );

  const styleList = useMemo(
    () => baseStyleList.filter((s) => !cancelledStyleSet.has(s.style)),
    [baseStyleList, cancelledStyleSet]
  );

  // Data queries
  const { data: styleMetaList = [], refetch: refetchStyleMeta } = trpc.style.getAll.useQuery();
  const { data: imageOverrideList = [] } = trpc.styleImage.getAll.useQuery();

  const styleMeta = styleMetaList.reduce<Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null }>>(
    (acc, m) => { acc[m.style] = m; return acc; }, {}
  );

  const imageOverrides = imageOverrideList.reduce<Record<string, string>>(
    (acc, o) => { acc[o.style] = o.imageUrl; return acc; }, {}
  );

  // Fetch sessions for all styles in the fitting list
  // We fetch all sessions per style using a combined query approach
  const { data: allSessionsRaw = [], refetch: refetchSessions } = trpc.fittingSession.getForStyle.useQuery(
    { style: "__ALL__" },
    { enabled: false } // We'll use per-style queries below
  );
  void allSessionsRaw; // suppress unused warning

  // Use individual queries per style — but that's too many. Instead, we'll use a single
  // "get all sessions" approach by fetching each style's sessions in the component.
  // For now, use a workaround: fetch sessions for each style individually via a map.
  // We'll use a single aggregated query approach via the existing infrastructure.

  // Split into active (not approved) and approved
  const activeStyles = styleList.filter((s) => !styleMeta[s.style]?.fitApproved);
  const approvedStyles = styleList.filter((s) => styleMeta[s.style]?.fitApproved);

  // Apply search filter to active styles
  const q = search.trim().toLowerCase();
  const filteredActive = q
    ? activeStyles.filter((s) => s.style.toLowerCase().includes(q) || s.last.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
    : activeStyles;

  // Group active by last
  const byLast = filteredActive.reduce<Record<string, StyleEntry[]>>((acc, s) => {
    if (!acc[s.last]) acc[s.last] = [];
    acc[s.last].push(s);
    return acc;
  }, {});
  const sortedLasts = Object.keys(byLast).sort();

  // Mutations
  const updateFit = trpc.styleFitting.updateFit.useMutation({
    onSuccess: () => { refetchStyleMeta(); },
  });

  const createSession = trpc.fittingSession.create.useMutation({
    onSuccess: () => { refetchSessions(); },
    onError: () => toast.error("Failed to create session"),
  });

  const handleFitUpdate = useCallback((style: string, fitRating: string | null, notes: string | null) => {
    updateFit.mutate({ style, fitRating: fitRating as "tts" | "runs_small" | "runs_large" | null, fittingNotes: notes });
  }, [updateFit]);

  const handleApprove = useCallback((style: string) => {
    const meta = styleMetaList.find((m) => m.style === style);
    updateFit.mutate({
      style,
      fitRating: (meta?.fitRating ?? null) as "tts" | "runs_small" | "runs_large" | null,
      fittingNotes: meta?.fittingNotes ?? null,
      fitApproved: true,
    });
    toast.success(`${style} fit approved`);
  }, [updateFit, styleMetaList]);

  const handleUndoApproval = useCallback((style: string) => {
    const meta = styleMetaList.find((m) => m.style === style);
    updateFit.mutate({
      style,
      fitRating: (meta?.fitRating ?? null) as "tts" | "runs_small" | "runs_large" | null,
      fittingNotes: meta?.fittingNotes ?? null,
      fitApproved: false,
    });
    toast.success(`${style} approval undone`);
  }, [updateFit, styleMetaList]);

  const handleCreateSession = useCallback((style: string) => {
    setNewSessionStyle(style);
  }, []);

  const handleConfirmCreateSession = useCallback((fitModel: string, sessionDate: string) => {
    if (!newSessionStyle) return;
    createSession.mutate({ style: newSessionStyle, fitModel, sessionDate });
  }, [createSession, newSessionStyle]);

  // Per-style session data — using individual queries
  // We render a sub-component that fetches its own sessions to avoid N+1 at top level
  // This is handled inside StyleFitRowWithSessions below

  return (
    <div className="space-y-6">
      {/* New Session Dialog */}
      {newSessionStyle && (
        <NewSessionDialog
          style={newSessionStyle}
          onConfirm={handleConfirmCreateSession}
          onClose={() => setNewSessionStyle(null)}
        />
      )}

      {/* Export Dialog */}
      {exportOpen && (
        <ExportDialog
          styleList={styleList}
          styleMeta={styleMeta}
          sessionsMap={{}}
          imageOverrides={imageOverrides}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Fitting</h2>
          <p className="text-sm text-muted-foreground">
            {activeStyles.length} of {styleList.length} styles remaining to fit.
            {approvedStyles.length > 0 && ` ${approvedStyles.length} approved — see By Style tab.`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search styles..."
              className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring w-44"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {q && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredActive.length} {filteredActive.length === 1 ? "match" : "matches"}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* All approved */}
      {activeStyles.length === 0 && approvedStyles.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm font-medium text-green-700">All styles have been approved!</p>
          <p className="text-xs mt-1">Approved styles are saved in the <strong>By Style</strong> tab under the Fit Approved section.</p>
        </div>
      )}

      {/* Active styles grouped by last */}
      {sortedLasts.map((last) => (
        <div key={last} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{last}</h3>
            <span className="text-xs text-muted-foreground">({byLast[last].length} styles)</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            {byLast[last].map((entry) => (
              <StyleFitRowWithSessions
                key={entry.style}
                entry={entry}
                styleMeta={styleMeta}
                imageOverrides={imageOverrides}
                onFitUpdate={handleFitUpdate}
                onCreateSession={handleCreateSession}
                onApprove={handleApprove}
                onUndoApproval={handleUndoApproval}
              />
            ))}
          </div>
        </div>
      ))}

      {filteredActive.length === 0 && q && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-6 h-6 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No styles match &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch("")} className="text-xs underline mt-1 hover:text-foreground">Clear search</button>
        </div>
      )}

      {activeStyles.length === 0 && approvedStyles.length === 0 && !q && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">No styles requiring fitting found.</p>
        </div>
      )}
    </div>
  );
}

// ─── Style Fit Row With Sessions (fetches own session data) ───────────────────

function StyleFitRowWithSessions({
  entry,
  styleMeta,
  imageOverrides,
  onFitUpdate,
  onCreateSession,
  onApprove,
  onUndoApproval,
}: {
  entry: StyleEntry;
  styleMeta: Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null }>;
  imageOverrides: Record<string, string>;
  onFitUpdate: (style: string, fitRating: string | null, notes: string | null) => void;
  onCreateSession: (style: string) => void;
  onApprove: (style: string) => void;
  onUndoApproval: (style: string) => void;
}) {
  const { data: rawSessions = [], refetch: refetchSessions } = trpc.fittingSession.getForStyle.useQuery({ style: entry.style });

  const sessions: FittingSession[] = rawSessions.map((s) => ({
    id: s.id,
    style: s.style,
    fitModel: s.fitModel,
    sessionDate: s.sessionDate,
    notes: s.notes,
    images: ((s.images ?? []) as unknown) as Array<{ id: number; sessionId: number; style: string; imageUrl: string; fileKey: string }>,
  }));

  const updateSession = trpc.fittingSession.update.useMutation({ onSuccess: () => refetchSessions() });
  const deleteSession = trpc.fittingSession.delete.useMutation({ onSuccess: () => refetchSessions() });
  const uploadImage = trpc.fittingSession.uploadImage.useMutation({
    onSuccess: () => refetchSessions(),
    onError: () => toast.error("Upload failed"),
  });
  const deleteImage = trpc.fittingSession.deleteImage.useMutation({ onSuccess: () => refetchSessions() });

  const handleUploadImage = useCallback((sessionId: number, style: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      uploadImage.mutate({ sessionId, style, imageBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }, [uploadImage]);

  const handleDeleteImage = useCallback((id: number) => {
    deleteImage.mutate({ id });
  }, [deleteImage]);

  const handleUpdateSession = useCallback((id: number, fitModel: string, sessionDate: string, notes: string | null) => {
    updateSession.mutate({ id, fitModel, sessionDate, notes });
  }, [updateSession]);

  const handleDeleteSession = useCallback((id: number) => {
    deleteSession.mutate({ id });
  }, [deleteSession]);

  return (
    <StyleFitRow
      entry={entry}
      styleMeta={styleMeta}
      sessions={sessions}
      imageOverrides={imageOverrides}
      onFitUpdate={onFitUpdate}
      onCreateSession={onCreateSession}
      onUploadImage={handleUploadImage}
      onDeleteImage={handleDeleteImage}
      onUpdateSession={handleUpdateSession}
      onDeleteSession={handleDeleteSession}
      onApprove={onApprove}
      onUndoApproval={onUndoApproval}
    />
  );
}
