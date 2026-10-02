import { useEffect, useState } from "react";
import { Calculator, Check, CircleDollarSign, Save } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

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

/**
 * Development price card: factory / landed costs are held in USD, while retail
 * RRPs are held in AUD. Margin suggestions stay disabled until an approved
 * USD-to-AUD landed-cost policy is configured.
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
            <p className="text-xs text-muted-foreground">USD factory costs · AUD retail RRPs include GST</p>
          </div>
        </div>
        {pricing?.pricingSource && <span className="text-xs text-muted-foreground">Seed: {pricing.pricingSource}</span>}
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Factory / landed cost (USD)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">US$</span>
            <input value={landedCost} onChange={(event) => setLandedCost(event.target.value)} inputMode="decimal" placeholder="0.00" className="h-9 w-full rounded-md border bg-background pl-10 pr-3 text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-amber-400/40" style={{ borderColor: "var(--border)" }} />
          </div>
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Target margin (for AU converted cost)</span>
          <div className="relative">
            <input value={targetMargin} onChange={(event) => setTargetMargin(event.target.value)} inputMode="decimal" placeholder="75" className="h-9 w-full rounded-md border bg-background px-3 pr-7 text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-amber-400/40" style={{ borderColor: "var(--border)" }} />
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

      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "oklch(0.88 0.06 65)" }}>
        <p className="max-w-2xl text-xs text-muted-foreground">Margin and RRP suggestions are intentionally paused: USD factory costs cannot be compared to an AUD RRP until the approved USD→AUD landed-cost conversion (including freight, duty and other costs) is defined.</p>
        <button type="button" onClick={save} disabled={updatePricing.isPending} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-60" style={{ background: "oklch(0.50 0.14 55)" }}>
          {updatePricing.isPending ? <Calculator className="h-3.5 w-3.5 animate-pulse" /> : <Save className="h-3.5 w-3.5" />}
          {updatePricing.isPending ? "Saving…" : "Save pricing"}
        </button>
      </div>
      <div className="flex items-center gap-1.5 px-4 pb-3 text-[11px] text-muted-foreground"><Check className="h-3.5 w-3.5" /> Set a colour-specific price only when needed from that SKU’s detail panel.</div>
    </section>
  );
}
