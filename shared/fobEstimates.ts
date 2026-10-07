export type StyleFobColourway = {
  style: string;
  leather?: string | null;
  leather2?: string | null;
  actualFobUsd?: number | null;
};

export type StyleFobSummary = {
  totalColourways: number;
  /** Actual factory FOBs entered in SKU Dash. */
  costedColourways: number;
  /** Clearly labelled estimates based on actual FOBs for the same style/material. */
  estimatedColourways: number;
  /** No actual or same-material FOB is available. */
  missingColourways: number;
  /** Average of actual and same-material estimated FOBs for the style. */
  rolledUpFobUsd: number | null;
  /** Lowest actual/estimated FOB in the current style. */
  minFobUsd: number | null;
  /** Highest actual/estimated FOB in the current style, used for the RRP guide. */
  maxFobUsd: number | null;
};

function normaliseMaterial(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Matches like-for-like material combinations within a style. A second upper
 * remains part of the material identity so dual-upper colourways are not
 * accidentally compared with a single-upper SKU.
 */
export function getStyleMaterialKey(colourway: Pick<StyleFobColourway, "leather" | "leather2">): string {
  return `${normaliseMaterial(colourway.leather)}\u0000${normaliseMaterial(colourway.leather2)}`;
}

function validFob(value?: number | null): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Builds a style-level pricing basis without writing estimates to the database.
 * Missing colourways are estimated only from actual FOBs of the same material
 * within the same style; every such estimate must be marked with an asterisk in
 * the UI. Colourways with no comparable material remain uncosted.
 */
export function summariseStyleFobCosts(colourways: StyleFobColourway[]): Record<string, StyleFobSummary> {
  const actualFobsByStyleMaterial = new Map<string, number[]>();

  for (const colourway of colourways) {
    const fob = validFob(colourway.actualFobUsd);
    if (fob == null) continue;
    const key = `${colourway.style}\u0001${getStyleMaterialKey(colourway)}`;
    const values = actualFobsByStyleMaterial.get(key) ?? [];
    values.push(fob);
    actualFobsByStyleMaterial.set(key, values);
  }

  const running = new Map<string, {
    totalColourways: number;
    costedColourways: number;
    estimatedColourways: number;
    missingColourways: number;
    coveredFobs: number[];
  }>();

  for (const colourway of colourways) {
    const summary = running.get(colourway.style) ?? {
      totalColourways: 0,
      costedColourways: 0,
      estimatedColourways: 0,
      missingColourways: 0,
      coveredFobs: [],
    };
    summary.totalColourways += 1;

    const actualFob = validFob(colourway.actualFobUsd);
    if (actualFob != null) {
      summary.costedColourways += 1;
      summary.coveredFobs.push(actualFob);
    } else {
      const materialKey = `${colourway.style}\u0001${getStyleMaterialKey(colourway)}`;
      const comparableFobs = actualFobsByStyleMaterial.get(materialKey) ?? [];
      if (comparableFobs.length > 0) {
        summary.estimatedColourways += 1;
        summary.coveredFobs.push(average(comparableFobs));
      } else {
        summary.missingColourways += 1;
      }
    }
    running.set(colourway.style, summary);
  }

  const summaries: Record<string, StyleFobSummary> = {};
  for (const [style, summary] of Array.from(running.entries())) {
    const coveredFobs = summary.coveredFobs;
    summaries[style] = {
      totalColourways: summary.totalColourways,
      costedColourways: summary.costedColourways,
      estimatedColourways: summary.estimatedColourways,
      missingColourways: summary.missingColourways,
      rolledUpFobUsd: coveredFobs.length > 0 ? average(coveredFobs) : null,
      minFobUsd: coveredFobs.length > 0 ? Math.min(...coveredFobs) : null,
      maxFobUsd: coveredFobs.length > 0 ? Math.max(...coveredFobs) : null,
    };
  }
  return summaries;
}
