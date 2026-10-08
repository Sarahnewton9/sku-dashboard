import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, DollarSign, Ruler, Search, ShoppingCart, Stamp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSeason } from "@/contexts/SeasonContext";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { useCancelledStyles } from "@/hooks/useCancelledStyles";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";
import { getNewLastsForSeason } from "@shared/const";
import { getW27NewPatternStyleNames, isEligibleFittingStyle } from "@shared/fittingStyleScope";
import { buildRangeReadiness, type RangeReadinessRow } from "@shared/rangeReadiness";

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

type BuyQty = { total?: number };

type Filter = "all" | "attention" | "ready";

const percent = (value: number) => `${Math.round(value * 100)}%`;

function Metric({ label, value, note, icon: Icon, tone = "amber" }: {
  label: string;
  value: string;
  note: string;
  icon: typeof ClipboardList;
  tone?: "amber" | "green" | "blue" | "rose";
}) {
  const colours = {
    amber: "oklch(0.58 0.15 55)",
    green: "oklch(0.50 0.15 155)",
    blue: "oklch(0.53 0.13 230)",
    rose: "oklch(0.58 0.15 25)",
  }[tone];
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{note}</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${colours}18`, color: colours }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function Gate({ label, detail, status }: { label: string; detail: string; status: "ready" | "attention" | "not_required" }) {
  if (status === "not_required") return null;
  const ready = status === "ready";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium"
      style={ready
        ? { borderColor: "oklch(0.76 0.12 155)", background: "oklch(0.96 0.04 155)", color: "oklch(0.35 0.12 155)" }
        : { borderColor: "oklch(0.84 0.12 75)", background: "oklch(0.98 0.03 75)", color: "oklch(0.45 0.12 55)" }}
    >
      {ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}: {detail}
    </span>
  );
}

function ReadinessCard({ row }: { row: RangeReadinessRow }) {
  const complete = row.blockers.length === 0;
  return (
    <article className="overflow-hidden rounded-xl border" style={{ borderColor: complete ? "oklch(0.78 0.10 155)" : "var(--border)", background: "var(--card)" }}>
      <div className="flex gap-4 p-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted" style={{ borderColor: "var(--border)" }}>
          {row.imageUrl ? <img src={row.imageUrl} alt={row.style} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">—</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold tracking-wide text-foreground">{row.style}</h3>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={complete
                  ? { background: "oklch(0.93 0.06 155)", color: "oklch(0.35 0.12 155)" }
                  : { background: "oklch(0.96 0.05 75)", color: "oklch(0.45 0.12 55)" }}>
                  {complete ? "READY" : `${percent(row.readiness)} READY`}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{row.last} · {row.category} · {row.newSkuCount} new SKU{row.newSkuCount === 1 ? "" : "s"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-foreground">{row.nextAction}</p>
              <p className="mt-1 text-xs text-muted-foreground">{row.readyGateCount}/{row.requiredGateCount} required gates ready</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {row.gates.map((gate) => <Gate key={gate.key} {...gate} />)}
          </div>
        </div>
      </div>
    </article>
  );
}

/** A single action-oriented worklist for the new-season range development gates. */
export default function RangeReadinessTab() {
  const { season } = useSeason();
  const { mergedRawSkus, mergedStyles, customStyleRows } = useCustomSkus();
  const { cancelledSet: cancelledStyleSet } = useCancelledStyles(season);
  const { data: ss26CustomStyleRows = [] } = trpc.customStyle.getAll.useQuery(
    { season: "SS26" },
    { enabled: season === "W27", staleTime: 300_000 },
  );
  const { data: cancelledSkuRows = [] } = trpc.cancelledSku.list.useQuery({ season });
  const { data: styleMetaRows = [] } = trpc.style.getAll.useQuery();
  const { data: allSessions = [] } = trpc.fittingSession.getAll.useQuery({ season });
  const { data: approvals = [] } = trpc.lastApproval.getAll.useQuery({ season });
  const { data: deletedLasts = [] } = trpc.lastApproval.getDeleted.useQuery({ season });
  const { data: customLastRows = [] } = trpc.customLast.getAll.useQuery({ season });
  const { data: allSpecMeta = [] } = trpc.specs.getAllMeta.useQuery({ season });
  const { data: seasonCosts = [] } = trpc.sku.getSeasonCosts.useQuery({ season });
  const { data: skuMetaRows = [] } = trpc.sku.getAll.useQuery();
  const { data: allSessionQtys = {} } = trpc.buy.getAllSessionQtys.useQuery({ season });
  const [filter, setFilter] = useState<Filter>("attention");
  const [search, setSearch] = useState("");

  const cancelledSkuSet = useMemo(() => new Set(
    (cancelledSkuRows as Array<{ style: string; colour: string; leather: string }>).map((row) => `${row.style}|${row.colour}|${row.leather}`),
  ), [cancelledSkuRows]);

  const activeSkus = useMemo(() => (mergedRawSkus as ActiveSku[]).filter((sku) =>
    !cancelledStyleSet.has(sku.style) && !cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`),
  ), [mergedRawSkus, cancelledStyleSet, cancelledSkuSet]);

  const activeSkusByStyle = useMemo(() => {
    const map = new Map<string, ActiveSku[]>();
    for (const sku of activeSkus) map.set(sku.style, [...(map.get(sku.style) ?? []), sku]);
    return map;
  }, [activeSkus]);

  const styleMetaMap = useMemo(() => new Map(
    (styleMetaRows as Array<{ style: string; fitApproved?: boolean | null; rrp?: number | null }>).map((row) => [row.style, row]),
  ), [styleMetaRows]);
  const specStatusMap = useMemo(() => new Map(
    (allSpecMeta as Array<{ style: string; specStatus?: string | null }>).map((row) => [row.style, row.specStatus ?? "not_started"]),
  ), [allSpecMeta]);
  const approvalMap = useMemo(() => new Map(
    (approvals as Array<{ lastName: string; status: string }>).map((row) => [row.lastName.toUpperCase(), row.status]),
  ), [approvals]);
  const approvalLasts = useMemo(() => {
    const deleted = new Set((deletedLasts as string[]).map((last) => last.toUpperCase()));
    const staticLasts = getNewLastsForSeason(season).map((last) => last.toUpperCase());
    const customLasts = (customLastRows as Array<{ lastName: string; isRunOn: boolean }>)
      .filter((last) => !last.isRunOn)
      .map((last) => last.lastName.toUpperCase());
    return new Set([...staticLasts, ...customLasts].filter((last) => !deleted.has(last)));
  }, [customLastRows, deletedLasts, season]);
  const fittedStyles = useMemo(() => new Set((allSessions as Array<{ style: string }>).map((session) => session.style)), [allSessions]);
  const costMap = useMemo(() => new Map(
    (seasonCosts as Array<{ style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null; cost: number }>)
      .filter((row) => Number.isFinite(row.cost) && row.cost > 0)
      .map((row) => [getSkuCompositeIdentity(row.style, row.colour, row.leather, row.colour2, row.leather2), row.cost]),
  ), [seasonCosts]);
  const rrpOverrideMap = useMemo(() => new Map(
    (skuMetaRows as Array<{ style: string; colour: string; leather: string; rrpOverride?: number | null }>)
      .filter((row) => row.rrpOverride != null && row.rrpOverride > 0)
      .map((row) => [`${row.style}|${row.colour}|${row.leather}`, row.rrpOverride]),
  ), [skuMetaRows]);

  const readiness = useMemo(() => {
    const w27Patterns = getW27NewPatternStyleNames(customStyleRows, ss26CustomStyleRows);
    const quantities = allSessionQtys as Record<string, BuyQty>;
    const inputs = (mergedStyles as Array<{ style: string; last: string; category: string; imageUrl?: string; _isCustomStyle?: boolean }>)
      .filter((style) => !cancelledStyleSet.has(style.style))
      .map((style) => {
        const styleSkus = activeSkusByStyle.get(style.style) ?? [];
        const newSkus = styleSkus.filter((sku) => sku.is_new);
        const fitApproved = Boolean(styleMetaMap.get(style.style)?.fitApproved);
        const requiresFitting = isEligibleFittingStyle(season, style.style, Boolean(style._isCustomStyle), w27Patterns);
        const needsLastApproval = approvalLasts.has((style.last ?? "").toUpperCase());
        const costedNewSkuCount = newSkus.filter((sku) => {
          const identity = getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2);
          const sourceIdentity = getSkuCompositeIdentity(sku.style, sku._sourceColour ?? sku.colour, sku._sourceLeather ?? sku.leather, sku.colour2, sku.leather2);
          return costMap.has(identity) || costMap.has(sourceIdentity);
        }).length;
        const boughtNewSkuCount = newSkus.filter((sku) => {
          const identity = getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2);
          const sourceIdentity = getSkuCompositeIdentity(sku.style, sku._sourceColour ?? sku.colour, sku._sourceLeather ?? sku.leather, sku.colour2, sku.leather2);
          return (quantities[identity]?.total ?? quantities[sourceIdentity]?.total ?? 0) > 0;
        }).length;
        const hasStyleRrp = (styleMetaMap.get(style.style)?.rrp ?? 0) > 0;
        const hasRrp = newSkus.length === 0 || newSkus.every((sku) => hasStyleRrp || rrpOverrideMap.has(`${sku.style}|${sku._sourceColour ?? sku.colour}|${sku._sourceLeather ?? sku.leather}`));
        return {
          style: style.style,
          last: style.last,
          category: style.category,
          imageUrl: style.imageUrl,
          isNew: newSkus.length > 0,
          requiresFitting,
          needsLastApproval,
          lastApproved: approvalMap.get((style.last ?? "").toUpperCase()) === "approved",
          fitApproved,
          hasFittingSession: fittedStyles.has(style.style),
          specComplete: specStatusMap.get(style.style) === "complete",
          newSkuCount: newSkus.length,
          boughtNewSkuCount,
          costedNewSkuCount,
          hasRrp,
        };
      })
      .filter((style) => style.isNew || style.requiresFitting || style.needsLastApproval);
    return buildRangeReadiness(inputs);
  }, [activeSkusByStyle, allSessionQtys, approvalLasts, approvalMap, cancelledStyleSet, costMap, customStyleRows, fittedStyles, mergedStyles, rrpOverrideMap, season, specStatusMap, ss26CustomStyleRows, styleMetaMap]);

  const blockers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of readiness.rows) for (const blocker of row.blockers) counts.set(blocker, (counts.get(blocker) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [readiness.rows]);

  const visibleRows = useMemo(() => readiness.rows.filter((row) => {
    if (filter === "attention" && row.blockers.length === 0) return false;
    if (filter === "ready" && row.blockers.length > 0) return false;
    const term = search.trim().toLowerCase();
    return !term || [row.style, row.last, row.category, ...row.blockers].join(" ").toLowerCase().includes(term);
  }), [filter, readiness.rows, search]);

  const newBuyCompletion = readiness.summary.newSkus > 0 ? readiness.summary.boughtNewSkus / readiness.summary.newSkus : 1;
  const fobCompletion = readiness.summary.newSkus > 0 ? readiness.summary.costedNewSkus / readiness.summary.newSkus : 1;
  const fittingCompletion = readiness.summary.fittingRequired > 0 ? readiness.summary.fittingApproved / readiness.summary.fittingRequired : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Range Readiness</h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">A practical worklist for the active {season} development range. Core and carry-over styles are not counted as incomplete; only relevant gates are shown.</p>
        </div>
        <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "oklch(0.96 0.06 65)", color: "oklch(0.50 0.14 55)" }}>New range worklist</span>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric label="Range-ready styles" value={`${readiness.summary.readyStyles}/${readiness.summary.styles}`} note={`${readiness.summary.attentionStyles} with a development blocker`} icon={CheckCircle2} tone="green" />
        <Metric label="New SKUs bought" value={`${readiness.summary.boughtNewSkus}/${readiness.summary.newSkus}`} note={`${percent(newBuyCompletion)} physical new-SKU completion`} icon={ShoppingCart} tone="blue" />
        <Metric label="New SKUs with FOB" value={`${readiness.summary.costedNewSkus}/${readiness.summary.newSkus}`} note={`${percent(fobCompletion)} current-season factory costs saved`} icon={DollarSign} tone="amber" />
        <Metric label="Fits approved" value={`${readiness.summary.fittingApproved}/${readiness.summary.fittingRequired}`} note={`${percent(fittingCompletion)} required new-pattern fits signed off`} icon={Ruler} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="flex flex-wrap gap-2">
              {(["attention", "ready", "all"] as Filter[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={filter === item
                    ? { background: "oklch(0.30 0.02 60)", color: "white" }
                    : { background: "var(--muted)", color: "var(--muted-foreground)" }}
                >
                  {item === "attention" ? `Needs action (${readiness.summary.attentionStyles})` : item === "ready" ? `Ready (${readiness.summary.readyStyles})` : "All active"}
                </button>
              ))}
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search style or blocker" className="h-8 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>

          <div className="space-y-3">
            {visibleRows.map((row) => <ReadinessCard key={row.style} row={row} />)}
            {visibleRows.length === 0 && (
              <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>No styles match this readiness view.</div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4" style={{ color: "oklch(0.58 0.15 55)" }} /><h3 className="text-sm font-bold text-foreground">What is blocking readiness?</h3></div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Counts are style-level and only include gates that apply to the active new-season development range.</p>
          <div className="mt-4 space-y-3">
            {blockers.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: "var(--border)" }}>
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "oklch(0.97 0.04 75)", color: "oklch(0.45 0.12 55)" }}>{count}</span>
              </div>
            ))}
            {blockers.length === 0 && <p className="text-sm text-muted-foreground">No development blockers in this season.</p>}
          </div>
          <div className="mt-5 rounded-lg border p-3 text-xs leading-relaxed text-muted-foreground" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
            <p><strong className="text-foreground">Gate logic:</strong> Fit is required only for new patterns; Last applies only to new lasts; Specs, FOB, RRP and Buy apply only to new physical SKUs.</p>
            <p className="mt-2"><Stamp className="mr-1 inline h-3 w-3" />Last sign-off: {readiness.summary.lastApproved}/{readiness.summary.lastApprovalRequired} approved · Specs: {readiness.summary.specsComplete}/{readiness.summary.specsRequired} complete</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
