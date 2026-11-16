export function getBuySessionSelectionState(
  availableIds: readonly number[],
  selectedIds: readonly number[],
): false | true | "indeterminate" {
  const available = Array.from(new Set(availableIds));
  if (available.length === 0) return false;
  const selected = new Set(selectedIds);
  const selectedCount = available.filter(id => selected.has(id)).length;
  if (selectedCount === 0) return false;
  return selectedCount === available.length ? true : "indeterminate";
}

export function toggleAllBuySessionIds(
  availableIds: readonly number[],
  selectedIds: readonly number[],
): number[] {
  const available = Array.from(new Set(availableIds));
  return getBuySessionSelectionState(available, selectedIds) === true ? [] : available;
}

export function toggleBuySessionId(selectedIds: readonly number[], id: number): number[] {
  return selectedIds.includes(id)
    ? selectedIds.filter(selectedId => selectedId !== id)
    : [...Array.from(new Set(selectedIds)), id];
}
