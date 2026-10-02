import { useEffect, useState } from "react";
import { AlertTriangle, Calculator, CircleDollarSign, Save } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  FOB_MARGIN_ASSUMPTIONS,
  getAuGrossMarginFromFob,
  getMarginStatus,
  getSuggestedAuRrpFromFob,
} from "@shared/fobMargin";

type StylePricing = {
  rrp?: number | null;
};

type FactoryCostSummary = {
  totalColourways: number;
  costedColourways: number;
  minFobUsd?: number | null;
  maxFobUsd?: number | null;
};

function amountFromInput(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatFobRange(summary?: FactoryCostSummary): string {
  if (!summary?.costedColourways || summary.minFobUsd == null || summary.maxFobUsd == null) return "—";
  if (Math.abs(summary.minFobUsd - summary.maxFobUsd) < 0.005) return `$${summary.minFobUsd.toFixed(2)}`;
  return `$${summary.minFobUsd.toFixed(2)}–$${summary.maxFobUsd.toFixed(2)}`;
}

function formatMarginRange(lowMargin: number | null, highMargin: number | null): string {
  if (lowMargin == null || highMargin == null) return "Add FOB and RRP";
  if (Math.abs(lowMargin - highMargin) < 0.0005) return `${(lowMargin * 100).toFixed(1)}%`;
  return `${(lowMargin * 100).toFixed(1)}–${(highMargin * 100).toFixed(1)}%`;
}

/**
 * Margin guide based on current factory FOB (USD) costs. The highest FOB in a
 * style is used for the suggested RRP and target/tolerance status, protecting
 * the result when a colourway costs more than the rest of its style.
 */
export function StylePricingCard({
  style,
  pricing,
  factoryCosts,
  onSaved,
}: {
  style: string;
  pricing?: StylePricing;
  factoryCosts?: FactoryCostSummary;
  onSaved?: () => void;
}) {
  const [rrp, setRrp] = useState("");

  useEffect(() => {
    setRrp(pricing?.rrp != null ? pricing.rrp.toFixed(2) : "");
  }, [pricing?.rrp, style]);

  const rrpValue = amountFromInput(rrp);
  const completeFobCoverage = Boolean(
    factoryCosts
      && factoryCosts.totalColourways > 0
      && factoryCosts.costedColourways === factoryCosts.totalColourways
      && factoryCosts.minFobUsd != null
      && factoryCosts.maxFobUsd != null,
  );
  const lowMargin = completeFobCoverage && rrpValue != null && factoryCosts?.maxFobUsd != null
    ? getAuGrossMarginFromFob(factoryCosts.maxFobUsd, rrpValue)
    : null;
  const highMargin = completeFobCoverage && rrpValue != null && factoryCosts?.minFobUsd != null
    ? getAuGrossMarginFromFob(factoryCosts.minFobUsd, rrpValue)
    : null;
  const suggestedRrp = completeFobCoverage && factoryCosts?.maxFobUsd != null
    ? getSuggestedAuRrpFromFob(factoryCosts.maxFobUsd)
    : null;
  const marginStatus = getMarginStatus(lowMargin);
  const isBelowTolerance = marginStatus === "below_tolerance";
  const isWithinTolerance = marginStatus === "within_tolerance";

  const updateRrp = trpc.style.setRrp.useMutation({
    onSuccess: () => {
      toast.success(`${style} RRP saved`);
      onSaved?.();
    },
    onError: (error) => toast.error(`Could not save RRP: ${error.message}`),
  });

  const save = () => {
    if (rrp.trim() && (rrpValue == null || rrpValue <= 0)) {
      toast.error("Enter a valid RRP, or clear the field to remove it.");
      return;
    }
    updateRrp.mutate({ style, rrp: rrpValue });
  };

  const costCoverage = factoryCosts
    ? `${factoryCosts.costedColourways} of ${factoryCosts.totalColourways} colourways costed`
    : "No active colourways";

  return (
    <section className="mb-4 overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: "oklch(0.84 0.08 65)", background: "linear-gradient(135deg, oklch(0.99 0.025 65), oklch(0.975 0.04 65))" }}>
      <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "oklch(0.88 0.06 65)" }}>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "oklch(0.89 0.12 75)", color: "oklch(0.38 0.13 55)" }}><CircleDollarSign className="h-4 w-4" /></span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Style pricing</h3>
            <p className="text-xs text-muted-foreground">Factory FOB (USD) · RRP (AUD incl. GST)</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">Margin guide: USD→AUD {FOB_MARGIN_ASSUMPTIONS.usdToAud.toFixed(2)} · AU${FOB_MARGIN_ASSUMPTIONS.freightAud.toFixed(2)} freight</p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-background/70 px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">FOB (USD)</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{formatFobRange(factoryCosts)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{costCoverage}</p>
        </div>
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">RRP (AUD incl. GST)</span>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <input value={rrp} onChange={(event) => setRrp(event.target.value)} inputMode="decimal" placeholder="Set RRP" className="h-9 w-full rounded-md border bg-background pl-6 pr-3 text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-amber-400/40" style={{ borderColor: "var(--border)" }} />
            </div>
            <button type="button" onClick={save} disabled={updateRrp.isPending} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-60" style={{ background: "oklch(0.50 0.14 55)" }}>
              <Save className="h-3.5 w-3.5" />
              {updateRrp.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </label>
      </div>

      <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-2" style={{ borderColor: "oklch(0.88 0.06 65)" }}>
        <div
          className="rounded-lg border px-3 py-2"
          style={isBelowTolerance
            ? { borderColor: "oklch(0.82 0.10 75)", background: "oklch(0.98 0.04 75)" }
            : isWithinTolerance
              ? { borderColor: "oklch(0.89 0.05 75)", background: "oklch(0.99 0.025 75)" }
              : { borderColor: "transparent", background: "color-mix(in oklab, var(--background) 70%, transparent)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current margin</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{formatMarginRange(lowMargin, highMargin)}</p>
          {isBelowTolerance && <p className="mt-1 flex items-center gap-1 text-[10px] font-medium" style={{ color: "oklch(0.52 0.12 65)" }}><AlertTriangle className="h-3 w-3" aria-hidden="true" />Below 70% tolerance</p>}
          {isWithinTolerance && <p className="mt-1 text-[10px] text-muted-foreground">Within 70–74% tolerance</p>}
          {!completeFobCoverage && <p className="mt-1 text-[10px] text-muted-foreground">Complete FOB costs to calculate margin</p>}
        </div>
        <div className="rounded-lg bg-background/70 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">RRP guide at 75%</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{suggestedRrp != null ? `$${suggestedRrp.toFixed(2)}` : "Complete FOB costs"}</p>
          {suggestedRrp != null && <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Calculator className="h-3 w-3" aria-hidden="true" />Uses the highest FOB colourway</p>}
        </div>
      </div>
    </section>
  );
}
