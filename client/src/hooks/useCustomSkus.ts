import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useMemo } from "react";
import { useSeason } from "@/contexts/SeasonContext";
import { buildMarkdownSkuSet, isMarkdownSku } from "@shared/markdownSku";

export type CustomSkuRow = {
  id: number;
  style: string;
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
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
  const { season } = useSeason();

  const { data: customSkus = [], isLoading, refetch } = trpc.customSku.getAll.useQuery({ season }, {
    staleTime: 30_000,
  });

  // Markdown SKUs are a global, reversible exclusion list. A deleted record
  // must be removed before every tab builds its range data, not only from the
  // By Style table, so it stays hidden in both SS26 and W27 everywhere.
  const { data: markdownSkuList = [] } = trpc.markdown.list.useQuery({}, {
    staleTime: 60_000,
  });

  const markdownSkuSet = useMemo(
    () => buildMarkdownSkuSet(markdownSkuList as Array<{ styleCode: string; colour: string; status: string }>),
    [markdownSkuList],
  );

  // Fetch DB image overrides so they take precedence over static CDN URLs everywhere
  const { data: imageOverrides = [], refetch: refetchImageOverrides } = trpc.styleImage.getAll.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Fetch new/existing overrides set via the AI assistant
  const { data: skuNewOverrides = [] } = trpc.skuNewOverride.getAll.useQuery(undefined, {
    staleTime: 30_000,
  });

  // Fetch custom styles (brand-new styles added manually, not in static skuData)
  const { data: customStyleRows = [], refetch: refetchCustomStyles } = trpc.customStyle.getAll.useQuery({ season }, {
    staleTime: 30_000,
  });

  // Fetch website images scraped from tonybianco.com.au (used as fallback when no manual override)
  const { data: websiteImages = [] } = trpc.style.getImages.useQuery(undefined, {
    staleTime: 120_000,
  });

  const websiteImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of websiteImages as Array<{ style: string; websiteImageUrl: string | null }>) {
      if (o.websiteImageUrl) map[o.style.toUpperCase()] = o.websiteImageUrl;
    }
    return map;
  }, [websiteImages]);

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
  const mergedRawSkus = useMemo<Array<{ style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null; is_new: boolean; _customId?: number }>>(() => {
    // Apply overrides to static SKUs
    // For W27 (and any non-SS26 season), all static SKUs are carry-overs — force is_new=false
    const baseSkus = (skuData.rawSkus as unknown as ReadonlyArray<{ style: string; colour: string; leather: string; is_new: boolean }>)
      .filter((sku) => !isMarkdownSku(markdownSkuSet, sku.style, sku.colour, sku.leather ?? ""))
      .map((sku) => {
      const staticIsNew = season === "SS26" ? sku.is_new : false;
      const effectiveIsNew = resolveIsNew(sku.style, sku.colour, sku.leather ?? "", staticIsNew);
      if (effectiveIsNew === sku.is_new) return sku;
      return { ...sku, is_new: effectiveIsNew };
    });

    if (customSkus.length === 0) return baseSkus;

    const extra = customSkus
      .filter((c) => !isMarkdownSku(markdownSkuSet, c.style, c.colour, c.leather ?? ""))
      .map((c) => ({
      style: c.style as string,
      colour: c.colour as string,
      leather: c.leather as string,
      colour2: (c as any).colour2 as string | null | undefined,
      leather2: (c as any).leather2 as string | null | undefined,
      is_new: resolveIsNew(c.style, c.colour, c.leather ?? "", (c.isNew ?? true) as boolean),
      _customId: c.id,
    }));

    // Deduplicate: don't add if already in static data
    const existing = new Set(baseSkus.map((s) => `${s.style}|${s.colour}|${s.leather}`));
    const filtered = extra.filter((e) => !existing.has(`${e.style}|${e.colour}|${e.leather}`));

    return [...baseSkus, ...filtered];
  }, [customSkus, markdownSkuSet, season, skuNewOverrideMap]);

  const activeSkusByStyle = useMemo(() => {
    const groups: Record<string, Array<{ style: string; colour: string; leather: string; is_new: boolean }>> = {};
    for (const sku of mergedRawSkus as Array<{ style: string; colour: string; leather: string; is_new: boolean }>) {
      if (!groups[sku.style]) groups[sku.style] = [];
      groups[sku.style].push(sku);
    }
    return groups;
  }, [mergedRawSkus]);

  // Merge custom SKUs into styles — update colours/leathers arrays
  const mergedStyles = useMemo<any[]>(() => {
    // Build static style entries from the active SKU set. This removes a style
    // entirely when every one of its SKUs has been marked down.
    const staticStyles = skuData.styles.map((s) => {
      const activeSkus = activeSkusByStyle[s.style] ?? [];
      if (activeSkus.length === 0) return null;
      // Priority: manual upload override > Tony Bianco website image > static CDN URL
      const overrideUrl = imageOverrideMap[s.style.toUpperCase()] ?? websiteImageMap[s.style.toUpperCase()];

      const totalNewSKUs = activeSkus.filter((sku) => sku.is_new).length;
      const totalSKUs = activeSkus.length;
      const activeColours = Array.from(new Set(activeSkus.map((sku) => sku.colour))) as any[];
      const activeLeathers = Array.from(new Set(activeSkus.map((sku) => sku.leather).filter(Boolean))) as any[];

      return {
        ...s,
        ...(overrideUrl ? { imageUrl: overrideUrl } : {}),
        colours: activeColours,
        leathers: activeLeathers,
        totalSKUs,
        newSKUs: totalNewSKUs,
        hasNew: totalNewSKUs > 0,
        isAllNew: totalNewSKUs === totalSKUs && totalSKUs > 0,
      };
    }).filter((style): style is NonNullable<typeof style> => style !== null);

    // Synthetic style entries for custom styles (brand-new, not in static data)
    const staticStyleNames = new Set(skuData.styles.map((s) => s.style.toUpperCase()));
    const syntheticStyles = (customStyleRows as Array<{ id: number; style: string; lastName: string; category: string | null; createdAt: Date }>)
      .filter((cs) => !staticStyleNames.has(cs.style.toUpperCase()))
      .map((cs) => {
        // Priority: manual upload override > Tony Bianco website image
        const overrideUrl = imageOverrideMap[cs.style.toUpperCase()] ?? websiteImageMap[cs.style.toUpperCase()];
        const activeSkus = activeSkusByStyle[cs.style] ?? [];
        if (activeSkus.length === 0) return null;
        const customNewCount = activeSkus.filter((sku) => sku.is_new).length;
        const totalSKUs = activeSkus.length;
        return {
          style: cs.style,
          last: cs.lastName,
          category: cs.category ?? "",
          colours: Array.from(new Set(activeSkus.map((sku) => sku.colour))) as any[],
          leathers: Array.from(new Set(activeSkus.map((sku) => sku.leather).filter(Boolean))) as any[],
          totalSKUs,
          newSKUs: customNewCount,
          existingSKUs: totalSKUs - customNewCount,
          hasNew: customNewCount > 0,
          isAllNew: customNewCount === totalSKUs && totalSKUs > 0,
          imageUrl: overrideUrl ?? undefined,
          _isCustomStyle: true,
        };
      }).filter((style): style is NonNullable<typeof style> => style !== null);

    return [...staticStyles, ...syntheticStyles];
  }, [activeSkusByStyle, customStyleRows, imageOverrideMap, websiteImageMap]);

  return {
    customSkus: customSkus as CustomSkuRow[],
    customStyleRows: customStyleRows as Array<{ id: number; style: string; lastName: string; category: string | null; createdAt: Date }>,
    mergedRawSkus,
    mergedStyles,
    isLoading,
    refetch,
    refetchImageOverrides,
    refetchCustomStyles,
  };
}
