import { getEstimatedLandedCostAud } from "./fobMargin";

export type PlanningMarket = "AU" | "USA" | "NYC" | "LA";

export type PlanningLine = {
  style: string;
  category: string;
  last: string;
  isNew: boolean;
  auQty: number;
  usaQty: number;
  nycQty: number;
  laQty: number;
  fobUsd: number | null;
  rrpAud: number | null;
};

export type PlanningRollup = {
  units: number;
  newUnits: number;
  costedUnits: number;
  pricedUnits: number;
  comparableUnits: number;
  fobSpendUsd: number;
  landedSpendAud: number;
  retailValueAud: number;
  grossMargin: number | null;
};

export type PlanningAnalysis = {
  total: PlanningRollup;
  markets: Array<PlanningRollup & { market: PlanningMarket }>;
  categories: Array<PlanningRollup & { category: string }>;
  styles: Array<PlanningRollup & { style: string; category: string; last: string }>;
};

type MutableRollup = Omit<PlanningRollup, "grossMargin"> & {
  comparableRetailExGstAud: number;
  comparableLandedSpendAud: number;
};

const MARKETS: PlanningMarket[] = ["AU", "USA", "NYC", "LA"];

function emptyRollup(): MutableRollup {
  return {
    units: 0,
    newUnits: 0,
    costedUnits: 0,
    pricedUnits: 0,
    comparableUnits: 0,
    fobSpendUsd: 0,
    landedSpendAud: 0,
    retailValueAud: 0,
    comparableRetailExGstAud: 0,
    comparableLandedSpendAud: 0,
  };
}

function toPublicRollup(rollup: MutableRollup): PlanningRollup {
  const grossMargin = rollup.comparableRetailExGstAud > 0
    ? 1 - rollup.comparableLandedSpendAud / rollup.comparableRetailExGstAud
    : null;
  return {
    units: rollup.units,
    newUnits: rollup.newUnits,
    costedUnits: rollup.costedUnits,
    pricedUnits: rollup.pricedUnits,
    comparableUnits: rollup.comparableUnits,
    fobSpendUsd: rollup.fobSpendUsd,
    landedSpendAud: rollup.landedSpendAud,
    retailValueAud: rollup.retailValueAud,
    grossMargin,
  };
}

function quantityForMarket(line: PlanningLine, market?: PlanningMarket): number {
  if (!market) return line.auQty + line.usaQty + line.nycQty + line.laQty;
  if (market === "AU") return line.auQty;
  if (market === "USA") return line.usaQty;
  if (market === "NYC") return line.nycQty;
  return line.laQty;
}

function addLine(rollup: MutableRollup, line: PlanningLine, quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) return;

  rollup.units += quantity;
  if (line.isNew) rollup.newUnits += quantity;

  const hasFob = Number.isFinite(line.fobUsd) && (line.fobUsd ?? 0) > 0;
  const hasRrp = Number.isFinite(line.rrpAud) && (line.rrpAud ?? 0) > 0;

  if (hasFob) {
    const fob = line.fobUsd as number;
    const landedPerUnit = getEstimatedLandedCostAud(fob);
    rollup.costedUnits += quantity;
    rollup.fobSpendUsd += fob * quantity;
    if (landedPerUnit != null) rollup.landedSpendAud += landedPerUnit * quantity;
  }

  if (hasRrp) {
    const rrp = line.rrpAud as number;
    rollup.pricedUnits += quantity;
    rollup.retailValueAud += rrp * quantity;
  }

  if (hasFob && hasRrp) {
    rollup.comparableUnits += quantity;
    rollup.comparableRetailExGstAud += ((line.rrpAud as number) / 1.1) * quantity;
    const landedPerUnit = getEstimatedLandedCostAud(line.fobUsd as number);
    if (landedPerUnit != null) rollup.comparableLandedSpendAud += landedPerUnit * quantity;
  }
}

/**
 * Rolls W27 buy quantities into merchandising planning measures. Values only
 * include a spend or margin when the supporting FOB and/or RRP are present;
 * missing cost data is not estimated here.
 */
export function buildPlanningAnalysis(lines: PlanningLine[]): PlanningAnalysis {
  const total = emptyRollup();
  const markets = new Map<PlanningMarket, MutableRollup>(MARKETS.map((market) => [market, emptyRollup()]));
  const categories = new Map<string, MutableRollup>();
  const styles = new Map<string, MutableRollup & { category: string; last: string }>();

  for (const line of lines) {
    const totalQty = quantityForMarket(line);
    if (totalQty <= 0) continue;

    addLine(total, line, totalQty);

    const category = line.category || "Uncategorised";
    const categoryRollup = categories.get(category) ?? emptyRollup();
    addLine(categoryRollup, line, totalQty);
    categories.set(category, categoryRollup);

    const styleRollup = styles.get(line.style) ?? {
      ...emptyRollup(),
      category,
      last: line.last || "—",
    };
    addLine(styleRollup, line, totalQty);
    styles.set(line.style, styleRollup);

    for (const market of MARKETS) {
      const marketQty = quantityForMarket(line, market);
      if (marketQty > 0) addLine(markets.get(market)!, line, marketQty);
    }
  }

  return {
    total: toPublicRollup(total),
    markets: MARKETS.map((market) => ({ market, ...toPublicRollup(markets.get(market)!) })),
    categories: Array.from(categories.entries())
      .map(([category, rollup]) => ({ category, ...toPublicRollup(rollup) }))
      .sort((a, b) => b.units - a.units || a.category.localeCompare(b.category)),
    styles: Array.from(styles.entries())
      .map(([style, rollup]) => ({
        style,
        category: rollup.category,
        last: rollup.last,
        ...toPublicRollup(rollup),
      }))
      .sort((a, b) => b.fobSpendUsd - a.fobSpendUsd || b.units - a.units || a.style.localeCompare(b.style)),
  };
}
