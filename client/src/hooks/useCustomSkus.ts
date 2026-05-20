import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useMemo } from "react";

export type CustomSkuRow = {
  id: number;
  style: string;
  colour: string;
  leather: string;
  isNew: boolean;
  createdAt: Date;
};

/**
 * Fetches custom SKUs from the DB and merges them with the static skuData.
 *
 * Custom SKUs respect the `isNew` flag from the DB:
 *  - isNew = true  → treated as new (appears in sample tracking, new SKU counts)
 *  - isNew = false → treated as existing carry-over (excluded from sample tracking)
 *
 * Also fetches skuNewOverrides which can override the is_new flag for static SKUs
 * (e.g. marking PAXOS as existing so it disappears from Fitting/Specs/New counts).
 *
 * Returns:
 *  - customSkus: raw list of custom SKU rows from DB
 *  - mergedRawSkus: skuData.rawSkus + custom SKUs (as RawSku-shaped objects), with overrides applied
 *  - mergedStyles: skuData.styles with custom SKUs folded in (colours/leathers updated), with overrides applied
 *  - isLoading: whether the query is still loading
 */
export function useCustomSkus() {
  const { data: customSkus = [], isLoading, refetch } = trpc.customSku.getAll.useQuery(undefined, {
    staleTime: 30_000,
  });

  // Fetch DB image overrides so they take precedence over static CDN URLs everywhere
  const { data: imageOverrides = [], refetch: refetchImageOverrides } = trpc.styleImage.getAll.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Fetch new/existing overrides set via the AI assistant
  const { data: skuNewOverrides = [] } = trpc.skuNewOverride.getAll.useQuery(undefined, {
    staleTime: 30_000,
  });

  const imageOverrideMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of imageOverrides as Array<{ style: string; imageUrl: string }>) {
      map[o.style.toUpperCase()] = o.imageUrl;
    }
    return map;
  }, [imageOverrides]);

  /**
   * Build a lookup map for new/existing overrides.
   * Key format: "STYLE|COLOUR|LEATHER"
   * Special style-level key: "STYLE|__all__|" — applies to all SKUs of that style.
   */
  const skuNewOverrideMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const o of skuNewOverrides as Array<{ style: string; colour: string; leather: string; isNew: boolean }>) {
      const key = `${o.style.toUpperCase()}|${o.colour}|${o.leather}`;
      map[key] = o.isNew;
    }
    return map;
  }, [skuNewOverrides]);

  /**
   * Resolve the effective isNew value for a given style/colour/leather,
   * checking the style-level __all__ override first, then the per-SKU override.
   */
  function resolveIsNew(style: string, colour: string, leather: string, defaultValue: boolean): boolean {
    const styleKey = `${style.toUpperCase()}|__all__|`;
    if (styleKey in skuNewOverrideMap) return skuNewOverrideMap[styleKey];
    const skuKey = `${style.toUpperCase()}|${colour.toUpperCase()}|${(leather ?? "").toUpperCase()}`;
    if (skuKey in skuNewOverrideMap) return skuNewOverrideMap[skuKey];
    return defaultValue;
  }

  // Merge custom SKUs into rawSkus — same shape as skuData.rawSkus entries
  const mergedRawSkus = useMemo(() => {
    // Apply overrides to static SKUs
    const baseSkus = (skuData.rawSkus as Array<{ style: string; colour: string; leather: string; is_new: boolean }>).map((sku) => {
      const effectiveIsNew = resolveIsNew(sku.style, sku.colour, sku.leather ?? "", sku.is_new);
      if (effectiveIsNew === sku.is_new) return sku;
      return { ...sku, is_new: effectiveIsNew };
    });

    if (customSkus.length === 0) return baseSkus;

    const extra = customSkus.map((c) => ({
      style: c.style as string,
      colour: c.colour as string,
      leather: c.leather as string,
      is_new: resolveIsNew(c.style, c.colour, c.leather ?? "", (c.isNew ?? true) as boolean),
      _customId: c.id,
    }));

    // Deduplicate: don't add if already in static data
    const existing = new Set(baseSkus.map((s) => `${s.style}|${s.colour}|${s.leather}`));
    const filtered = extra.filter((e) => !existing.has(`${e.style}|${e.colour}|${e.leather}`));

    return [...(baseSkus as unknown as typeof extra), ...filtered];
  }, [customSkus, skuNewOverrideMap]);

  // Merge custom SKUs into styles — update colours/leathers arrays
  const mergedStyles = useMemo(() => {
    // Build a map of style -> extra {colour, leather, isNew} pairs from custom SKUs
    const extras: Record<string, Array<{ colour: string; leather: string; isNew: boolean }>> = {};
    for (const c of customSkus) {
      if (!extras[c.style]) extras[c.style] = [];
      extras[c.style].push({
        colour: c.colour,
        leather: c.leather,
        isNew: resolveIsNew(c.style, c.colour, c.leather ?? "", c.isNew ?? true),
      });
    }

    return skuData.styles.map((s) => {
      const extra = extras[s.style] ?? [];
      const overrideUrl = imageOverrideMap[s.style.toUpperCase()];

      // Re-compute new SKU counts for static SKUs of this style using overrides
      const staticNewCount = (skuData.rawSkus as Array<{ style: string; colour: string; leather: string; is_new: boolean }>)
        .filter((r) => r.style === s.style)
        .filter((r) => resolveIsNew(r.style, r.colour, r.leather ?? "", r.is_new))
        .length;

      const customNewCount = extra.filter((e) => e.isNew).length;
      const totalNewSKUs = staticNewCount + customNewCount;
      const totalSKUs = s.totalSKUs + extra.length;

      const newColours = Array.from(new Set(extra.map((e) => e.colour).filter((c) => !(s.colours as string[]).includes(c)))) as any[];
      const newLeathers = Array.from(new Set(extra.map((e) => e.leather).filter((l) => l && !(s.leathers as string[]).includes(l)))) as any[];

      return {
        ...s,
        ...(overrideUrl ? { imageUrl: overrideUrl } : {}),
        colours: [...s.colours, ...newColours],
        leathers: [...s.leathers, ...newLeathers],
        totalSKUs,
        newSKUs: totalNewSKUs,
        hasNew: totalNewSKUs > 0,
        isAllNew: totalNewSKUs === totalSKUs && totalSKUs > 0,
      };
    });
  }, [customSkus, imageOverrideMap, skuNewOverrideMap]);

  return {
    customSkus: customSkus as CustomSkuRow[],
    mergedRawSkus,
    mergedStyles,
    isLoading,
    refetch,
    refetchImageOverrides,
  };
}
