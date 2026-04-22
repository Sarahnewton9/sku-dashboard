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

  const isReady = subCategories.length > 0 || trendFlags.length > 0;

  return { getCategory, getTrendFlag, subCategoryMap, trendFlagMap, isReady };
}
