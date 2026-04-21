/**
 * SkuDetailPanel — slide-out panel for a single SKU
 * Shows: sample status, order qty, size 11, cost price, RRP
 * Fit rating/notes/images are now at style level — see FittingTab
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { X, CheckCircle, Clock } from "lucide-react";
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
  }>;
  styleMeta: Record<string, { rrp?: number | null }>;
  onMetaChange: () => void;
  // All SKUs for the style (for style-level Size 11 toggle)
  allStyleSkus?: Array<{ colour: string; leather: string }>;
}

function skuKey(style: string, colour: string, leather: string) {
  return `${style}|${colour}|${leather}`;
}

export default function SkuDetailPanel({ sku, onClose, skuMeta, styleMeta, onMetaChange, allStyleSkus }: Props) {
  const [savingQty, setSavingQty] = useState(false);

  const utils = trpc.useUtils();

  const meta = sku ? skuMeta[skuKey(sku.style, sku.colour, sku.leather)] : undefined;
  const styleRrp = sku ? styleMeta[sku.style]?.rrp : undefined;

  const updateMutation = trpc.sku.update.useMutation({
    onSuccess: () => { onMetaChange(); },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

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
    if (allStyleSkus && allStyleSkus.length > 0) {
      updateStyleSize11Mutation.mutate({ style: sku.style, skus: allStyleSkus, isSize11: checked });
    } else {
      updateMutation.mutate({ style: sku.style, colour: sku.colour, leather: sku.leather, isSize11: checked });
    }
  }, [sku, updateMutation, updateStyleSize11Mutation, allStyleSkus]);

  if (!sku) return null;

  const sampleStatus = meta?.sampleStatus ?? "waiting";
  const orderQty = meta?.orderQty ?? 0;
  const isSize11 = meta?.isSize11 ?? false;

  return (
    <div className="fixed inset-0 z-50 flex" style={{ pointerEvents: "auto" }}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="w-[420px] max-w-full h-full flex flex-col bg-card shadow-2xl overflow-y-auto"
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
              {sku.colour}{sku.leather ? ` · ${sku.leather}` : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sku.category} · Last: {sku.last}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Style image */}
        {sku.imageUrl && (
          <div className="px-6 pt-5">
            <img
              src={sku.imageUrl}
              alt={sku.style}
              className="w-full max-h-48 object-contain rounded-lg bg-muted"
            />
          </div>
        )}

        <div className="flex-1 px-6 py-5 space-y-4">

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

            {/* Order Qty */}
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

          {/* Hint about fitting */}
          <p className="text-xs text-muted-foreground text-center px-2">
            Fit rating, notes &amp; images are tracked per style in the <strong>Fitting</strong> tab (Approval section).
          </p>

        </div>
      </div>
    </div>
  );
}
