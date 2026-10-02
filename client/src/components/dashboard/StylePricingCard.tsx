import { useEffect, useState } from "react";
import { AlertTriangle, Calculator, CircleDollarSign, Save } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getAuGrossMargin, getSuggestedAuRrp } from "@shared/stylePricing";

type StylePricing = {
  landedCost?: number | null;
  targetMargin?: number | null;
  rrp?: number | null;
  pricingSource?: string | null;
};

function amountFromInput(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function percentageFromInput(value: string): number | null {
  const parsed = Number(value.replace(/[%\s]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed / 100 : null;
}

/** Planning card using the Buy Plan's AUD landed-cost and GST-exclusive margin basis. */
export function StylePricingCard({
  style,
  pricing,
  onSaved,
}: {
  style: string;
  pricing?: StylePricing;
  onSaved?: () => void;
}) {
  const [landedCost, setLandedCost] = useState("");
  const [targetMargin, setTargetMargin] = useState("70");
  const [rrp, setRrp] = useState("");

  useEffect(() => {
    setLandedCost(pricing?.landedCost != null ? pricing.landedCost.toFixed(2) : "");
    setTargetMargin(((pricing?.targetMargin ?? 0.70) * 100).toFixed(0));
    setRrp(pricing?.rrp != null ? pricing.rrp.toFixed(2) : "");
  }, [pricing?.landedCost, pricing?.rrp, pricing?.targetMargin, style]);

  const landedCostValue = amountFromInput(landedCost);
  const targetMarginValue = percentageFromInput(targetMargin);
  const rrpValue = amountFromInput(rrp);
  const currentMargin = landedCostValue != null && rrpValue != null
    ? getAuGrossMargin(landedCostValue, rrpValue)
    : null;
  const suggestedRrp = landedCostValue != null && targetMarginValue != null
    ? getSuggestedAuRrp(landedCostValue, targetMarginValue)
    : null;
  const suggestedMargin = landedCostValue != null && suggestedRrp != null
    ? getAuGrossMargin(landedCostValue, suggestedRrp)
    : null;
  const isBelowTarget = currentMargin != null && targetMarginValue != null
    && currentMargin < targetMarginValue - 0.0001;

  const updatePricing = trpc.style.updatePricing.useMutation({
    onSuccess: () => {
      toast.success(`${style} pricing saved`);
      onSaved?.();
    },
    onError: (error) => toast.error(`Could not save pricing: ${error.message}`),
  });

  const save = () => {
    if (landedCost.trim() && landedCostValue == null) {
      toast.error("Enter a valid landed cost.");
      return;
    }
    if (targetMarginValue == null) {
      toast.error("Enter a target margin between 1% and 99%.");
      return;
    }
    if (rrp.trim() && (rrpValue == null || rrpValue <= 0)) {
      toast.error("Enter a valid RRP.");
      return;
    }
    updatePricing.mutate({
      style,
      landedCost: landedCostValue,
      targetMargin: targetMarginValue,
      rrp: rrpValue,
      pricingSource: "SKU Dash range plan",
    });
  };

  return (
    <section className="mb-4 overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: "oklch(0.84 0.08 65)", background: "linear-gradient(135deg, oklch(0.99 0.025 65), oklch(0.975 0.04 65))" }}>
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "oklch(0.88 0.06 65)" }}>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "oklch(0.89 0.12 75)", color: "oklch(0.38 0.13 55)" }}><CircleDollarSign className="h-4 w-4" /></span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Style pricing</h3>
            <p className="text-xs text-muted-foreground">Buy Plan landed cost (AUD) · RRP includes GST</p>
          </div>
        </div>
        {pricing?.pricingSource && <span className="text-xs text-muted-foreground">Seed: {pricing.pricingSource}</span>}
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Buy Plan landed cost (AUD)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input value={landedCost} onChange={(event) => setLandedCost(event.target.value)} inputMode="decimal" placeholder="0.00" className="h-9 w-full rounded-md border bg-background pl-10 pr-3 text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-amber-400/40" style={{ borderColor: "var(--border)" }} />
          </div>
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Target margin</span>
          <div className="relative">
            <input value={targetMargin} onChange={(event) => setTargetMargin(event.target.value)} inputMode="decimal" placeholder="70" className="h-9 w-full rounded-md border bg-background px-3 pr-7 text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-amber-400/40" style={{ borderColor: "var(--border)" }} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">RRP (AUD incl. GST)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input value={rrp} onChange={(event) => setRrp(event.target.value)} inputMode="decimal" placeholder="Set RRP" className="h-9 w-full rounded-md border bg-background pl-6 pr-3 text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-amber-400/40" style={{ borderColor: "var(--border)" }} />
          </div>
        </label>
      </div>

      {(currentMargin != null || suggestedRrp != null) && (
        <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-2" style={{ borderColor: "oklch(0.88 0.06 65)" }}>
          <div
            className="rounded-lg border px-3 py-2"
            style={isBelowTarget
              ? { borderColor: "oklch(0.82 0.10 75)", background: "oklch(0.98 0.04 75)" }
              : { borderColor: "transparent", background: "color-mix(in oklab, var(--background) 70%, transparent)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current margin</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {currentMargin != null ? `${(currentMargin * 100).toFixed(1)}%` : "Add landed cost and RRP"}
            </p>
            {isBelowTarget && (
              <p className="mt-1 flex items-center gap-1 text-[10px] font-medium" style={{ color: "oklch(0.52 0.12 65)" }}>
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Below {(targetMarginValue! * 100).toFixed(0)}% target
              </p>
            )}
          </div>
          <div className="rounded-lg bg-background/70 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">RRP guide at {targetMarginValue != null ? `${(targetMarginValue * 100).toFixed(0)}%` : "target"}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {suggestedRrp != null ? `$${suggestedRrp.toFixed(2)}` : "Add landed cost"}
              {suggestedMargin != null && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({(suggestedMargin * 100).toFixed(1)}%)</span>}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t px-4 py-2.5" style={{ borderColor: "oklch(0.88 0.06 65)" }}>
        <p className="text-[11px] text-muted-foreground">Factory costs stay USD per SKU; this guide uses the Buy Plan’s AUD landed cost.</p>
        <button type="button" onClick={save} disabled={updatePricing.isPending} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-60" style={{ background: "oklch(0.50 0.14 55)" }}>
          {updatePricing.isPending ? <Calculator className="h-3.5 w-3.5 animate-pulse" /> : <Save className="h-3.5 w-3.5" />}
          {updatePricing.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
