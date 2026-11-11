import { getSkuCompositeIdentity } from "./skuCompositeIdentity";
import { formatSkuExportLabel, type SkuUpperData } from "./skuExportLabel";

/** A physical SKU identity that may be requested for fitting outside normal style scope. */
export type FittingSkuRequest = {
  style: string;
  colour: string;
  leather: string;
  colour2: string | null;
  leather2: string | null;
  season: string;
};

/**
 * The one currently approved fitting exception. Keep this list explicit: it is
 * not a rule for all custom colours, Upper 2 variants, or other styles.
 */
export const FITTING_SKU_REQUESTS: readonly FittingSkuRequest[] = [
  {
    season: "W27",
    style: "CUBA",
    colour: "BLACK",
    leather: "SUPRA",
    colour2: null,
    leather2: null,
  },
];

export type ActiveFittingSku = SkuUpperData & {
  style: string;
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
};

function normalizeSeason(season: string | null | undefined): string {
  return String(season ?? "").trim().toUpperCase();
}

/**
 * Returns requested fitting labels grouped by uppercase style, but only when
 * the exact requested five-part physical identity is present in activeSkus.
 * activeSkus is expected to have already had cancellation/markdown filtering
 * applied by its caller.
 */
export function getRequestedFittingSkuLabels(
  season: string,
  activeSkus: readonly ActiveFittingSku[],
): Map<string, string[]> {
  const requested = FITTING_SKU_REQUESTS.filter(
    (request) => normalizeSeason(request.season) === normalizeSeason(season),
  );
  if (requested.length === 0 || activeSkus.length === 0) return new Map();

  const requestedByIdentity = new Map(
    requested.map((request) => [
      getSkuCompositeIdentity(
        request.style,
        request.colour,
        request.leather,
        request.colour2,
        request.leather2,
      ),
      request,
    ]),
  );
  const labelsByStyle = new Map<string, string[]>();
  const seen = new Set<string>();

  for (const sku of activeSkus) {
    const identity = getSkuCompositeIdentity(
      sku.style,
      sku.colour,
      sku.leather,
      sku.colour2,
      sku.leather2,
    );
    const request = requestedByIdentity.get(identity);
    if (!request || seen.has(identity)) continue;

    const style = request.style.trim().toUpperCase();
    const labels = labelsByStyle.get(style) ?? [];
    labels.push(formatSkuExportLabel(request));
    labelsByStyle.set(style, labels);
    seen.add(identity);
  }

  return labelsByStyle;
}
