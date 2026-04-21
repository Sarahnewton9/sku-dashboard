/**
 * SkuDetailPanel — slide-out panel for a single SKU
 * Shows: fitting images, fit rating, fitting notes, sample status, order qty, size 11, cost, RRP
 */

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { X, Upload, Trash2, Camera, CheckCircle, Clock, Star } from "lucide-react";
import { toast } from "sonner";

export interface SkuPanelData {
  style: string;
  colour: string;
  leather: string;
  isNew: boolean;
  category: string;
  last: string;
  imageUrl?: string;
}

interface Props {
  sku: SkuPanelData | null;
  onClose: () => void;
  // Live meta from DB (passed in from parent which fetches all at once)
  skuMeta: Record<string, {
    sampleStatus?: string;
    orderQty?: number;
    isSize11?: boolean;
    costPrice?: number | null;
    fitRating?: string | null;
    fittingNotes?: string | null;
  }>;
  styleMeta: Record<string, { rrp?: number | null }>;
  onMetaChange: () => void;
  // All SKUs for the style (for style-level Size 11 toggle)
  allStyleSkus?: Array<{ colour: string; leather: string }>;
}

function skuKey(style: string, colour: string, leather: string) {
  return `${style}|${colour}|${leather}`;
}

const FIT_RATINGS = [
  { value: "tts", label: "True to Size" },
  { value: "runs_small", label: "Runs Small" },
  { value: "runs_large", label: "Runs Large" },
];

