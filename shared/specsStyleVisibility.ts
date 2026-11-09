export function shouldIncludeStyleInSpecs(input: {
  isOnNewLast: boolean;
  hasNewColours: boolean;
}): boolean {
  return input.isOnNewLast || input.hasNewColours;
}

export function selectSpecColourColumns(input: {
  activeColours: readonly string[];
  newColours: readonly string[];
}): string[] {
  return input.newColours.length > 0 ? [...input.newColours] : [...input.activeColours];
}

/** SKU cancellations have already been resolved by useCustomSkus using leather
 * and both uppers. Never turn a missing cancelled SKU into a bare-colour key:
 * cancelling BLACK SUPRA must not hide the remaining BLACK NAPPA column. */
export function excludeCancelledSpecStyles<T extends { style: string }>(
  activeStyles: readonly T[],
  cancelledStyles: ReadonlySet<string>,
): T[] {
  return activeStyles.filter((style) => !cancelledStyles.has(style.style));
}
