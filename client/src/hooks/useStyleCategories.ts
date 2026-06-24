import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Provides resolved category and trend flag for each style.
 *
 * - Ballet Flat / Loafer styles → category becomes "CASUAL FLAT", trendFlag is set
 * - Wedge / Boot styles → category becomes their sub-category (e.g. "CASUAL WEDGE")
 * - All other styles → category unchanged from skuData
 */
export function useStyleCategories() {
  const { data: subCategories = [] } = trpc.styleSubCategory.getAll.useQuery();
  const { data: trendFlags = [] } = trpc.trendFlag.getAll.useQuery();

  const subCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of subCategories) {
      map.set(row.style.toUpperCase(), row.subCategory.toUpperCase());
    }
    return map;
  }, [subCategories]);

  const trendFlagMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of trendFlags) {
      map.set(row.style.toUpperCase(), row.trendFlag);
    }
    return map;
  }, [trendFlags]);

  // Map of style → trends array (e.g. ["BALLET", "MESH"])
  const trendsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of trendFlags) {
      const t = (row as any).trends;
      const arr: string[] = Array.isArray(t) && t.length > 0 ? t : row.trendFlag ? [row.trendFlag] : [];
      if (arr.length > 0) map.set(row.style.toUpperCase(), arr);
    }
    return map;
  }, [trendFlags]);

  // All unique trend values present in the DB
  const allTrends = useMemo(() => {
    const set = new Set<string>();
    for (const arr of Array.from(trendsMap.values())) for (const t of arr) set.add(t);
    return Array.from(set).sort();
  }, [trendsMap]);

  /**
   * Returns the resolved category for a style.
   * Falls back to the static category if no override exists.
   */
  function getCategory(style: string, staticCategory: string): string {
    return subCategoryMap.get(style.toUpperCase()) ?? staticCategory.toUpperCase();
  }

  /**
   * Returns the trend flag for a style (e.g. "Ballet Flat", "Loafer"), or null.
   */
  function getTrendFlag(style: string): string | null {
    return trendFlagMap.get(style.toUpperCase()) ?? null;
  }

  /**
   * Returns the full trends array for a style (e.g. ["BALLET", "MESH"]), or [].
   */
  function getTrends(style: string): string[] {
    return trendsMap.get(style.toUpperCase()) ?? [];
  }

  const isReady = subCategories.length > 0 || trendFlags.length > 0;

  return { getCategory, getTrendFlag, getTrends, allTrends, subCategoryMap, trendFlagMap, trendsMap, isReady };
}
