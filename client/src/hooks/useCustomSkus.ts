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
 * Returns:
 *  - customSkus: raw list of custom SKU rows from DB
 *  - mergedRawSkus: skuData.rawSkus + custom SKUs (as RawSku-shaped objects)
 *  - mergedStyles: skuData.styles with custom SKUs folded in (colours/leathers updated)
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
  const imageOverrideMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of imageOverrides as Array<{ style: string; imageUrl: string }>) {
      map[o.style.toUpperCase()] = o.imageUrl;
    }
    return map;
  }, [imageOverrides]);

  // Merge custom SKUs into rawSkus — same shape as skuData.rawSkus entries
  const mergedRawSkus = useMemo(() => {
    if (customSkus.length === 0) return skuData.rawSkus;

    const extra = customSkus.map((c) => ({
      style: c.style as string,
      colour: c.colour as string,
      leather: c.leather as string,
      // Respect the isNew flag from DB — existing carry-overs are not new
      is_new: (c.isNew ?? true) as boolean,
      _customId: c.id,
    }));

    // Deduplicate: don't add if already in static data
    const existing = new Set(skuData.rawSkus.map((s) => `${s.style}|${s.colour}|${s.leather}`));
    const filtered = extra.filter((e) => !existing.has(`${e.style}|${e.colour}|${e.leather}`));

    return [...(skuData.rawSkus as unknown as typeof extra), ...filtered];
  }, [customSkus]);

  // Merge custom SKUs into styles — update colours/leathers arrays
  const mergedStyles = useMemo(() => {
    if (customSkus.length === 0) return skuData.styles;

    // Build a map of style -> extra {colour, leather, isNew} pairs
    const extras: Record<string, Array<{ colour: string; leather: string; isNew: boolean }>> = {};
    for (const c of customSkus) {
      if (!extras[c.style]) extras[c.style] = [];
      extras[c.style].push({ colour: c.colour, leather: c.leather, isNew: c.isNew ?? true });
    }

    return skuData.styles.map((s) => {
      const extra = extras[s.style];
      // Apply DB image override if present
      const overrideUrl = imageOverrideMap[s.style.toUpperCase()];
      if (!extra || extra.length === 0) {
        return overrideUrl ? { ...s, imageUrl: overrideUrl } : s;
      }

      const existingColours = new Set(s.colours);
      const existingLeathers = new Set(s.leathers);

      const newColours = Array.from(new Set(extra.map((e) => e.colour).filter((c) => !existingColours.has(c as any)))) as any[];
      const newLeathers = Array.from(new Set(extra.map((e) => e.leather).filter((l) => l && !existingLeathers.has(l as any)))) as any[];

      // Only count truly new custom SKUs toward newSKUs
      const newCount = extra.filter((e) => e.isNew).length;

      return {
        ...s,
        ...(overrideUrl ? { imageUrl: overrideUrl } : {}),
        colours: [...s.colours, ...newColours],
        leathers: [...s.leathers, ...newLeathers],
        totalSKUs: s.totalSKUs + extra.length,
        newSKUs: s.newSKUs + newCount,
        hasNew: s.hasNew || newCount > 0,
      };
    });
  }, [customSkus, imageOverrideMap]);

  return {
    customSkus: customSkus as CustomSkuRow[],
    mergedRawSkus,
    mergedStyles,
    isLoading,
    refetch,
    refetchImageOverrides,
  };
}
