import { useMemo } from "react";
import { AlertTriangle, DollarSign, Package, Target, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSeason } from "@/contexts/SeasonContext";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { useCancelledStyles } from "@/hooks/useCancelledStyles";
import { useStyleCategories } from "@/hooks/useStyleCategories";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";
import { buildPlanningAnalysis, type PlanningLine } from "@shared/planningAnalysis";
import { FOB_MARGIN_ASSUMPTIONS } from "@shared/fobMargin";

type ActiveSku = {
  style: string;
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
  is_new: boolean;
  _sourceColour?: string;
  _sourceLeather?: string;
};

type BuyQty = {
  total: number;
  totalAu: number;
  totalUsa: number;
  totalNyc: number;
  totalLa: number;
};

const usd = new Intl.NumberFormat("en-AU", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});
const aud = new Intl.NumberFormat("en-AU", {
  style: "currency", currency: "AUD", maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function ratio(value: number, total: number): number {
  return total > 0 ? value / total : 0;
}

function CoverageBar({ value, tone = "amber" }: { value: number; tone?: "amber" | "green" | "blue" }) {
  const colours = {
    amber: "#f59e0b",
    green: "#10b981",
    blue: "#0ea5e9",
  };
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: colours[tone] }} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  accent = "amber",
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Package;
  accent?: "amber" | "green" | "blue" | "rose";
}) {
  const styles = {
    amber: { bg: "oklch(0.97 0.06 75)", icon: "oklch(0.58 0.15 55)" },
    green: { bg: "oklch(0.96 0.05 155)", icon: "oklch(0.50 0.15 155)" },
    blue: { bg: "oklch(0.96 0.04 230)", icon: "oklch(0.53 0.13 230)" },
    rose: { bg: "oklch(0.97 0.04 25)", icon: "oklch(0.58 0.15 25)" },
  }[accent];
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{note}</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: styles.bg, color: styles.icon }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