export default function SkuDetailPanel({ sku, onClose, skuMeta, styleMeta, onMetaChange, allStyleSkus }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState<string | null>(null);
  const [localFitRating, setLocalFitRating] = useState<string | null | undefined>(undefined);

  const utils = trpc.useUtils();

  const meta = sku ? skuMeta[skuKey(sku.style, sku.colour, sku.leather)] : undefined;
  const styleRrp = sku ? styleMeta[sku.style]?.rrp : undefined;

  // Fitting images query
  const { data: images = [], refetch: refetchImages } = trpc.fitting.getImages.useQuery(
    sku ? { style: sku.style, colour: sku.colour, leather: sku.leather } : { style: "", colour: "", leather: "" },
    { enabled: !!sku }
  );

  const updateMutation = trpc.sku.update.useMutation({
    onSuccess: () => { onMetaChange(); },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const uploadMutation = trpc.fitting.uploadImage.useMutation({
    onSuccess: () => { refetchImages(); toast.success("Image uploaded"); },
    onError: (err) => toast.error(`Upload failed: ${err.message}`),
  });

  const deleteMutation = trpc.fitting.deleteImage.useMutation({
    onSuccess: () => { refetchImages(); toast.success("Image deleted"); },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!sku || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} is too large (max 10MB)`); continue; }
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await uploadMutation.mutateAsync({
          style: sku.style, colour: sku.colour, leather: sku.leather,
          imageData: dataUrl, mimeType: file.type,
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [sku, uploadMutation]);

  const handleSampleToggle = useCallback(() => {
    if (!sku) return;
    const current = meta?.sampleStatus ?? "waiting";
    const next = current === "waiting" ? "received" : "waiting";
    updateMutation.mutate({ style: sku.style, colour: sku.colour, leather: sku.leather, sampleStatus: next as "waiting" | "received" });
  }, [sku, meta, updateMutation]);

  const handleOrderQty = useCallback((val: string) => {
    if (!sku) return;
    const qty = parseInt(val, 10);
    if (!isNaN(qty) && qty >= 0) {
      updateMutation.mutate({ style: sku.style, colour: sku.colour, leather: sku.leather, orderQty: qty });
    }
  }, [sku, updateMutation]);

  // Style-level Size 11 mutation — updates ALL SKUs in the style
  const updateStyleSize11Mutation = trpc.sku.updateStyleSize11.useMutation({
    onSuccess: () => { onMetaChange(); },
    onError: (err) => toast.error(`Failed to update Size 11: ${err.message}`),
  });

  const handleSize11 = useCallback((checked: boolean) => {
    if (!sku) return;
    // If we have all style SKUs, update them all at once (style-level)
    if (allStyleSkus && allStyleSkus.length > 0) {
      updateStyleSize11Mutation.mutate({ style: sku.style, skus: allStyleSkus, isSize11: checked });
    } else {
      // Fallback: update just this SKU
      updateMutation.mutate({ style: sku.style, colour: sku.colour, leather: sku.leather, isSize11: checked });
    }
  }, [sku, updateMutation, updateStyleSize11Mutation, allStyleSkus]);

  const handleFitRating = useCallback((val: string | null) => {
    if (!sku) return;
    setLocalFitRating(val);
    updateMutation.mutate({ style: sku.style, colour: sku.colour, leather: sku.leather, fitRating: val as any });
  }, [sku, updateMutation]);

  const handleSaveNotes = useCallback(async () => {
    if (!sku || localNotes === null) return;
    setSavingNotes(true);
    try {
      await updateMutation.mutateAsync({ style: sku.style, colour: sku.colour, leather: sku.leather, fittingNotes: localNotes });
      setLocalNotes(null);
      toast.success("Notes saved");
    } finally {
      setSavingNotes(false);
    }
  }, [sku, localNotes, updateMutation]);

  if (!sku) return null;

  const sampleStatus = meta?.sampleStatus ?? "waiting";
  const orderQty = meta?.orderQty ?? 0;
  const isSize11 = meta?.isSize11 ?? false;
  const fitRating = localFitRating !== undefined ? localFitRating : (meta?.fitRating ?? null);
  const notes = localNotes !== null ? localNotes : (meta?.fittingNotes ?? "");

  return (
    <div className="fixed inset-0 z-50 flex" style={{ pointerEvents: "auto" }}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="w-[480px] max-w-full h-full flex flex-col bg-card shadow-2xl overflow-y-auto"
        style={{ borderLeft: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b sticky top-0 bg-card z-10" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-foreground">{sku.style}</h2>
              {sku.isNew && (
                <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>NEW</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {sku.colour} · {sku.leather}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sku.category} · Last: {sku.last}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Sample Status + Order Qty */}
          <div className="grid grid-cols-2 gap-4">
            {/* Sample Status */}
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Sample Status</p>
              <button
                onClick={handleSampleToggle}
                disabled={updateMutation.isPending}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all"
                style={{
                  background: sampleStatus === "received" ? "oklch(0.94 0.08 155)" : "oklch(0.96 0.04 65)",
                  color: sampleStatus === "received" ? "oklch(0.40 0.14 155)" : "oklch(0.50 0.14 55)",
                }}
              >
                {sampleStatus === "received"
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  : <Clock className="w-4 h-4 flex-shrink-0" />}
                {sampleStatus === "received" ? "Received" : "Waiting"}
              </button>
              <p className="text-xs text-muted-foreground mt-2">Click to toggle</p>
            </div>

            {/* Order Qty (new SKUs only) */}
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Order Qty</p>
              <input
                type="number"
                min={0}
                defaultValue={orderQty}
                key={`qty-${sku.style}-${sku.colour}-${sku.leather}`}
                onBlur={(e) => handleOrderQty(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                style={{ borderColor: "var(--border)" }}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-2">Units (all sizes)</p>
            </div>
          </div>

          {/* Size 11 + Cost + RRP */}
          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Size 11 Available</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSize11}
                  onChange={(e) => handleSize11(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                  style={{ background: isSize11 ? "#f59e0b" : "var(--muted)" }} />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cost Price</span>
              <span className="text-sm font-semibold font-mono text-foreground">
                {meta?.costPrice != null ? `$${meta.costPrice.toFixed(2)}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">RRP</span>
              <span className="text-sm font-semibold font-mono text-foreground">
                {styleRrp != null ? `$${styleRrp.toFixed(2)}` : "—"}
              </span>
            </div>
            {meta?.costPrice != null && styleRrp != null && (
              <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                <span className="text-sm text-muted-foreground">Margin</span>
                <span className="text-sm font-semibold" style={{ color: "oklch(0.50 0.14 55)" }}>
                  {Math.round(((styleRrp - meta.costPrice) / styleRrp) * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Fit Rating */}
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Fit Rating</p>
            <div className="flex gap-2">
              {FIT_RATINGS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => handleFitRating(fitRating === r.value ? null : r.value)}
                  className="flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all border"
                  style={{
                    background: fitRating === r.value ? "oklch(0.96 0.08 65)" : "transparent",
                    borderColor: fitRating === r.value ? "oklch(0.88 0.10 65)" : "var(--border)",
                    color: fitRating === r.value ? "oklch(0.50 0.14 55)" : "var(--muted-foreground)",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fitting Notes */}
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Fitting Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="Add fitting notes for the factory…"
              rows={4}
              className="w-full px-3 py-2 rounded-lg border text-sm text-foreground bg-background resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              style={{ borderColor: "var(--border)" }}
            />
            {localNotes !== null && (
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="mt-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: "#f59e0b", color: "white" }}
              >
                {savingNotes ? "Saving…" : "Save Notes"}
              </button>
            )}
          </div>

          {/* Fitting Images */}
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fitting Images ({images.length})
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "oklch(0.96 0.04 65)", color: "oklch(0.50 0.14 55)" }}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Uploading…" : "Upload"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {images.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed cursor-pointer"
                style={{ borderColor: "var(--border)" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload fitting images</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 10MB each</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-square bg-muted">
                    <img src={img.imageUrl} alt="Fitting" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                      <button
                        onClick={() => deleteMutation.mutate({ id: img.id })}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-full bg-red-500 text-white transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="absolute bottom-1 left-1 right-1 text-xs text-white/80 truncate px-1">
                      {new Date(img.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
                {/* Add more button */}
                <div
                  className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
