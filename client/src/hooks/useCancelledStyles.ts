import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

/**
 * Returns a Set of cancelled style names and tRPC utils for invalidating the cache.
 * Components can filter their data with: skus.filter(s => !cancelledSet.has(s.style))
 */
export function useCancelledStyles(season: "SS26" | "W27") {
  const { data, isLoading } = trpc.styles.listCancelled.useQuery({ season }, {
    staleTime: 30_000,
  });

  const cancelledSet = useMemo(
    () => new Set((data ?? []).map((r) => r.style)),
    [data]
  );

  return { cancelledSet, isLoading, raw: data ?? [] };
}
