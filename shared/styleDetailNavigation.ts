export type StyleNavigationDirection = "previous" | "next";

/**
 * Returns the adjacent visible style without wrapping across the first or last
 * style. The caller provides the current filtered/sorted list so the drawer
 * stays in sync with the By Style view.
 */
export function getAdjacentStyle(
  visibleStyles: readonly string[],
  currentStyle: string,
  direction: StyleNavigationDirection,
): string | null {
  const currentIndex = visibleStyles.indexOf(currentStyle);
  if (currentIndex < 0) return null;

  const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
  return visibleStyles[nextIndex] ?? null;
}
