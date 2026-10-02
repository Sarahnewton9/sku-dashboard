/**
 * Size 11 is an all-colourway property in SKU Dash.
 * A style is included only when every active colourway is explicitly confirmed.
 */
export function hasSize11ForAllColourways<T>(
  colourways: readonly T[],
  isSize11: (colourway: T) => boolean,
): boolean {
  return colourways.length > 0 && colourways.every(isSize11);
}
