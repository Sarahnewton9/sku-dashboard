import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useMemo } from "react";

export type CustomSkuRow = {
  id: number;
  style: string;
  colour: string;
  leather: string;
  createdAt: Date;
};

/**
 * Fetches custom SKUs from the DB and merges them with the static skuData.
 *
 * Custom SKUs are always treated as new (is_new = true).
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

  // Merge custom SKUs into rawSkus — same shape as skuData.rawSkus entries
  const mergedRawSkus = useMemo(() => {
    if (customSkus.length === 0) return skuData.rawSkus;

    const extra = customSkus.map((c) => ({
      style: c.style as string,
      colour: c.colour as string,
      leather: c.leather as string,
      is_new: true as const,
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

    // Build a map of style -> extra {colour, leather} pairs
    const extras: Record<string, Array<{ colour: string; leather: string }>> = {};
    for (const c of customSkus) {
      if (!extras[c.style]) extras[c.style] = [];
      extras[c.style].push({ colour: c.colour, leather: c.leather });
    }

    return skuData.styles.map((s) => {
      const extra = extras[s.style];
      if (!extra || extra.length === 0) return s;

      const existingColours = new Set(s.colours);
      const existingLeathers = new Set(s.leathers);

      const newColours = extra.map((e) => e.colour).filter((c) => !existingColours.has(c as any)) as any[];
      const newLeathers = extra.map((e) => e.leather).filter((l) => l && !existingLeathers.has(l as any)) as any[];

      return {
        ...s,
        colours: [...s.colours, ...newColours],
        leathers: [...s.leathers, ...newLeathers],
        totalSKUs: s.totalSKUs + extra.length,
        newSKUs: s.newSKUs + extra.length,
        hasNew: true,
      };
    });
  }, [customSkus]);

  return {
    customSkus: customSkus as CustomSkuRow[],
    mergedRawSkus,
    mergedStyles,
    isLoading,
    refetch,
  };
}
