import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronDown, ChevronRight, Upload, X, ImageIcon, Download,
  CheckCircle, RotateCcw, Search, Plus, Calendar, User, ZoomIn,
  Layers, Trash2, Edit2, Check, Ruler,
} from "lucide-react";
import { LastMeasurementsPanel } from "./LastMeasurementsPanel";
import { toast } from "sonner";
import { useSeason } from "@/contexts/SeasonContext";
import { getNewLastsForSeason } from "@shared/const";

// ─── Constants ───────────────────────────────────────────────────────────────

// SS26 new lasts (kept for reference; season-aware version uses getNewLastsForSeason)
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
  sampleSize?: string | null;
  images: Array<{ id: number; sessionId: number; style: string; imageUrl: string; fileKey: string }>;
}

// ─── Build style list (now used inside component with live data) ──────────────

function buildStyleListFromData(styles: typeof skuData.styles, newLasts: readonly string[] = NEW_LASTS): StyleEntry[] {
  return styles
    .filter((s) => {
      const lastUpper = (s.last ?? "").toUpperCase();
      const isOnNewLast = newLasts.some((nl) => lastUpper.includes(nl));
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

  const sampleTypeColor = sampleType === "Proto" ? "text-orange-300" : sampleType === "Revised Pattern" ? "text-blue-300" : sampleType === "Revised Last" ? "text-indigo-300" : sampleType === "Salesman Sample" ? "text-green-300" : sampleType === "Fitting Sample" ? "text-amber-300" : "text-slate-300";

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
  knownModels,
  onUploadImage,
  onDeleteImage,
  onUpdateSession,
  onDeleteSession,
  startInEditMode = false,
}: {
  session: FittingSession;
  knownModels: string[];
  onUploadImage: (sessionId: number, style: string, file: File) => void;
  onDeleteImage: (id: number) => void;
  onUpdateSession: (id: number, fitModel: string, sessionDate: string, notes: string | null, sampleDate: string | null, sampleType: string | null, sampleSize: string | null) => void;
  onDeleteSession: (id: number) => void;
  startInEditMode?: boolean;
}) {
  const [editing, setEditing] = useState(startInEditMode);
  const [localModel, setLocalModel] = useState(session.fitModel);
  const [localDate, setLocalDate] = useState(session.sessionDate);
  const [localNotes, setLocalNotes] = useState(session.notes ?? "");
  const [localSampleDate, setLocalSampleDate] = useState(session.sampleDate ?? "");
  const [localSampleType, setLocalSampleType] = useState(session.sampleType ?? "");
  const [localSampleSize, setLocalSampleSize] = useState(session.sampleSize ?? "");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // When a new session opens in edit mode, scroll the card into view then focus notes
  useEffect(() => {
    if (startInEditMode && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setTimeout(() => notesRef.current?.focus(), 200);
      }, 150);
    }
  }, [startInEditMode]);

  // Sync local state when session prop updates (e.g. after save + server refresh)
  useEffect(() => {
    if (!editing) {
      setLocalModel(session.fitModel);
      setLocalDate(session.sessionDate);
      setLocalNotes(session.notes ?? "");
      setLocalSampleDate(session.sampleDate ?? "");
      setLocalSampleType(session.sampleType ?? "");
      setLocalSampleSize(session.sampleSize ?? "");
    }
  }, [session.fitModel, session.sessionDate, session.notes, session.sampleDate, session.sampleType, session.sampleSize, editing]);

  const handleSave = () => {
    onUpdateSession(session.id, localModel, localDate, localNotes || null, localSampleDate || null, localSampleType || null, (localSampleType === "Fitting Sample" && localSampleSize) ? localSampleSize : null);
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
    <div ref={cardRef} className="border border-border rounded-lg bg-card overflow-hidden">
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} sampleDate={session.sampleDate} sampleType={session.sampleType} />}

      {/* Session header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3 text-sm">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          {editing ? (
            <FitModelInput
              value={localModel}
              onChange={setLocalModel}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              knownModels={knownModels}
              placeholder="Fit model name"
              className="w-40"
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
              <option value="Original">Original</option>
              <option value="Proto">Proto</option>
              <option value="Fitting Sample">Fitting Sample</option>
              <option value="Revised Pattern">Revised Pattern</option>
              <option value="Revised Last">Revised Last</option>
              <option value="Salesman Sample">Salesman Sample</option>
            </select>
          ) : (
            <span className="text-xs">
              {session.sampleType ? (
                <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                  session.sampleType === "Original" ? "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400" :
                  session.sampleType === "Proto" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                  session.sampleType === "Revised Pattern" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                  session.sampleType === "Revised Last" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" :
                  session.sampleType === "Fitting Sample" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                }`}>{session.sampleType}</span>
              ) : <span className="text-muted-foreground/50">—</span>}
            </span>
          )}
        </div>
        {/* Fitting size — only visible when Fitting Sample is selected */}
        {(editing ? localSampleType === "Fitting Sample" : session.sampleType === "Fitting Sample") && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Fitting size:</span>
            {editing ? (
              <input
                type="text"
                value={localSampleSize}
                onChange={(e) => setLocalSampleSize(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                placeholder="e.g. 37"
                className="border border-border rounded px-2 py-0.5 text-xs bg-background w-20"
              />
            ) : (
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                {session.sampleSize || <span className="text-muted-foreground/50">—</span>}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Session notes */}
      {editing ? (
        <div className="px-4 pt-2">
          <Textarea
            ref={notesRef}
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); } }}
            placeholder="Session notes — Ctrl+Enter to save"
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
                        session.sampleType === "Original" ? "text-slate-300" :
                        session.sampleType === "Proto" ? "text-orange-300" :
                        session.sampleType === "Revised Pattern" ? "text-blue-300" :
                        session.sampleType === "Revised Last" ? "text-indigo-300" :
                        session.sampleType === "Fitting Sample" ? "text-amber-300" :
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
  knownModels,
  onFitUpdate,
  onSizeRecommendationUpdate,
  onCreateSession,
  onUploadImage,
  onDeleteImage,
  onUpdateSession,
  onDeleteSession,
  onApprove,
  onUndoApproval,
  imageOverrides,
  newlyCreatedSessionId,
  onClearNewSession,
  onModelUsed,
}: {
  entry: StyleEntry;
  styleMeta: Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null; sizeRecommendation?: string | null }>;
  sessions: FittingSession[];
  knownModels: string[];
  onFitUpdate: (style: string, fitRating: string | null, notes: string | null) => void;
  onSizeRecommendationUpdate: (style: string, sizeRecommendation: string | null, currentFitRating?: string | null) => void;
  onCreateSession: (style: string) => void;
  onUploadImage: (sessionId: number, style: string, file: File) => void;
  onDeleteImage: (id: number) => void;
  onUpdateSession: (id: number, fitModel: string, sessionDate: string, notes: string | null, sampleDate: string | null, sampleType: string | null, sampleSize: string | null) => void;
  onDeleteSession: (id: number) => void;
  onApprove: (style: string) => void;
  onUndoApproval: (style: string) => void;
  imageOverrides: Record<string, string>;
  newlyCreatedSessionId?: number | null;
  onClearNewSession?: () => void;
  onModelUsed?: (model: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localFit, setLocalFit] = useState<string | null | undefined>(undefined);
  const [localSizeRec, setLocalSizeRec] = useState<string | null | undefined>(undefined);

  // Auto-expand when a new session is created for this style
  useEffect(() => {
    if (newlyCreatedSessionId != null && sessions.some((s) => s.id === newlyCreatedSessionId)) {
      setExpanded(true);
    }
  }, [newlyCreatedSessionId, sessions]);

  const meta = styleMeta[entry.style];
  const fitRating = localFit !== undefined ? localFit : (meta?.fitRating ?? null);
  const sizeRecommendation = localSizeRec !== undefined ? localSizeRec : (meta?.sizeRecommendation ?? null);
  const isApproved = meta?.fitApproved ?? false;
  const totalImages = sessions.reduce((sum, s) => sum + s.images.length, 0);
  const effectiveImageUrl = imageOverrides[entry.style] ?? entry.imageUrl;

  const handleFitChange = (val: string) => {
    const newVal = val === "none" ? null : val;
    setLocalFit(newVal);
    // Clear size recommendation if switching to TTS
    if (newVal === "tts" || newVal === null) {
      setLocalSizeRec(null);
      onSizeRecommendationUpdate(entry.style, null);
    }
    onFitUpdate(entry.style, newVal, meta?.fittingNotes ?? null);
  };

  const handleSizeRecChange = (val: string) => {
    const newVal = val === "none" ? null : val;
    setLocalSizeRec(newVal);
    // Pass the current local fit rating so the parent avoids using stale server data
    onSizeRecommendationUpdate(entry.style, newVal, fitRating);
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

          {/* Size Recommendation — only shown when Runs Small or Runs Large */}
          {(fitRating === "runs_small" || fitRating === "runs_large") && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Size Recommendation
              </label>
              <Select value={sizeRecommendation ?? "none"} onValueChange={handleSizeRecChange}>
                <SelectTrigger className="h-9 text-sm max-w-xs">
                  <SelectValue placeholder="Select recommendation..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No recommendation —</SelectItem>
                  {fitRating === "runs_small" && (
                    <>
                      <SelectItem value="half_size_up">Go up half a size</SelectItem>
                      <SelectItem value="full_size_up">Go up a full size</SelectItem>
                    </>
                  )}
                  {fitRating === "runs_large" && (
                    <>
                      <SelectItem value="half_size_down">Go down half a size</SelectItem>
                      <SelectItem value="full_size_down">Go down a full size</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

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
              {[...sessions].sort((a, b) => {
                // Sort chronologically: oldest first, then by id as tiebreaker
                const dateA = a.sessionDate ?? "";
                const dateB = b.sessionDate ?? "";
                if (dateA !== dateB) return dateA.localeCompare(dateB);
                return a.id - b.id;
              }).map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  knownModels={knownModels}
                  onUploadImage={onUploadImage}
                  onDeleteImage={onDeleteImage}
                  onUpdateSession={(id, fitModel, sessionDate, notes, sampleDate, sampleType, sampleSize) => {
                    // Persist the model name for next session
                    if (fitModel.trim() && onModelUsed) onModelUsed(fitModel.trim().toUpperCase());
                    onUpdateSession(id, fitModel, sessionDate, notes, sampleDate, sampleType, sampleSize);
                    if (id === newlyCreatedSessionId && onClearNewSession) onClearNewSession();
                  }}
                  onDeleteSession={onDeleteSession}
                  startInEditMode={session.id === newlyCreatedSessionId}
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

// ─── FitModelInput: autocomplete input for fit model names ──────────────────

function FitModelInput({
  value,
  onChange,
  onKeyDown,
  knownModels,
  placeholder = "e.g. SARAH",
  className = "",
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  knownModels: string[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = knownModels.filter(
    (m) => m.includes(value.toUpperCase()) && m !== value.toUpperCase()
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value.toUpperCase()); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
          {suggestions.map((m) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(m); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors font-medium"
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Session Dialog ───────────────────────────────────────────────────────

function NewSessionDialog({
  style,
  knownModels,
  onConfirm,
  onClose,
}: {
  style: string;
  knownModels: string[];
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
            <FitModelInput
              value={fitModel}
              onChange={setFitModel}
              knownModels={knownModels}
              placeholder="e.g. SARAH"
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

  // Collect all unique fitting dates from sessions
  const allDates = useMemo(() => {
    const dateSet = new Set<string>();
    for (const sessions of Object.values(sessionsMap)) {
      for (const sess of sessions) {
        if (sess.sessionDate) dateSet.add(sess.sessionDate);
      }
    }
    return Array.from(dateSet).sort().reverse(); // most recent first
  }, [sessionsMap]);

  // Default: today's date if it has sessions, else most recent date
  const todayStr = new Date().toISOString().split("T")[0];
  const defaultDate = allDates.includes(todayStr) ? todayStr : (allDates[0] ?? todayStr);
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  // Styles that have sessions on the selected date
  const stylesOnDate = useMemo(() => {
    return styleList.filter((s) => {
      const sessions = sessionsMap[s.style] ?? [];
      return sessions.some((sess) => sess.sessionDate === selectedDate);
    });
  }, [styleList, sessionsMap, selectedDate]);

  const formatDateLabel = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  };

  const formatDateShort = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  };

  const handleExport = async () => {
    if (stylesOnDate.length === 0) {
      toast.error("No fitting sessions on the selected date");
      return;
    }
    setExporting(true);
    try {
      // ── Build data: group sessions by fit model for the selected date ──────
      type SessionEntry = {
        style: string;
        category: string;
        sessionDate: string | null;
        notes: string | null;
        sampleDate: string | null;
        sampleType: string | null;
        fitRating: string | null;
        fitApproved: boolean | null;
      };
      const modelMap: Record<string, SessionEntry[]> = {};

      for (const s of stylesOnDate) {
        const sessions = (sessionsMap[s.style] ?? []).filter((sess) => sess.sessionDate === selectedDate);
        const meta = styleMeta[s.style];
        for (const sess of sessions) {
          const key = (sess.fitModel?.trim() || "Unknown").toUpperCase();
          if (!modelMap[key]) modelMap[key] = [];
          modelMap[key].push({
            style: s.style,
            category: s.category,
            sessionDate: sess.sessionDate ?? null,
            notes: sess.notes ?? null,
            sampleDate: (sess as any).sampleDate ?? null,
            sampleType: (sess as any).sampleType ?? null,
            fitRating: meta?.fitRating ?? null,
            fitApproved: meta?.fitApproved ?? null,
          });
        }
      }

      // ── xlsx-js-style setup ───────────────────────────────────────────────
      const darkFill  = { patternType: "solid", fgColor: { rgb: "1A1A1A" } };
      const midFill   = { patternType: "solid", fgColor: { rgb: "3D3D3D" } };
      const sandFill  = { patternType: "solid", fgColor: { rgb: "F0EBE3" } };
      const whiteFill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
      const altFill   = { patternType: "solid", fgColor: { rgb: "F9F9F9" } };

      const SAMPLE_COLOURS: Record<string, { bg: string; fg: string }> = {
        "Original":        { bg: "EFF6FF", fg: "1D4ED8" },
        "Proto":           { bg: "FFF7ED", fg: "C2410C" },
        "Revised Pattern":  { bg: "DBEAFE", fg: "1E40AF" },
        "Revised Last":    { bg: "E0E7FF", fg: "3730A3" },
        "Salesman Sample": { bg: "F0FDF4", fg: "15803D" },
      };

      const FIT_RATING_COLOURS: Record<string, { bg: string; fg: string }> = {
        tts:         { bg: "DCFCE7", fg: "166534" },
        runs_small:  { bg: "FEF3C7", fg: "92400E" },
        runs_large:  { bg: "DBEAFE", fg: "1E40AF" },
      };

      const boldWhite12  = { name: "Calibri", sz: 12, bold: true,  color: { rgb: "FFFFFF" } };
      const boldWhite10  = { name: "Calibri", sz: 10, bold: true,  color: { rgb: "FFFFFF" } };
      const boldDark11   = { name: "Calibri", sz: 11, bold: true,  color: { rgb: "111111" } };
      const boldDark10   = { name: "Calibri", sz: 10, bold: true,  color: { rgb: "111111" } };
      const plain10      = { name: "Calibri", sz: 10, bold: false, color: { rgb: "222222" } };
      const muted10      = { name: "Calibri", sz: 10, bold: false, color: { rgb: "666666" } };
      const italic10     = { name: "Calibri", sz: 10, bold: false, italic: true, color: { rgb: "444444" } };

      const thinBorder = {
        top:    { style: "thin", color: { rgb: "D0D0D0" } },
        bottom: { style: "thin", color: { rgb: "D0D0D0" } },
        left:   { style: "thin", color: { rgb: "D0D0D0" } },
        right:  { style: "thin", color: { rgb: "D0D0D0" } },
      };
      const bottomOnlyBorder = {
        bottom: { style: "thin", color: { rgb: "D0D0D0" } },
      };
      const mediumBottomBorder = {
        bottom: { style: "medium", color: { rgb: "888888" } },
      };

      const NCOLS = 7; // Style | Category | Fitting Date | Sample Date | Sample Type | Fit Comments | Status
      const sheetRows: any[][] = [];
      const rowMeta: { type: string; altRow?: boolean }[] = [];
      const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

      const push = (row: any[], type: string, altRow = false) => {
        sheetRows.push(row);
        rowMeta.push({ type, altRow });
      };

      const emptyRow = Array(NCOLS).fill("");

      // ── Row 1: Main header ────────────────────────────────────────────────
      const dateLabel = formatDateShort(selectedDate);
      push([`TONY BIANCO  ·  FITTING SESSION  ·  ${dateLabel.toUpperCase()}`, ...Array(NCOLS - 1).fill("")], "mainHeader");
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } });

      // ── Row 2: Sub-header ─────────────────────────────────────────────────
      push([`Season: SS26   ·   Exported: ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" })}   ·   ${stylesOnDate.length} style${stylesOnDate.length !== 1 ? "s" : ""}`, ...Array(NCOLS - 1).fill("")], "subHeader");
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: NCOLS - 1 } });

      // ── Spacer ─────────────────────────────────────────────────────────────
      push([...emptyRow], "spacer");

      // ── Groups by fit model ───────────────────────────────────────────────
      for (const [model, entries] of Object.entries(modelMap)) {
        const startRow = sheetRows.length;

        // Model divider
        push([`  FOOT MODEL: ${model.toUpperCase()}`, ...Array(NCOLS - 1).fill("")], "modelDivider");
        merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: NCOLS - 1 } });

        // Column headers
        push(["STYLE", "CATEGORY", "FITTING DATE", "SAMPLE DATE", "SAMPLE TYPE", "FIT COMMENTS", "STATUS"], "colHeader");

        // Data rows
        let altRow = false;
        for (const entry of entries) {
          const fittingDateStr = entry.sessionDate
            ? new Date(entry.sessionDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, ".")
            : "";
          const sampleDateStr = entry.sampleDate
            ? new Date(entry.sampleDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, ".")
            : "";
          const fitLabel = entry.fitRating ? FIT_LABELS[entry.fitRating] ?? "" : "";
          const status = entry.fitApproved ? "✓ Approved" : (entry.notes ? "Pending review" : "");
          push([
            entry.style,
            entry.category,
            fittingDateStr,
            sampleDateStr,
            entry.sampleType ?? "",
            entry.notes ?? "",
            status,
          ], "data", altRow);
          altRow = !altRow;
        }

        // Spacer between model groups
        push([...emptyRow], "groupSpacer");
      }

      // ── Build worksheet ───────────────────────────────────────────────────
      const ws = XLSX.utils.aoa_to_sheet(sheetRows);

      ws["!cols"] = [
        { wch: 18 }, // Style
        { wch: 13 }, // Category
        { wch: 14 }, // Fitting Date
        { wch: 14 }, // Sample Date
        { wch: 17 }, // Sample Type
        { wch: 52 }, // Fit Comments
        { wch: 15 }, // Status
      ];

      ws["!rows"] = rowMeta.map(({ type }) => {
        if (type === "mainHeader")   return { hpt: 32 };
        if (type === "subHeader")    return { hpt: 20 };
        if (type === "spacer")       return { hpt: 10 };
        if (type === "modelDivider") return { hpt: 22 };
        if (type === "colHeader")    return { hpt: 20 };
        if (type === "groupSpacer")  return { hpt: 12 };
        return { hpt: 18 };
      });

      ws["!merges"] = merges;

      // ── Apply cell styles ─────────────────────────────────────────────────
      for (let R = 0; R < sheetRows.length; R++) {
        const { type, altRow } = rowMeta[R];
        for (let C = 0; C < NCOLS; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[addr]) ws[addr] = { v: "", t: "s" };

          if (type === "mainHeader") {
            ws[addr].s = {
              font: boldWhite12,
              fill: darkFill,
              alignment: { horizontal: "left", vertical: "center", indent: 1 },
            };
          } else if (type === "subHeader") {
            ws[addr].s = {
              font: muted10,
              fill: sandFill,
              alignment: { horizontal: "left", vertical: "center", indent: 1 },
            };
          } else if (type === "spacer" || type === "groupSpacer") {
            ws[addr].s = {};
          } else if (type === "modelDivider") {
            ws[addr].s = {
              font: boldWhite10,
              fill: midFill,
              alignment: { horizontal: "left", vertical: "center" },
            };
          } else if (type === "colHeader") {
            ws[addr].s = {
              font: boldDark10,
              fill: sandFill,
              alignment: { horizontal: "center", vertical: "center" },
              border: mediumBottomBorder,
            };
          } else if (type === "data") {
            const fill = altRow ? altFill : whiteFill;
            const cellVal = sheetRows[R][C];

            // Default style
            let cellStyle: any = {
              font: C === 0 ? boldDark10 : (C === 5 ? italic10 : plain10),
              fill,
              alignment: {
                horizontal: "left",
                vertical: "center",
                wrapText: C === 5,
                indent: 1,
              },
              border: bottomOnlyBorder,
            };

            // Sample type colour badge
            if (C === 4 && cellVal && SAMPLE_COLOURS[cellVal as string]) {
              const sc = SAMPLE_COLOURS[cellVal as string];
              cellStyle = {
                font: { name: "Calibri", sz: 10, bold: true, color: { rgb: sc.fg } },
                fill: { patternType: "solid", fgColor: { rgb: sc.bg } },
                alignment: { horizontal: "center", vertical: "center" },
                border: bottomOnlyBorder,
              };
            }

            // Status colour
            if (C === 6) {
              const isApproved = (cellVal as string)?.startsWith("✓");
              cellStyle = {
                font: {
                  name: "Calibri", sz: 10, bold: isApproved,
                  color: { rgb: isApproved ? "166534" : (cellVal ? "92400E" : "AAAAAA") },
                },
                fill,
                alignment: { horizontal: "left", vertical: "center", indent: 1 },
                border: bottomOnlyBorder,
              };
            }

            ws[addr].s = cellStyle;
          }
        }
      }

      // ── Write file ────────────────────────────────────────────────────────
      const wb = XLSX.utils.book_new();
      const sheetName = formatDateShort(selectedDate).replace(/[^a-z0-9 ]/gi, "").substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const fileName = `Fitting_${selectedDate}.xlsx`;
      XLSX.writeFile(wb, fileName, { bookType: "xlsx", cellStyles: true });
      toast.success(`Exported ${stylesOnDate.length} styles to ${fileName}`);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Export Fitting Report</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Date selector */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Fitting Date</p>
          {allDates.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No fitting sessions recorded yet.</p>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
              {allDates.map((d) => {
                const count = styleList.filter((s) =>
                  (sessionsMap[s.style] ?? []).some((sess) => sess.sessionDate === d)
                ).length;
                const isToday = d === todayStr;
                const isSelected = d === selectedDate;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <span className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>
                          {formatDateLabel(d)}
                        </span>
                        {isToday && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">Today</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{count} style{count !== 1 ? "s" : ""}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview of what will be exported */}
        {selectedDate && stylesOnDate.length > 0 && (
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Will export</p>
            <p className="text-sm">
              <span className="font-semibold">{stylesOnDate.length} style{stylesOnDate.length !== 1 ? "s" : ""}</span>
              {" "}from <span className="font-semibold">{formatDateLabel(selectedDate)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {Array.from(new Set(
                stylesOnDate.flatMap((s) =>
                  (sessionsMap[s.style] ?? [])
                    .filter((sess) => sess.sessionDate === selectedDate && sess.fitModel)
                    .map((sess) => (sess.fitModel?.trim() ?? "").toUpperCase())
                )
              )).sort().join(", ") || "No fit models"}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={exporting || stylesOnDate.length === 0 || !selectedDate}
            className="gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Exporting..." : `Export ${stylesOnDate.length} Style${stylesOnDate.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Fitting Group Manager ────────────────────────────────────────────────────

function FittingGroupManager({ styleList }: { styleList: StyleEntry[] }) {
  const utils = trpc.useUtils();
  const { data: groups = [], refetch } = trpc.fittingGroup.getAll.useQuery(undefined, { staleTime: 30_000 });
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

  const { data: styleMetaList = [] } = trpc.style.getAll.useQuery(undefined, { staleTime: 30_000 });
  const { data: imageOverrideList = [] } = trpc.styleImage.getAll.useQuery(undefined, { staleTime: 120_000 });
  const { season: groupSeason } = useSeason();
  const { data: allSessionsRaw = [] } = trpc.fittingSession.getAll.useQuery({ season: groupSeason }, { staleTime: 15_000 });

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
            const key = (sess.fitModel?.trim() || "Unknown").toUpperCase();
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
                                        (sess as any).sampleType === "Original" ? "bg-slate-500 text-white" :
                                        (sess as any).sampleType === "Proto" ? "bg-orange-500 text-white" :
                                        (sess as any).sampleType === "Revised Pattern" ? "bg-blue-500 text-white" :
                                        (sess as any).sampleType === "Revised Last" ? "bg-indigo-500 text-white" :
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
  const [selectedMeasurementsLast, setSelectedMeasurementsLast] = useState<string | null>(null);
  const [newSessionStyle, setNewSessionStyle] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<"all" | "waiting_revised" | "waiting_to_fit" | "approved">("all");
  // Track the most recently created session ID so it opens in edit mode automatically
  const [newlyCreatedSessionId, setNewlyCreatedSessionId] = useState<number | null>(null);
  // Remember the last used fit model across sessions (persisted in localStorage)
  const lastUsedModelRef = useRef<string>(
    typeof window !== "undefined" ? (localStorage.getItem("fitting_last_model") ?? "") : ""
  );

  // Live merged styles (includes custom SKUs from DB)
  const { mergedStyles } = useCustomSkus();

  // Run-on lasts — styles on these lasts should not appear in Fitting
  const { data: customLastsData = [] } = trpc.customLast.getAll.useQuery(undefined, { staleTime: 300_000 });
  const runOnLastsSet = useMemo(() => {
    const s = new Set<string>();
    for (const l of (customLastsData as Array<{ lastName: string; isRunOn: boolean } | string>)) {
      if (typeof l !== "string" && l.isRunOn) s.add(l.lastName.toUpperCase());
    }
    return s;
  }, [customLastsData]);

  // ── Cancelled styles + cancelled SKUs ─────────────────────────────────────
  const { data: cancelledStylesRaw = [] } = trpc.styles.listCancelled.useQuery(undefined, { staleTime: 30_000 });
  const cancelledStyleSet = useMemo(
    () => new Set((cancelledStylesRaw as any[]).map((r: any) => r.style as string)),
    [cancelledStylesRaw]
  );
  const { data: cancelledSkusRaw = [] } = trpc.cancelledSku.list.useQuery(undefined, { staleTime: 30_000 });
  const cancelledSkuSet = useMemo(
    () => new Set((cancelledSkusRaw as any[]).map((r: any) => `${r.style}|${r.colour}` as string)),
    [cancelledSkusRaw]
  );

  const { season } = useSeason();

  // mergedStyles already has new/existing overrides applied via useCustomSkus
  const seasonNewLasts = useMemo(() => getNewLastsForSeason(season), [season]);
  const styleList = useMemo(() => {
    // Custom styles (_isCustomStyle) always appear regardless of last name
    const allStyles = mergedStyles as Array<typeof skuData.styles[number] & { _isCustomStyle?: boolean }>;
    const customEntries: StyleEntry[] = allStyles
      .filter((s) => s._isCustomStyle && !cancelledStyleSet.has(s.style) && !runOnLastsSet.has((s.last ?? "").toUpperCase()))
      .map((s) => ({
        style: s.style,
        last: s.last ?? "",
        category: s.category ?? "",
        imageUrl: (s as any).imageUrl,
        hasNew: s.hasNew,
        isAllNew: s.isAllNew,
        newSKUs: s.newSKUs,
        totalSKUs: s.totalSKUs,
      }));
    // Pass season-specific new lasts so W27 shows empty fitting list (no new lasts yet)
    const staticEntries = buildStyleListFromData(mergedStyles as typeof skuData.styles, seasonNewLasts)
      .filter((s) => !cancelledStyleSet.has(s.style));
    // Merge, deduplicate (custom style wins if same name)
    const seen = new Set(customEntries.map((s) => s.style));
    return [
      ...customEntries,
      ...staticEntries.filter((s) => !seen.has(s.style)),
    ].sort((a, b) => a.last.localeCompare(b.last) || a.style.localeCompare(b.style));
  }, [mergedStyles, cancelledStyleSet, seasonNewLasts]);

  // Data queries
  const { data: styleMetaList = [], refetch: refetchStyleMeta } = trpc.style.getAll.useQuery(undefined, { staleTime: 30_000 });
  const { data: imageOverrideList = [] } = trpc.styleImage.getAll.useQuery(undefined, { staleTime: 120_000 });

  const styleMeta = styleMetaList.reduce<Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null; sizeRecommendation?: string | null }>>(
    (acc, m) => { acc[m.style] = m; return acc; }, {}
  );

  const imageOverrides = imageOverrideList.reduce<Record<string, string>>(
    (acc, o) => { acc[o.style] = o.imageUrl; return acc; }, {}
  );

  // ── Bulk session fetch (single query for all styles) ────────────────────────
  const { data: allSessionsRaw = [], refetch: refetchSessions } = trpc.fittingSession.getAll.useQuery({ season }, { staleTime: 15_000 });

  // Build a map: style -> sessions[] so each row can look up its sessions instantly
  const sessionsByStyle = useMemo(() => {
    const map: Record<string, typeof allSessionsRaw> = {};
    for (const s of allSessionsRaw) {
      if (!map[s.style]) map[s.style] = [];
      map[s.style].push(s);
    }
    return map;
  }, [allSessionsRaw]);

  // Unique sorted fit model names (uppercase) for autocomplete
  const knownModels = useMemo(() => {
    const names = new Set<string>();
    for (const s of allSessionsRaw) {
      if (s.fitModel?.trim()) names.add(s.fitModel.trim().toUpperCase());
    }
    return Array.from(names).sort();
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
  const handleSizeRecommendationUpdate = useCallback((style: string, sizeRecommendation: string | null, currentFitRating?: string | null) => {
    const meta = styleMetaList.find((m) => m.style === style);
    // Use the caller-supplied current fit rating (avoids stale server value when user
    // changes fit rating and immediately picks a recommendation in the same session)
    const fitRating = currentFitRating !== undefined ? currentFitRating : (meta?.fitRating ?? null);
    updateFit.mutate({
      style,
      fitRating: fitRating as "tts" | "runs_small" | "runs_large" | null,
      fittingNotes: meta?.fittingNotes ?? null,
      sizeRecommendation: sizeRecommendation as "half_size_up" | "full_size_up" | "half_size_down" | "full_size_down" | null,
    });
  }, [updateFit, styleMetaList]);

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
    // Immediately create the session with today's date and the last used model — no dialog needed
    const today = new Date().toISOString().split("T")[0];
    const model = lastUsedModelRef.current || "";
    createSession.mutate(
      { style, fitModel: model, sessionDate: today },
      {
        onSuccess: (result: any) => {
          if (result?.id) setNewlyCreatedSessionId(result.id);
          refetchSessions();
        },
      }
    );
  }, [createSession, refetchSessions]);

  // ── Fit Report Export ────────────────────────────────────────────────────────────────────────────────
  const handleExportFitReport = useCallback(() => {
    // Only include styles that have been fitted (have sessions or a fit rating)
    const fittedStyles = styleList.filter((s) => {
      const sessions = sessionsByStyle[s.style] ?? [];
      const meta = styleMeta[s.style];
      return sessions.length > 0 || meta?.fitRating;
    });

    if (fittedStyles.length === 0) {
      toast.error("No fitted styles to export yet.");
      return;
    }

    const SIZE_REC_LABELS: Record<string, string> = {
      half_size_up: "Go up half a size",
      full_size_up: "Go up a full size",
      half_size_down: "Go down half a size",
      full_size_down: "Go down a full size",
    };

    // Build a lookup: style -> colours[] from the live merged styles data
    const styleColoursMap = (mergedStyles as typeof skuData.styles).reduce<Record<string, string[]>>(
      (acc, s) => { acc[s.style] = (s as any).colours ?? []; return acc; }, {}
    );

    const headers = ["Style", "Colour", "Last", "Category", "Fit Rating", "Size Recommendation", "Status", "Most Recent Fit Date", "Fit Models", "Notes"];
    const rows: (string | number)[][] = [];

    fittedStyles.forEach((s) => {
      const sessions = (sessionsByStyle[s.style] ?? []) as FittingSession[];
      const meta = styleMeta[s.style];
      const fitLabel = meta?.fitRating ? (FIT_LABELS[meta.fitRating] ?? meta.fitRating) : "";
      const sizeRecLabel = meta?.sizeRecommendation ? (SIZE_REC_LABELS[meta.sizeRecommendation] ?? "") : "";
      const status = meta?.fitApproved ? "Approved" : sessions.length > 0 ? "Fitted - Pending Review" : "Rating Set";
      const sortedDates = sessions.map((sess) => sess.sessionDate).filter(Boolean).sort().reverse();
      const mostRecentDate = sortedDates[0] ?? "";
      const fitModels = Array.from(new Set(sessions.map((sess) => sess.fitModel).filter(Boolean))).join(", ");
      // Build notes: style-level note first, then each session note on a new line
      const notesParts: string[] = [];
      if (meta?.fittingNotes?.trim()) notesParts.push(meta.fittingNotes.trim());
      sessions.forEach((sess, idx) => {
        if (sess.notes?.trim()) {
          const label = sessions.length > 1 ? `[Session ${idx + 1}${sess.fitModel ? ` - ${sess.fitModel}` : ""}] ` : "";
          notesParts.push(label + sess.notes.trim());
        }
      });
      const allNotes = notesParts.join("\n");

      // Expand to one row per colour — shared fit data on every row, notes/models on first row only
      // Exclude cancelled individual SKUs (cancelled by colour)
      const colours = (styleColoursMap[s.style] ?? [""]).filter(
        (colour) => !cancelledSkuSet.has(`${s.style}|${colour}`)
      );
      colours.forEach((colour, colIdx) => {
        const isFirst = colIdx === 0;
        rows.push([
          s.style,
          colour,
          s.last,
          s.category,
          fitLabel,
          sizeRecLabel,
          status,
          isFirst ? mostRecentDate : "",
          isFirst ? fitModels : "",
          isFirst ? allNotes : "",
        ]);
      });
    });

    const wb = XLSX.utils.book_new();
    const aoa: (string | number)[][] = [];
    const exportDate = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" });
    aoa.push([`SS26 Fit Report - ${exportDate}`, ...Array(headers.length - 1).fill("")]);
    aoa.push(Array(headers.length).fill(""));
    aoa.push(headers);
    rows.forEach((r) => aoa.push(r));

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Columns: Style, Colour, Last, Category, Fit Rating, Size Recommendation, Status, Most Recent Fit Date, Fit Models, Notes
    ws["!cols"] = [
      { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 16 },
      { wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 30 }, { wch: 70 },
    ];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    // Row heights: title, spacer, header, then data rows sized by note line count
    ws["!rows"] = [
      { hpt: 28 },
      { hpt: 6 },
      { hpt: 22 },
      ...rows.map((row) => {
        const notes = row[9] as string; // Notes is now column index 9
        const lineCount = notes ? notes.split("\n").length : 1;
        return { hpt: Math.max(20, lineCount * 15) };
      }),
    ];

    // Title row style
    const titleCell = ws["A1"];
    if (titleCell) {
      titleCell.s = { font: { bold: true, sz: 13, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2D2D2D" } }, alignment: { horizontal: "left" } };
    }

    // Header row style (row index 2)
    headers.forEach((h, ci) => {
      const addr = XLSX.utils.encode_cell({ r: 2, c: ci });
      if (!ws[addr]) ws[addr] = { v: h, t: "s" };
      ws[addr].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4A3728" } },
        alignment: { horizontal: "center", wrapText: true },
        border: { bottom: { style: "thin", color: { rgb: "CCCCCC" } } },
      };
    });

    // Data row styles - colour-code by fit rating
    const FIT_ROW_COLOURS: Record<string, string> = {
      "True to Size": "E8F5E9",
      "Runs Small": "FFF8E1",
      "Runs Large": "E3F2FD",
    };
    rows.forEach((row, ri) => {
      const rowIdx = 3 + ri;
      const fitLabel = row[4] as string; // Fit Rating is now column index 4
      const bgColour = FIT_ROW_COLOURS[fitLabel] ?? "FFFFFF";
      row.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: rowIdx, c: ci });
        if (!ws[addr]) ws[addr] = { v: row[ci] ?? "", t: typeof row[ci] === "number" ? "n" : "s" };
        ws[addr].s = {
          fill: { fgColor: { rgb: bgColour } },
          alignment: { wrapText: true, vertical: "top" },
          border: { bottom: { style: "thin", color: { rgb: "EEEEEE" } } },
        };
      });
    });

    XLSX.utils.book_append_sheet(wb, ws, "Fit Report");
    const today = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
    const fileName = `SS26_Fit_Report_${today}.xlsx`;
    XLSX.writeFile(wb, fileName, { bookType: "xlsx", cellStyles: true });
    toast.success(`Fit Report exported - ${fittedStyles.length} styles, ${rows.length} rows`);
  }, [styleList, sessionsByStyle, styleMeta, mergedStyles, cancelledSkuSet]);

  // Per-style session data — using individual queries
  // We render a sub-component that fetches its own sessions to avoid N+1 at top level
  // This is handled inside StyleFitRowWithSessions below

  return (
    <div className="space-y-6">
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

      {/* Last Measurements Panel */}
      {selectedMeasurementsLast !== null && (
        <LastMeasurementsPanel
          filterLast={selectedMeasurementsLast}
          onClose={() => setSelectedMeasurementsLast(null)}
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

          <Button variant="outline" size="sm" onClick={handleExportFitReport} className="gap-2">
            <Download className="w-4 h-4" />
            Fit Report
          </Button>
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
            <button
              onClick={() => setSelectedMeasurementsLast(last)}
              title={`View ${last} measurements`}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-transparent hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors text-muted-foreground"
            >
              <Ruler className="w-3 h-3" />
              <span>Measurements</span>
            </button>
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
                knownModels={knownModels}
                onFitUpdate={handleFitUpdate}
                onSizeRecommendationUpdate={handleSizeRecommendationUpdate}
                onCreateSession={handleCreateSession}
                onApprove={handleApprove}
                onUndoApproval={handleUndoApproval}
                onRefreshSessions={refetchSessions}
                newlyCreatedSessionId={newlyCreatedSessionId}
                onClearNewSession={() => setNewlyCreatedSessionId(null)}
                onModelUsed={(model) => {
                  lastUsedModelRef.current = model;
                  localStorage.setItem("fitting_last_model", model);
                }}
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
          {(approvalFilter === "waiting_to_fit" || approvalFilter === "waiting_revised" || approvalFilter === "all") && (
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
  knownModels,
  onFitUpdate,
  onSizeRecommendationUpdate,
  onCreateSession,
  onApprove,
  onUndoApproval,
  onRefreshSessions,
  newlyCreatedSessionId,
  onClearNewSession,
  onModelUsed,
}: {
  entry: StyleEntry;
  styleMeta: Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null; sizeRecommendation?: string | null }>;
  imageOverrides: Record<string, string>;
  preloadedSessions: Array<{ id: number; style: string; fitModel: string; sessionDate: string; notes: string | null; sampleDate?: string | null; sampleType?: string | null; sampleSize?: string | null; createdAt: Date; images: Array<{ id: number; sessionId: number; style: string; imageUrl: string; fileKey: string; createdAt: Date }> }>;
  knownModels: string[];
  onFitUpdate: (style: string, fitRating: string | null, notes: string | null) => void;
  onSizeRecommendationUpdate: (style: string, sizeRecommendation: string | null, currentFitRating?: string | null) => void;
  onCreateSession: (style: string) => void;
  onApprove: (style: string) => void;
  onUndoApproval: (style: string) => void;
  onRefreshSessions: () => void;
  newlyCreatedSessionId?: number | null;
  onClearNewSession?: () => void;
  onModelUsed?: (model: string) => void;
}) {
  const sessions: FittingSession[] = preloadedSessions.map((s) => ({
    id: s.id,
    style: s.style,
    fitModel: s.fitModel,
    sessionDate: s.sessionDate,
    notes: s.notes,
    sampleDate: s.sampleDate ?? null,
    sampleType: s.sampleType ?? null,
    sampleSize: s.sampleSize ?? null,
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

  const handleUpdateSession = useCallback((id: number, fitModel: string, sessionDate: string, notes: string | null, sampleDate: string | null, sampleType: string | null, sampleSize: string | null) => {
    updateSession.mutate({ id, fitModel, sessionDate, notes, sampleDate, sampleType, sampleSize });
  }, [updateSession]);

  const handleDeleteSession = useCallback((id: number) => {
    deleteSession.mutate({ id });
  }, [deleteSession]);

  return (
    <StyleFitRow
      entry={entry}
      styleMeta={styleMeta}
      sessions={sessions}
      knownModels={knownModels}
      imageOverrides={imageOverrides}
      onFitUpdate={onFitUpdate}
      onSizeRecommendationUpdate={onSizeRecommendationUpdate}
      onCreateSession={onCreateSession}
      onUploadImage={handleUploadImage}
      onDeleteImage={handleDeleteImage}
      onUpdateSession={handleUpdateSession}
      onDeleteSession={handleDeleteSession}
      onApprove={onApprove}
      onUndoApproval={onUndoApproval}
      newlyCreatedSessionId={newlyCreatedSessionId}
      onClearNewSession={onClearNewSession}
      onModelUsed={onModelUsed}
    />
  );
}
