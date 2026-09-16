import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import { useSeason } from "@/contexts/SeasonContext";

/**
 * Returns a Set of cancelled style names and tRPC utils for invalidating the cache.
 * Components can filter their data with: skus.filter(s => !cancelledSet.has(s.style))
 */
export function useCancelledStyles() {
  const { season } = useSeason();
  const { data, isLoading } = trpc.styles.listCancelled.useQuery({ season }, {
    staleTime: 30_000,
  });

  const cancelledSet = useMemo(
    () => new Set((data ?? []).map((r) => r.style)),
    [data]
  );

  return { cancelledSet, isLoading, raw: data ?? [] };
}
