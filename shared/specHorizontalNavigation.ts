export type HorizontalScrollMetrics = {
  position: number;
  maxPosition: number;
  isScrollable: boolean;
};

export function getHorizontalScrollMetrics(
  scrollWidth: number,
  clientWidth: number,
  scrollLeft: number,
): HorizontalScrollMetrics {
  const maxPosition = Math.max(0, scrollWidth - clientWidth);
  return {
    position: Math.min(Math.max(0, scrollLeft), maxPosition),
    maxPosition,
    isScrollable: maxPosition > 1,
  };
}

export function getHorizontalScrollTarget(
  currentPosition: number,
  clientWidth: number,
  maxPosition: number,
  direction: "left" | "right",
): number {
  const distance = Math.max(240, Math.round(clientWidth * 0.8));
  const nextPosition = direction === "left"
    ? currentPosition - distance
    : currentPosition + distance;
  return Math.min(Math.max(0, nextPosition), maxPosition);
}
