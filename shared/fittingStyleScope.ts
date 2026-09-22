type StyleParent = { style: string };

function normalizedStyle(style: string): string {
  return style.trim().toUpperCase();
}

/**
 * W27 fittings are for new patterns only. A W27 custom parent that also exists
 * in SS26 is a carry-over and therefore does not enter the new fitting queue.
 */
export function getW27NewPatternStyleNames(
  w27StyleParents: readonly StyleParent[],
  ss26StyleParents: readonly StyleParent[],
): Set<string> {
  const ss26Styles = new Set(ss26StyleParents.map((parent) => normalizedStyle(parent.style)));
  return new Set(
    w27StyleParents
      .map((parent) => normalizedStyle(parent.style))
      .filter((style) => style.length > 0 && !ss26Styles.has(style)),
  );
}

export function isEligibleFittingStyle(
  season: string,
  style: string,
  isCustomStyle: boolean,
  w27NewPatternStyleNames: ReadonlySet<string>,
): boolean {
  if (season !== "W27") return true;
  if (!isCustomStyle) return false;
  return w27NewPatternStyleNames.has(normalizedStyle(style));
}
