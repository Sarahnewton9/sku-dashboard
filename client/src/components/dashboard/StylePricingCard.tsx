import { useEffect, useMemo, useState } from "react";
import { Calculator, Check, CircleDollarSign, Save, Sparkles } from "lucide-react";
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

function formatCurrency(value: number | null | undefined): string {
  return value == null ? "—" : `$${value.toFixed(2)}`;
}

/**
 * Development price card: cost and margin are planned at style level, while a
 * colour-specific RRP exception remains available in the SKU detail drawer.
 */
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
  const [targetMargin, setTargetMargin] = useState("75");
  const [rrp, setRrp] = useState("");

  useEffect(() => {
    setLandedCost(pricing?.landedCost != null ? pricing.landedCost.toFixed(2) : "");
    setTargetMargin(((pricing?.targetMargin ?? 0.75) * 100).toFixed(0));
    setRrp(pricing?.rrp != null ? pricing.rrp.toFixed(2) : "");
  }, [pricing?.landedCost, pricing?.rrp, pricing?.targetMargin, style]);

  const landedCostValue = amountFromInput(landedCost);
  const targetMarginValue = percentageFromInput(targetMargin);
  const rrpValue = amountFromInput(rrp);
  const suggestedRrp = useMemo(() => {
    if (landedCostValue == null || !targetMarginValue) return null;
    return getSuggestedAuRrp(landedCostValue, targetMarginValue);
  }, [landedCostValue, targetMarginValue]);
  const actualMargin = landedCostValue != null && rrpValue != null
    ? getAuGrossMargin(landedCostValue, rrpValue)
    : null;
  const marginOnTarget = actualMargin != null && targetMarginValue != null && actualMargin >= targetMarginValue;

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
            <p className="text-xs text-muted-foreground">AUD retail planning · price includes GST</p>
          </div>
        </div>
        {pricing?.pricingSource && <span className="text-xs text-muted-foreground">Seed: {pricing.pricingSource}</span>}
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(210px,1.2fr)]">
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Landed cost (AUD)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input value={landedCost} onChange={(event) => setLandedCost(event.target.value)} inputMode="decimal" placeholder="0.00" className="h-9 w-full rounded-md border bg-background pl-6 pr-3 text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-amber-400/40" style={{ borderColor: "var(--border)" }} />
          </div>
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Target margin</span>
          <div className="relative">
            <input value={targetMargin} onChange={(event) => setTargetMargin(event.target.value)} inputMode="decimal" placeholder="75" className="h-9 w-full rounded-md border bg-background px-3 pr-7 text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-amber-400/40" style={{ borderColor: "var(--border)" }} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">RRP (AUD inc. GST)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input value={rrp} onChange={(event) => setRrp(event.target.value)} inputMode="decimal" placeholder="Set RRP" className="h-9 w-full rounded-md border bg-background pl-6 pr-3 text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-amber-400/40" style={{ borderColor: "var(--border)" }} />
          </div>
        </label>
        <div className="rounded-lg border bg-white/60 px-3 py-2" style={{ borderColor: "oklch(0.86 0.08 65)" }}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Suggested RRP</span>
            {suggestedRrp != null && <button type="button" onClick={() => setRrp(suggestedRrp.toFixed(2))} className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">Use</button>}
          </div>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{formatCurrency(suggestedRrp)}</p>
          <p className="text-[11px] text-muted-foreground">Rounded up to the Buy Plan RRP ladder</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "oklch(0.88 0.06 65)" }}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span className="text-muted-foreground">Current gross margin: <strong className={marginOnTarget ? "text-emerald-700" : actualMargin != null ? "text-amber-700" : "text-foreground"}>{actualMargin != null ? `${(actualMargin * 100).toFixed(1)}%` : "—"}</strong></span>
          {actualMargin != null && targetMarginValue != null && <span className={marginOnTarget ? "text-emerald-700" : "text-amber-700"}>{marginOnTarget ? "On / above target" : `${((targetMarginValue - actualMargin) * 100).toFixed(1)} pts below target`}</span>}
          <span className="text-muted-foreground">Formula: landed cost ÷ (1 − target) + GST</span>
        </div>
        <button type="button" onClick={save} disabled={updatePricing.isPending} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-60" style={{ background: "oklch(0.50 0.14 55)" }}>
          {updatePricing.isPending ? <Calculator className="h-3.5 w-3.5 animate-pulse" /> : <Save className="h-3.5 w-3.5" />}
          {updatePricing.isPending ? "Saving…" : "Save pricing"}
        </button>
      </div>
      <div className="flex items-center gap-1.5 px-4 pb-3 text-[11px] text-muted-foreground"><Check className="h-3.5 w-3.5" /> Set a colour-specific price only when needed from that SKU’s detail panel.</div>
    </section>
  );
}