export default function PlanningAnalysisTab() {
  const { season } = useSeason();
  const { mergedRawSkus, mergedStyles } = useCustomSkus();
  const { cancelledSet: cancelledStyleSet } = useCancelledStyles(season);
  const { getCategory } = useStyleCategories();
  const { data: allSessionQtys = {} } = trpc.buy.getAllSessionQtys.useQuery({ season });
  const { data: seasonCostRows = [] } = trpc.sku.getSeasonCosts.useQuery({ season });
  const { data: skuMetaRows = [] } = trpc.sku.getAll.useQuery();
  const { data: styleMetaRows = [] } = trpc.style.getAll.useQuery();
  const { data: cancelledSkuRows = [] } = trpc.cancelledSku.list.useQuery({ season });

  const cancelledSkuSet = useMemo(
    () => new Set((cancelledSkuRows as Array<{ style: string; colour: string; leather: string }>)
      .map((row) => `${row.style}|${row.colour}|${row.leather}`)),
    [cancelledSkuRows],
  );

  const styleInfoMap = useMemo(() => {
    const map: Record<string, { category: string; last: string }> = {};
    for (const style of mergedStyles as Array<{ style: string; category: string; last: string }>) {
      map[style.style] = { category: getCategory(style.style, style.category), last: style.last };
    }
    return map;
  }, [mergedStyles, getCategory]);

  const seasonCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of seasonCostRows as Array<{ style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null; cost: number }>) {
      if (Number.isFinite(row.cost) && row.cost > 0) {
        map.set(getSkuCompositeIdentity(row.style, row.colour, row.leather, row.colour2, row.leather2), row.cost);
      }
    }
    return map;
  }, [seasonCostRows]);

  const skuMetaMap = useMemo(() => {
    const map = new Map<string, { costPrice?: number | null; rrpOverride?: number | null }>();
    for (const row of skuMetaRows as Array<{ style: string; colour: string; leather: string; costPrice?: number | null; rrpOverride?: number | null }>) {
      map.set(`${row.style}|${row.colour}|${row.leather}`, row);
    }
    return map;
  }, [skuMetaRows]);

  const styleRrpMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of styleMetaRows as Array<{ style: string; rrp?: number | null }>) {
      if (row.rrp != null && Number.isFinite(row.rrp) && row.rrp > 0) map.set(row.style, row.rrp);
    }
    return map;
  }, [styleMetaRows]);

  const activeRangeSkus = useMemo(() => (mergedRawSkus as ActiveSku[]).filter((sku) => {
    if (cancelledStyleSet.has(sku.style)) return false;
    return !cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`);
  }), [mergedRawSkus, cancelledStyleSet, cancelledSkuSet]);

  const plan = useMemo(() => {
    const quantities = allSessionQtys as Record<string, BuyQty>;
    const planningLines: PlanningLine[] = [];
    const activeNewByCategory = new Map<string, { rangeSkus: number; plannedSkus: number }>();
    const missingNew: Array<{ style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null; category: string; last: string }> = [];

    for (const sku of activeRangeSkus) {
      const identity = getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2);
      const sourceIdentity = getSkuCompositeIdentity(
        sku.style,
        sku._sourceColour ?? sku.colour,
        sku._sourceLeather ?? sku.leather,
        sku.colour2,
        sku.leather2,
      );
      const quantitiesForSku = quantities[identity] ?? quantities[sourceIdentity];
      const styleInfo = styleInfoMap[sku.style] ?? { category: "Uncategorised", last: "—" };
      const sourceMetaKey = `${sku.style}|${sku._sourceColour ?? sku.colour}|${sku._sourceLeather ?? sku.leather}`;
      const meta = skuMetaMap.get(sourceMetaKey) ?? skuMetaMap.get(`${sku.style}|${sku.colour}|${sku.leather}`);
      const fobUsd = seasonCostMap.get(identity) ?? seasonCostMap.get(sourceIdentity) ?? meta?.costPrice ?? null;
      const rrpAud = meta?.rrpOverride ?? styleRrpMap.get(sku.style) ?? null;

      if (sku.is_new) {
        const completion = activeNewByCategory.get(styleInfo.category) ?? { rangeSkus: 0, plannedSkus: 0 };
        completion.rangeSkus += 1;
        if ((quantitiesForSku?.total ?? 0) > 0) completion.plannedSkus += 1;
        activeNewByCategory.set(styleInfo.category, completion);
        if ((quantitiesForSku?.total ?? 0) === 0) {
          missingNew.push({ ...sku, category: styleInfo.category, last: styleInfo.last });
        }
      }

      if (!quantitiesForSku || quantitiesForSku.total <= 0) continue;
      planningLines.push({
        style: sku.style,
        category: styleInfo.category,
        last: styleInfo.last,
        isNew: sku.is_new,
        auQty: quantitiesForSku.totalAu ?? 0,
        usaQty: quantitiesForSku.totalUsa ?? 0,
        nycQty: quantitiesForSku.totalNyc ?? 0,
        laQty: quantitiesForSku.totalLa ?? 0,
        fobUsd,
        rrpAud,
      });
    }

    const analysis = buildPlanningAnalysis(planningLines);
    const categoryCompletion = Array.from(activeNewByCategory.entries())
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.rangeSkus - a.rangeSkus || a.category.localeCompare(b.category));

    return { analysis, missingNew, categoryCompletion };
  }, [activeRangeSkus, allSessionQtys, seasonCostMap, skuMetaMap, styleRrpMap, styleInfoMap]);

  const totalNewRangeSkus = plan.categoryCompletion.reduce((sum, row) => sum + row.rangeSkus, 0);
  const plannedNewRangeSkus = plan.categoryCompletion.reduce((sum, row) => sum + row.plannedSkus, 0);
  const total = plan.analysis.total;
  const costCoverage = ratio(total.costedUnits, total.units);
  const rrpCoverage = ratio(total.pricedUnits, total.units);
  const planCompletion = ratio(plannedNewRangeSkus, totalNewRangeSkus);
  const missingCostUnits = total.units - total.costedUnits;
  const missingRrpUnits = total.units - total.pricedUnits;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Planning Analysis</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Merchandising view across every {season} buy session: units, cost, spend, retail value and buy completion.</p>
        </div>
        <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "oklch(0.96 0.06 65)", color: "oklch(0.50 0.14 55)" }}>
          All {season} buy sessions combined
        </span>
      </div>

      {total.units === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center" style={{ borderColor: "var(--border)" }}>
          <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No buy quantities yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add quantities in By Style or Buy Sessions to unlock planning spend, mix and completion measures.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Planned units" value={integer.format(total.units)} note={`${formatPercent(ratio(total.newUnits, total.units))} new-season mix`} icon={Package} />
            <MetricCard label="FOB spend" value={usd.format(total.fobSpendUsd)} note={`${formatPercent(costCoverage)} of units costed`} icon={DollarSign} accent="green" />
            <MetricCard label="Planning landed spend" value={aud.format(total.landedSpendAud)} note="FOB converted using current planning basis" icon={TrendingUp} accent="blue" />
            <MetricCard label="Retail value" value={aud.format(total.retailValueAud)} note={`${formatPercent(rrpCoverage)} of units have an RRP`} icon={Target} accent="amber" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border p-5 lg:col-span-2" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-foreground">New SKU buy completion</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Physical W27 new SKUs with a quantity in any current-season session.</p>
                </div>
                <span className="text-2xl font-bold tabular-nums" style={{ color: "oklch(0.50 0.15 155)" }}>{formatPercent(planCompletion)}</span>
              </div>
              <div className="mt-4"><CoverageBar value={planCompletion} tone="green" /></div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className="font-semibold text-foreground">{integer.format(plannedNewRangeSkus)} <span className="font-normal text-muted-foreground">planned</span></span>
                <span className="font-semibold text-foreground">{integer.format(plan.missingNew.length)} <span className="font-normal text-muted-foreground">still to buy</span></span>
                <span className="text-muted-foreground">of {integer.format(totalNewRangeSkus)} active new SKUs</span>
              </div>
            </div>
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <p className="text-sm font-bold text-foreground">Weighted gross margin</p>
              <p className="mt-2 text-3xl font-bold tabular-nums" style={{ color: total.grossMargin != null && total.grossMargin < 0.7 ? "oklch(0.58 0.15 25)" : "oklch(0.50 0.15 155)" }}>
                {formatPercent(total.grossMargin)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">On {integer.format(total.comparableUnits)} units with both FOB and RRP.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="flex items-center justify-between"><p className="text-sm font-bold text-foreground">FOB coverage</p><span className="text-sm font-semibold">{formatPercent(costCoverage)}</span></div>
              <div className="mt-3"><CoverageBar value={costCoverage} tone={missingCostUnits > 0 ? "amber" : "green"} /></div>
              <p className="mt-3 text-xs text-muted-foreground">{integer.format(total.costedUnits)} of {integer.format(total.units)} planned units have a current-season FOB. {missingCostUnits > 0 ? `${integer.format(missingCostUnits)} units remain without spend.` : "All planned units are costed."}</p>
            </div>
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="flex items-center justify-between"><p className="text-sm font-bold text-foreground">RRP coverage</p><span className="text-sm font-semibold">{formatPercent(rrpCoverage)}</span></div>
              <div className="mt-3"><CoverageBar value={rrpCoverage} tone={missingRrpUnits > 0 ? "amber" : "green"} /></div>
              <p className="mt-3 text-xs text-muted-foreground">{integer.format(total.pricedUnits)} of {integer.format(total.units)} planned units have a style or SKU RRP. {missingRrpUnits > 0 ? `${integer.format(missingRrpUnits)} units are outside the margin view.` : "All planned units have an RRP."}</p>
            </div>
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" style={{ color: "oklch(0.58 0.15 55)" }} /><p className="text-sm font-bold text-foreground">Planning attention</p></div>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <li><span className="font-semibold text-foreground">{integer.format(plan.missingNew.length)}</span> new SKUs still have no buy quantity.</li>
                <li><span className="font-semibold text-foreground">{integer.format(missingCostUnits)}</span> planned units need FOB coverage.</li>
                <li><span className="font-semibold text-foreground">{integer.format(missingRrpUnits)}</span> planned units need RRP coverage.</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-sm font-bold text-foreground">Buy plan by market</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Unit mix and spend allocation across all current-season sessions.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground" style={{ background: "var(--muted)" }}>
                    <tr><th className="px-5 py-3 text-left">Market</th><th className="px-3 py-3 text-right">Units</th><th className="px-3 py-3 text-right">Mix</th><th className="px-3 py-3 text-right">FOB USD</th><th className="px-5 py-3 text-right">GM</th></tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {plan.analysis.markets.map((row) => (
                      <tr key={row.market}>
                        <td className="px-5 py-3 font-semibold text-foreground">{row.market}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{integer.format(row.units)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatPercent(ratio(row.units, total.units))}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{row.costedUnits > 0 ? usd.format(row.fobSpendUsd) : "—"}</td>
                        <td className="px-5 py-3 text-right tabular-nums font-semibold">{formatPercent(row.grossMargin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-sm font-bold text-foreground">New SKU plan by category</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Completion tracks whether each active new physical SKU has any quantity.</p>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 text-xs uppercase tracking-wide text-muted-foreground" style={{ background: "var(--muted)" }}>
                    <tr><th className="px-5 py-3 text-left">Category</th><th className="px-3 py-3 text-right">Planned</th><th className="px-3 py-3 text-right">Total</th><th className="px-5 py-3 text-right">%</th></tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {plan.categoryCompletion.map((row) => (
                      <tr key={row.category}>
                        <td className="px-5 py-3 font-medium text-foreground">{row.category}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{integer.format(row.plannedSkus)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{integer.format(row.rangeSkus)}</td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatPercent(ratio(row.plannedSkus, row.rangeSkus))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-sm font-bold text-foreground">Top planned styles by FOB spend</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Only actual current-season FOBs contribute to spend. A dash means the supporting cost or RRP is still missing.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground" style={{ background: "var(--muted)" }}>
                  <tr><th className="px-5 py-3 text-left">Style</th><th className="px-3 py-3 text-left">Last</th><th className="px-3 py-3 text-right">Units</th><th className="px-3 py-3 text-right">Mix</th><th className="px-3 py-3 text-right">FOB USD</th><th className="px-3 py-3 text-right">Retail AUD</th><th className="px-5 py-3 text-right">GM</th></tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {plan.analysis.styles.slice(0, 25).map((row) => (
                    <tr key={row.style}>
                      <td className="px-5 py-3"><p className="font-semibold text-foreground">{row.style}</p><p className="text-xs text-muted-foreground">{row.category}</p></td>
                      <td className="px-3 py-3 text-muted-foreground">{row.last}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{integer.format(row.units)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatPercent(ratio(row.units, total.units))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.costedUnits > 0 ? usd.format(row.fobSpendUsd) : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.pricedUnits > 0 ? aud.format(row.retailValueAud) : "—"}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold">{formatPercent(row.grossMargin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {plan.missingNew.length > 0 && (
            <div className="rounded-xl border" style={{ borderColor: "oklch(0.87 0.08 75)", background: "oklch(0.985 0.025 75)" }}>
              <div className="px-5 py-4">
                <h3 className="text-sm font-bold text-foreground">New SKUs still to buy</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">First {Math.min(30, plan.missingNew.length)} of {plan.missingNew.length} active new SKUs with no quantity in any {season} buy session.</p>
              </div>
              <div className="grid border-t sm:grid-cols-2 xl:grid-cols-3" style={{ borderColor: "oklch(0.87 0.08 75)" }}>
                {plan.missingNew.slice(0, 30).map((sku) => (
                  <div key={getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2)} className="border-b border-r px-5 py-3" style={{ borderColor: "oklch(0.87 0.08 75)" }}>
                    <p className="text-sm font-semibold text-foreground">{sku.style}</p>
                    <p className="text-xs text-muted-foreground">{[sku.colour, sku.leather].filter(Boolean).join(" ")}{sku.colour2 || sku.leather2 ? ` / ${[sku.colour2, sku.leather2].filter(Boolean).join(" ")}` : ""}</p>
                    <p className="mt-1 text-xs" style={{ color: "oklch(0.50 0.10 70)" }}>{sku.category} · {sku.last}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="rounded-lg border px-4 py-3 text-xs leading-relaxed text-muted-foreground" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
            <strong className="text-foreground">Planning basis:</strong> FOB spend uses actual season-specific FOBs in USD. Planning landed spend converts FOB at US$0.70 per AU$1 and adds AU${FOB_MARGIN_ASSUMPTIONS.freightAud.toFixed(2)} freight per pair. Retail value uses stored RRP including GST; gross margin compares planning landed spend with RRP excluding GST. Missing costs and RRPs are deliberately excluded rather than estimated.
          </p>
        </>
      )}
    </div>
  );
}
