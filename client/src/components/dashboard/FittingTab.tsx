import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronDown, ChevronRight, Upload, X, ImageIcon, Download,
  CheckCircle, RotateCcw, Search, Plus, Calendar, User, ZoomIn,
  Layers, Trash2, Edit2, Check,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────────────────────────

const NEW_LASTS = [
  "DAZIE", "SIA", "SALLY", "TIANA", "BILLIE", "MATISSE",
  "EMBER", "TILDA", "LUCY", "ENVY", "FINCH",
  "HARLEY", "JAYDE", "ROXIE", "VIVA", "PIXIE",
];
// Note: EDGY is an existing pattern and does not require fitting

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
  sampleDate?: string | null;
  sampleType?: string | null;
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

function Lightbox({ src, onClose, sampleDate, sampleType }: { src: string; onClose: () => void; sampleDate?: string | null; sampleType?: string | null }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const sampleTypeColor = sampleType === "Proto" ? "text-orange-300" : sampleType === "Revised" ? "text-blue-300" : "text-green-300";

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 z-10"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>
      <div className="relative" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "min(600px, 90vw)", maxHeight: "min(600px, 80vh)" }}>
        <img
          src={src}
          alt="Fitting"
          className="block rounded-lg shadow-2xl object-contain"
          style={{ maxWidth: "min(600px, 90vw)", maxHeight: "min(560px, 75vh)", width: "auto", height: "auto" }}
        />
        {(sampleDate || sampleType) && (
          <div className="absolute bottom-0 left-0 right-0 rounded-b-lg px-3 py-2 bg-black/60 flex items-center gap-3">
            {sampleType && (
              <span className={`text-sm font-bold ${sampleTypeColor}`}>{sampleType}</span>
            )}
            {sampleDate && (
              <span className="text-sm text-white/90">
                {new Date(sampleDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
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
  onUpdateSession: (id: number, fitModel: string, sessionDate: string, notes: string | null, sampleDate: string | null, sampleType: string | null) => void;
  onDeleteSession: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localModel, setLocalModel] = useState(session.fitModel);
  const [localDate, setLocalDate] = useState(session.sessionDate);
  const [localNotes, setLocalNotes] = useState(session.notes ?? "");
  const [localSampleDate, setLocalSampleDate] = useState(session.sampleDate ?? "");
  const [localSampleType, setLocalSampleType] = useState(session.sampleType ?? "");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when session prop updates (e.g. after save + server refresh)
  useEffect(() => {
    if (!editing) {
      setLocalModel(session.fitModel);
      setLocalDate(session.sessionDate);
      setLocalNotes(session.notes ?? "");
      setLocalSampleDate(session.sampleDate ?? "");
      setLocalSampleType(session.sampleType ?? "");
    }
  }, [session.fitModel, session.sessionDate, session.notes, session.sampleDate, session.sampleType, editing]);

  const handleSave = () => {
    onUpdateSession(session.id, localModel, localDate, localNotes || null, localSampleDate || null, localSampleType || null);
    setEditing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    files.forEach((file) => onUploadImage(session.id, session.style, file));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} sampleDate={session.sampleDate} sampleType={session.sampleType} />}

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

      {/* Sample date + type row */}
      <div className="px-4 pt-2 pb-1 flex items-center gap-3 text-sm flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">Sample date:</span>
          {editing ? (
            <input
              type="date"
              value={localSampleDate}
              onChange={(e) => setLocalSampleDate(e.target.value)}
              className="border border-border rounded px-2 py-0.5 text-xs bg-background"
            />
          ) : (
            <span className="text-xs text-foreground">
              {session.sampleDate ? new Date(session.sampleDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" }) : <span className="text-muted-foreground/50">—</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">Sample type:</span>
          {editing ? (
            <select
              value={localSampleType}
              onChange={(e) => setLocalSampleType(e.target.value)}
              className="border border-border rounded px-2 py-0.5 text-xs bg-background"
            >
              <option value="">— select —</option>
              <option value="Proto">Proto</option>
              <option value="Revised">Revised</option>
              <option value="Salesman Sample">Salesman Sample</option>
            </select>
          ) : (
            <span className="text-xs">
              {session.sampleType ? (
                <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                  session.sampleType === "Proto" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                  session.sampleType === "Revised" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                }`}>{session.sampleType}</span>
              ) : <span className="text-muted-foreground/50">—</span>}
            </span>
          )}
        </div>
      </div>

      {/* Session notes */}
      {editing ? (
        <div className="px-4 pt-2">
          <Textarea
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            placeholder="Session notes (fit observations, adjustments needed...)"
            className="text-sm min-h-[60px] resize-none"
          />
        </div>
      ) : session.notes ? (
        <div className="px-4 pt-2 text-sm text-muted-foreground italic">{session.notes}</div>
      ) : null}

      {/* Images — drag-and-drop zone */}
      <div
        className={`px-4 py-3 transition-colors rounded-b-lg ${
          isDragging ? "bg-primary/5 ring-2 ring-inset ring-primary" : ""
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isDragging && (
          <div className="flex items-center justify-center py-2 mb-2 text-xs text-primary font-medium gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            Drop images here
          </div>
        )}
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
                {/* Sample date / type overlay — bottom-left */}
                {(session.sampleDate || session.sampleType) && (
                  <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 flex flex-col gap-0 pointer-events-none">
                    {session.sampleType && (
                      <span className={`text-[7px] font-bold leading-tight ${
                        session.sampleType === "Proto" ? "text-orange-300" :
                        session.sampleType === "Revised" ? "text-blue-300" :
                        "text-green-300"
                      }`}>{session.sampleType}</span>
                    )}
                    {session.sampleDate && (
                      <span className="text-[7px] text-white/90 leading-tight">
                        {new Date(session.sampleDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </span>
                    )}
                  </div>
                )}
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
            title="Click to browse or drag & drop images here"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Add Photo</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              Array.from(e.target.files ?? []).forEach((file) => onUploadImage(session.id, session.style, file));
              e.target.value = "";
            }}
          />
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
  onUpdateSession: (id: number, fitModel: string, sessionDate: string, notes: string | null, sampleDate: string | null, sampleType: string | null) => void;
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
  waitingToFitStyles,
  waitingRevisedStyles,
  approvedStyles,
  onClose,
}: {
  styleList: StyleEntry[];
  styleMeta: Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null }>;
  sessionsMap: Record<string, FittingSession[]>;
  imageOverrides: Record<string, string>;
  waitingToFitStyles: StyleEntry[];
  waitingRevisedStyles: StyleEntry[];
  approvedStyles: StyleEntry[];
  onClose: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(() => new Set(styleList.map((s) => s.style)));
  const [search, setSearch] = useState("");

  // Quick-select groups
  const selectGroup = (styles: StyleEntry[]) => {
    setSelectedStyles(new Set(styles.map((s) => s.style)));
  };

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(style)) next.delete(style); else next.add(style);
      return next;
    });
  };

  const filteredList = search.trim()
    ? styleList.filter((s) => s.style.toLowerCase().includes(search.trim().toLowerCase()) || s.last.toLowerCase().includes(search.trim().toLowerCase()))
    : styleList;

  const selectedCount = selectedStyles.size;

  const sampleTypeColour = (t: string | null | undefined) =>
    t === "Proto" ? "#c2410c" : t === "Revised" ? "#1d4ed8" : t === "Salesman Sample" ? "#15803d" : "#555";

  const handleExport = async () => {
    setExporting(true);
    try {
      const toExport = styleList.filter((s) => selectedStyles.has(s.style));

      const sections = toExport.map((s) => {
        const meta = styleMeta[s.style];
        const sessions = sessionsMap[s.style] ?? [];
        const fitLabel = meta?.fitRating ? FIT_LABELS[meta.fitRating] : null;
        const fitColour = meta?.fitRating === "tts" ? "#166534" : meta?.fitRating === "runs_small" ? "#92400e" : "#1e40af";
        const effectiveImageUrl = imageOverrides[s.style] ?? s.imageUrl;
        const approvedBadge = meta?.fitApproved ? `<span style="display:inline-block;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;margin-left:8px;">Fit Approved</span>` : "";

        const sessionsHtml = sessions.length === 0
          ? `<p style="font-size:12px;color:#999;font-style:italic;margin:8px 0 0;">No fitting sessions recorded.</p>`
          : sessions.map((sess) => {
              const fittingDateStr = sess.sessionDate
                ? new Date(sess.sessionDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                : "—";
              const sampleDateStr = (sess as any).sampleDate
                ? new Date((sess as any).sampleDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" })
                : null;
              const sampleType = (sess as any).sampleType as string | null;
              const sampleTypeBadge = sampleType
                ? `<span style="display:inline-block;background:${sampleType === "Proto" ? "#fff7ed" : sampleType === "Revised" ? "#eff6ff" : "#f0fdf4"};color:${sampleTypeColour(sampleType)};border:1px solid ${sampleType === "Proto" ? "#fed7aa" : sampleType === "Revised" ? "#bfdbfe" : "#bbf7d0"};border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600;">${sampleType}</span>`
                : "";
              const imgHtml = sess.images.length > 0
                ? sess.images.map((img) => `<img src="${img.imageUrl}" style="width:110px;height:110px;object-fit:cover;border-radius:6px;margin:3px;" />`).join("")
                : "<span style='color:#aaa;font-size:11px;'>No photos</span>";

              return `
                <div style="margin-top:10px;padding:10px 12px;background:#f8f8f8;border-radius:8px;border:1px solid #e5e5e5;">
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
                    <span style="font-size:12px;font-weight:700;color:#222;">${sess.fitModel || "—"}</span>
                    <span style="font-size:11px;color:#666;">Fitting: ${fittingDateStr}</span>
                    ${sampleDateStr ? `<span style="font-size:11px;color:#666;">Sample: ${sampleDateStr}</span>` : ""}
                    ${sampleTypeBadge}
                  </div>
                  ${sess.notes ? `<p style="font-size:12px;color:#333;font-style:italic;margin:0 0 8px;">${sess.notes}</p>` : ""}
                  <div style="display:flex;flex-wrap:wrap;gap:4px;">${imgHtml}</div>
                </div>
              `;
            }).join("");

        return `
          <div style="page-break-inside:avoid;margin-bottom:32px;border-bottom:2px solid #e5e5e5;padding-bottom:24px;">
            <div style="display:flex;gap:16px;align-items:flex-start;">
              <div style="flex-shrink:0;">
                ${effectiveImageUrl
                  ? `<img src="${effectiveImageUrl}" style="width:110px;height:110px;object-fit:cover;border-radius:8px;border:1px solid #e5e5e5;" />`
                  : `<div style="width:110px;height:110px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;"><span style="color:#bbb;font-size:11px;">No image</span></div>`
                }
              </div>
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                  <span style="font-size:16px;font-weight:700;color:#111;">${s.style}</span>
                  ${approvedBadge}
                </div>
                <div style="font-size:12px;color:#888;margin-bottom:4px;">${s.last} &middot; ${s.category}</div>
                ${fitLabel ? `<span style="display:inline-block;font-size:12px;font-weight:600;color:${fitColour};background:${meta?.fitRating === "tts" ? "#dcfce7" : meta?.fitRating === "runs_small" ? "#fef3c7" : "#dbeafe"};border-radius:4px;padding:2px 8px;margin-bottom:4px;">${fitLabel}</span>` : ""}
                ${meta?.fittingNotes ? `<p style="font-size:12px;color:#444;font-style:italic;margin:4px 0 0;">${meta.fittingNotes}</p>` : ""}
              </div>
            </div>
            <div style="margin-top:4px;">${sessionsHtml}</div>
          </div>
        `;
      }).join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Fitting Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #222; font-size: 13px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #666; margin-bottom: 32px; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Fitting Report</h1>
  <div class="meta">Tony Bianco &nbsp;&nbsp; ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })} &nbsp;&nbsp; ${toExport.length} style${toExport.length !== 1 ? "s" : ""}</div>
  ${sections}
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Fitting_Report_${new Date().toISOString().split("T")[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${toExport.length} styles`, { description: "Open in browser and use Print → Save as PDF." });
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-xl p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-base">Export Fitting Report</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Quick-select group buttons */}
        <div className="shrink-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick select</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "All", styles: styleList },
              { label: `Waiting to be Fit (${waitingToFitStyles.length})`, styles: waitingToFitStyles },
              { label: `Waiting on Revised (${waitingRevisedStyles.length})`, styles: waitingRevisedStyles },
              { label: `Approved (${approvedStyles.length})`, styles: approvedStyles },
            ].map(({ label, styles }) => (
              <button
                key={label}
                onClick={() => selectGroup(styles)}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setSelectedStyles(new Set())}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors text-muted-foreground"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Search + style list */}
        <div className="shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search styles..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 border border-border rounded-lg divide-y divide-border">
          {filteredList.length === 0 ? (
            <p className="text-sm text-muted-foreground italic p-4 text-center">No styles match your search.</p>
          ) : (
            filteredList.map((s) => {
              const checked = selectedStyles.has(s.style);
              const sessions = sessionsMap[s.style] ?? [];
              const meta = styleMeta[s.style];
              const hasData = meta?.fitRating || meta?.fittingNotes || sessions.some((sess) => sess.notes || sess.images.length > 0);
              const approved = meta?.fitApproved;
              return (
                <label key={s.style} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors ${checked ? "bg-primary/5" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStyle(s.style)}
                    className="rounded shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{s.style}</span>
                      <span className="text-xs text-muted-foreground">{s.last}</span>
                      {approved && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "oklch(0.94 0.08 155)", color: "oklch(0.40 0.14 155)" }}>✓ Approved</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {sessions.length > 0 ? `${sessions.length} session${sessions.length !== 1 ? "s" : ""} · ${sessions.reduce((n, sess) => n + sess.images.length, 0)} photos` : "No sessions"}
                      {hasData && !sessions.length ? " · has notes" : ""}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-2 shrink-0 border-t border-border">
          <span className="text-xs text-muted-foreground">{selectedCount} style{selectedCount !== 1 ? "s" : ""} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleExport} disabled={exporting || selectedCount === 0}>
              {exporting ? "Exporting..." : `Export ${selectedCount} Style${selectedCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Fitting Group Manager ────────────────────────────────────────────────────

function FittingGroupManager({ styleList }: { styleList: StyleEntry[] }) {
  const utils = trpc.useUtils();
  const { data: groups = [], refetch } = trpc.fittingGroup.getAll.useQuery();
  const createGroup = trpc.fittingGroup.create.useMutation({ onSuccess: () => refetch() });
  const updateGroup = trpc.fittingGroup.update.useMutation({ onSuccess: () => refetch() });
  const deleteGroup = trpc.fittingGroup.delete.useMutation({ onSuccess: () => refetch() });
  const addStyle = trpc.fittingGroup.addStyle.useMutation({ onSuccess: () => refetch() });
  const removeStyle = trpc.fittingGroup.removeStyle.useMutation({ onSuccess: () => refetch() });
  const deleteSessionMutation = trpc.fittingSession.delete.useMutation({
    onSuccess: () => utils.fittingSession.getAll.invalidate(),
  });

  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [styleSearch, setStyleSearch] = useState("");
  const [openGroupId, setOpenGroupId] = useState<number | null>(null);
  const [exportingGroupId, setExportingGroupId] = useState<number | null>(null);
  const [openStyleKey, setOpenStyleKey] = useState<string | null>(null); // "groupId:style"
  const [groupLightbox, setGroupLightbox] = useState<{ src: string; sampleDate?: string | null; sampleType?: string | null } | null>(null);

  const { data: styleMetaList = [] } = trpc.style.getAll.useQuery();
  const { data: imageOverrideList = [] } = trpc.styleImage.getAll.useQuery();
  const { data: allSessionsRaw = [] } = trpc.fittingSession.getAll.useQuery();

  const styleMeta = useMemo(() => styleMetaList.reduce<Record<string, any>>((acc, m) => { acc[m.style] = m; return acc; }, {}), [styleMetaList]);
  const imageOverrides = useMemo(() => imageOverrideList.reduce<Record<string, string>>((acc, o) => { acc[o.style] = o.imageUrl; return acc; }, {}), [imageOverrideList]);
  const sessionsByStyle = useMemo(() => {
    const map: Record<string, typeof allSessionsRaw> = {};
    for (const s of allSessionsRaw) { if (!map[s.style]) map[s.style] = []; map[s.style].push(s); }
    return map;
  }, [allSessionsRaw]);

  const allStyleNames = useMemo(() => styleList.map((s) => s.style).sort(), [styleList]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createGroup.mutate({ name: newName.trim(), sessionDate: newDate });
    setNewName("");
    setCreating(false);
  };

  const handleExportGroup = async (group: typeof groups[0]) => {
    setExportingGroupId(group.id);
    try {
      const wb = XLSX.utils.book_new();

      // Group sessions by fit model name
      // Each sheet = one fit model, with all styles they fitted
      const modelMap: Record<string, { style: string; sessionDate: string | null; notes: string | null; sampleDate: string | null; sampleType: string | null }[]> = {};

      for (const style of group.styles) {
        const sessions = sessionsByStyle[style] ?? [];
        if (sessions.length === 0) {
          // Include styles with no sessions under a "No Model" sheet
          const key = "No Model";
          if (!modelMap[key]) modelMap[key] = [];
          modelMap[key].push({ style, sessionDate: null, notes: null, sampleDate: null, sampleType: null });
        } else {
          for (const sess of sessions) {
            const key = sess.fitModel?.trim() || "Unknown";
            if (!modelMap[key]) modelMap[key] = [];
            modelMap[key].push({
              style,
              sessionDate: sess.sessionDate ?? null,
              notes: sess.notes ?? null,
              sampleDate: (sess as any).sampleDate ?? null,
              sampleType: (sess as any).sampleType ?? null,
            });
          }
        }
      }

      // Build one sheet per fit model
      for (const [modelName, entries] of Object.entries(modelMap)) {
        // Format date: use the most common session date for this model, or group date
        const dateStr = group.sessionDate
          ? new Date(group.sessionDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, ".")
          : "";

        const rows: any[][] = [
          ["FITTING COMMENTS", "", "", "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", ""],
          [`FOOT MODEL: ${modelName}`, "", `DATE : ${dateStr}`, "", "", "", "", "", ""],
          ["", "", "", "", "", "", "", "", ""],
          ["STYLE", "FITTING DATE", "SAMPLE DATE", "SAMPLE TYPE", "COMMENTS", "", "", "", ""],
        ];

        for (const entry of entries) {
          const fittingDateStr = entry.sessionDate
            ? new Date(entry.sessionDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, ".")
            : "";
          const sampleDateStr = entry.sampleDate
            ? new Date(entry.sampleDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, ".")
            : "";
          rows.push([entry.style, fittingDateStr, sampleDateStr, entry.sampleType ?? "", entry.notes ?? "", "", "", "", ""]);
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Column widths: Style=25, Fitting Date=15, Sample Date=15, Sample Type=18, Comments=60
        ws["!cols"] = [
          { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 60 },
          { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        ];

        // Bold the header row (row 1) and column headers (row 5)
        const boldCells = ["A1", "A3", "C3", "A5", "B5", "C5", "D5", "E5"];
        for (const addr of boldCells) {
          if (ws[addr]) {
            ws[addr].s = { font: { bold: true, sz: addr === "A1" ? 14 : 11 } };
          }
        }

        const sheetName = modelName.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      XLSX.writeFile(wb, `${group.name.replace(/[^a-z0-9]/gi, "_")}_fitting.xlsx`);
      toast.success(`Exported ${group.styles.length} styles`);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setExportingGroupId(null);
    }
  };

  const filteredStyles = useMemo(() => {
    const q = styleSearch.toLowerCase();
    return q ? allStyleNames.filter((s) => s.toLowerCase().includes(q)) : allStyleNames;
  }, [allStyleNames, styleSearch]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {groupLightbox && <Lightbox src={groupLightbox.src} onClose={() => setGroupLightbox(null)} sampleDate={groupLightbox.sampleDate} sampleType={groupLightbox.sampleType} />}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left bg-card"
        onClick={() => setExpanded((v) => !v)}
      >
        <Layers className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm">Fitting Groups</span>
        <span className="text-xs text-muted-foreground">{groups.length} group{groups.length !== 1 ? "s" : ""}</span>
        <div className="flex-1" />
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`} />
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/10 p-4 space-y-4">
          {/* Existing groups */}
          {groups.length === 0 && !creating && (
            <p className="text-sm text-muted-foreground text-center py-4">No fitting groups yet. Create one to group styles for a fitting session.</p>
          )}

          {groups.map((group) => {
            const isOpen = openGroupId === group.id;
            const isEditing = editingId === group.id;
            return (
              <div key={group.id} className="border border-border rounded-lg bg-card overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button className="flex-1 flex items-center gap-2 text-left" onClick={() => setOpenGroupId(isOpen ? null : group.id)}>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-sm font-medium border border-border rounded px-2 py-0.5 bg-background"
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-semibold">{group.name}</span>
                    )}
                    {isEditing ? (
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="text-xs border border-border rounded px-2 py-0.5 bg-background"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      group.sessionDate && <span className="text-xs text-muted-foreground">{new Date(group.sessionDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{group.styles.length} style{group.styles.length !== 1 ? "s" : ""}</span>
                  </button>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { updateGroup.mutate({ id: group.id, name: editName, sessionDate: editDate }); setEditingId(null); }}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => handleExportGroup(group)} disabled={exportingGroupId === group.id || group.styles.length === 0}>
                          <Download className="w-3.5 h-3.5" />{exportingGroupId === group.id ? "..." : "Export"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingId(group.id); setEditName(group.name); setEditDate(group.sessionDate ?? ""); }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Delete group "${group.name}"?`)) deleteGroup.mutate({ id: group.id }); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded: style rows + add styles */}
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {group.styles.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4 px-3">No styles yet — add some below.</p>
                    )}
                    {group.styles.map((s) => {
                      const styleKey = `${group.id}:${s}`;
                      const isStyleOpen = openStyleKey === styleKey;
                      const meta = styleMeta[s];
                      const sessions = sessionsByStyle[s] ?? [];
                      const fitRating = meta?.fitRating;
                      const fitLabel = fitRating ? FIT_LABELS[fitRating] ?? fitRating : null;
                      const fitColour = fitRating ? FIT_COLOURS[fitRating] ?? "" : "";
                      const entry = styleList.find((e) => e.style === s);
                      return (
                        <div key={s}>
                          {/* Style row header */}
                          <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors">
                            <button
                              className="flex-1 flex items-center gap-2 text-left"
                              onClick={() => setOpenStyleKey(isStyleOpen ? null : styleKey)}
                            >
                              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isStyleOpen ? "" : "-rotate-90"}`} />
                              <span className="text-sm font-medium">{s}</span>
                              {entry && <span className="text-xs text-muted-foreground">{entry.last}</span>}
                              {fitLabel && (
                                <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${fitColour}`}>{fitLabel}</span>
                              )}
                              {meta?.fitApproved && (
                                <span className="text-xs px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200 font-medium">Approved</span>
                              )}
                              {sessions.length > 0 && (
                                <span className="text-xs text-muted-foreground">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
                              )}
                            </button>
                            <button
                              onClick={() => removeStyle.mutate({ groupId: group.id, style: s })}
                              className="text-muted-foreground hover:text-destructive p-1 rounded"
                              title="Remove from group"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Expanded style detail */}
                          {isStyleOpen && (
                            <div className="bg-muted/20 border-t border-border px-4 py-3 space-y-3">
                              {/* Fit notes */}
                              {meta?.fittingNotes && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Fit Notes</p>
                                  <p className="text-sm">{meta.fittingNotes}</p>
                                </div>
                              )}
                              {/* Sessions */}
                              {sessions.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sessions</p>
                                  <div className="space-y-2">
                                    {sessions.map((sess, i) => (
                                      <div key={sess.id} className="bg-card border border-border rounded-md px-3 py-2 space-y-1">
                                        <div className="flex items-center gap-2">
                                          <User className="w-3 h-3 text-muted-foreground" />
                                          <span className="text-xs font-medium">{sess.fitModel || "—"}</span>
                                          {sess.sessionDate && (
                                            <span className="text-xs text-muted-foreground">
                                              {new Date(sess.sessionDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                                            </span>
                                          )}
                                          <button
                                            className="ml-auto text-muted-foreground hover:text-destructive p-0.5 rounded"
                                            title="Delete this session"
                                            onClick={() => {
                                              if (confirm(`Delete the ${sess.fitModel || "this"} session from ${sess.sessionDate || "unknown date"}?`)) {
                                                deleteSessionMutation.mutate({ id: sess.id });
                                              }
                                            }}
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        {sess.notes && <p className="text-sm text-foreground/90 pl-5">{sess.notes}</p>}
                                        {(!sess.notes && !sess.fitModel) && <p className="text-xs text-muted-foreground pl-5">No notes</p>}
                                        {sess.images && sess.images.length > 0 && (
                                          <div className="flex flex-wrap gap-2 pt-1 pl-5">
                                            {sess.images.map((img) => (
                                              <button
                                                key={img.id}
                                                onClick={() => setGroupLightbox({ src: img.imageUrl, sampleDate: (sess as any).sampleDate, sampleType: (sess as any).sampleType })}
                                                className="relative w-24 h-24 rounded border border-border overflow-hidden hover:ring-2 hover:ring-primary transition-all group flex-shrink-0"
                                              >
                                                <img src={img.imageUrl} alt="Fitting" className="w-full h-full object-cover" />
                                                {/* Sample date + type overlay */}
                                                {((sess as any).sampleDate || (sess as any).sampleType) && (
                                                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 flex flex-col items-start gap-0.5">
                                                    {(sess as any).sampleType && (
                                                      <span className={`text-[9px] font-semibold leading-tight px-1 rounded ${
                                                        (sess as any).sampleType === "Proto" ? "bg-orange-500 text-white" :
                                                        (sess as any).sampleType === "Revised" ? "bg-blue-500 text-white" :
                                                        "bg-green-500 text-white"
                                                      }`}>{(sess as any).sampleType}</span>
                                                    )}
                                                    {(sess as any).sampleDate && (
                                                      <span className="text-[9px] text-white/90 leading-tight">
                                                        {new Date((sess as any).sampleDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                  <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {!meta?.fittingNotes && sessions.length === 0 && (
                                <p className="text-xs text-muted-foreground">No fitting data recorded yet for {s}.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Add styles */}
                    <div className="p-3 space-y-1.5">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          value={styleSearch}
                          onChange={(e) => setStyleSearch(e.target.value)}
                          placeholder="Search styles to add..."
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-border rounded-md bg-background">
                        {filteredStyles.filter((s) => !group.styles.includes(s)).map((s) => (
                          <button
                            key={s}
                            onClick={() => addStyle.mutate({ groupId: group.id, style: s })}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                        {filteredStyles.filter((s) => !group.styles.includes(s)).length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">All styles added</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Create new group */}
          {creating ? (
            <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Group name (e.g. Week 1 Fitting)"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4" /> New Fitting Group
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FittingTab() {
  const [exportOpen, setExportOpen] = useState(false);
  const [newSessionStyle, setNewSessionStyle] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<"all" | "waiting_revised" | "waiting_to_fit" | "approved">("waiting_to_fit");

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

  // ── Bulk session fetch (single query for all styles) ────────────────────────
  const { data: allSessionsRaw = [], refetch: refetchSessions } = trpc.fittingSession.getAll.useQuery();

  // Build a map: style -> sessions[] so each row can look up its sessions instantly
  const sessionsByStyle = useMemo(() => {
    const map: Record<string, typeof allSessionsRaw> = {};
    for (const s of allSessionsRaw) {
      if (!map[s.style]) map[s.style] = [];
      map[s.style].push(s);
    }
    return map;
  }, [allSessionsRaw]);

  // Split counts for tab badges
  const activeStyles = styleList.filter((s) => !styleMeta[s.style]?.fitApproved);
  const approvedStyles = styleList.filter((s) => styleMeta[s.style]?.fitApproved);

  // A style has fitting activity if it has any session with notes or images,
  // OR if it has style-level fitting notes / fit rating set
  function hasActivity(style: string): boolean {
    const meta = styleMeta[style];
    if (meta?.fittingNotes?.trim() || meta?.fitRating) return true;
    const sessions = sessionsByStyle[style] ?? [];
    return sessions.some((sess) => (sess.notes?.trim()) || sess.images.length > 0);
  }

  const waitingRevisedStyles = activeStyles.filter((s) => hasActivity(s.style));
  const waitingToFitStyles = activeStyles.filter((s) => !hasActivity(s.style));

  // Apply approval filter
  const filteredByApproval = approvalFilter === "waiting_revised"
    ? waitingRevisedStyles
    : approvalFilter === "waiting_to_fit"
    ? waitingToFitStyles
    : approvalFilter === "approved"
    ? approvedStyles
    : styleList;

  // Apply search filter
  const q = search.trim().toLowerCase();
  const filteredActive = q
    ? filteredByApproval.filter((s) => s.style.toLowerCase().includes(q) || s.last.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
    : filteredByApproval;

  // Group by last
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
          sessionsMap={sessionsByStyle as Record<string, FittingSession[]>}
          imageOverrides={imageOverrides}
          waitingToFitStyles={waitingToFitStyles}
          waitingRevisedStyles={waitingRevisedStyles}
          approvedStyles={approvedStyles}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Fitting</h2>
          <p className="text-sm text-muted-foreground">
            {waitingToFitStyles.length} waiting to be fit &middot; {waitingRevisedStyles.length} waiting on revised &middot; {approvedStyles.length} approved
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

      {/* Approval filter tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {([
          { key: "waiting_to_fit", label: "Waiting to be Fit", count: waitingToFitStyles.length },
          { key: "waiting_revised", label: "Waiting on Revised", count: waitingRevisedStyles.length },
          { key: "approved", label: "Approved", count: approvedStyles.length },
          { key: "all", label: "All", count: styleList.length },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setApprovalFilter(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              approvalFilter === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              approvalFilter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Fitting Groups */}
      <FittingGroupManager styleList={styleList} />

      {/* Styles grouped by last */}
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
                preloadedSessions={sessionsByStyle[entry.style] ?? []}
                onFitUpdate={handleFitUpdate}
                onCreateSession={handleCreateSession}
                onApprove={handleApprove}
                onUndoApproval={handleUndoApproval}
                onRefreshSessions={refetchSessions}
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

      {filteredActive.length === 0 && !q && (
        <div className="text-center py-16 text-muted-foreground">
          {approvalFilter === "not_approved" && (
            <>
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm font-medium text-green-700">All styles have been approved!</p>
              <button onClick={() => setApprovalFilter("approved")} className="text-xs underline mt-1 hover:text-foreground">View approved styles</button>
            </>
          )}
          {approvalFilter === "approved" && (
            <p className="text-sm">No approved styles yet. Approve a style using the Approve Fit button.</p>
          )}
          {approvalFilter === "all" && (
            <p className="text-sm">No styles requiring fitting found.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Style Fit Row With Sessions (receives pre-fetched sessions as prop) ────────

function StyleFitRowWithSessions({
  entry,
  styleMeta,
  imageOverrides,
  preloadedSessions,
  onFitUpdate,
  onCreateSession,
  onApprove,
  onUndoApproval,
  onRefreshSessions,
}: {
  entry: StyleEntry;
  styleMeta: Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null }>;
  imageOverrides: Record<string, string>;
  preloadedSessions: Array<{ id: number; style: string; fitModel: string; sessionDate: string; notes: string | null; sampleDate?: string | null; sampleType?: string | null; createdAt: Date; images: Array<{ id: number; sessionId: number; style: string; imageUrl: string; fileKey: string; createdAt: Date }> }>;
  onFitUpdate: (style: string, fitRating: string | null, notes: string | null) => void;
  onCreateSession: (style: string) => void;
  onApprove: (style: string) => void;
  onUndoApproval: (style: string) => void;
  onRefreshSessions: () => void;
}) {
  const sessions: FittingSession[] = preloadedSessions.map((s) => ({
    id: s.id,
    style: s.style,
    fitModel: s.fitModel,
    sessionDate: s.sessionDate,
    notes: s.notes,
    sampleDate: s.sampleDate ?? null,
    sampleType: s.sampleType ?? null,
    images: ((s.images ?? []) as unknown) as Array<{ id: number; sessionId: number; style: string; imageUrl: string; fileKey: string }>,
  }));

  const updateSession = trpc.fittingSession.update.useMutation({ onSuccess: () => onRefreshSessions() });
  const deleteSession = trpc.fittingSession.delete.useMutation({ onSuccess: () => onRefreshSessions() });
  const uploadImage = trpc.fittingSession.uploadImage.useMutation({
    onSuccess: () => onRefreshSessions(),
    onError: () => toast.error("Upload failed"),
  });
  const deleteImage = trpc.fittingSession.deleteImage.useMutation({ onSuccess: () => onRefreshSessions() });

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

  const handleUpdateSession = useCallback((id: number, fitModel: string, sessionDate: string, notes: string | null, sampleDate: string | null, sampleType: string | null) => {
    updateSession.mutate({ id, fitModel, sessionDate, notes, sampleDate, sampleType });
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
