import { getSpecColourKeyCandidates, normalizeSpecColourPart } from "./specColourKey";
import { groupSpecCustomRows } from "./specRowLayout";
import { formatSkuExportLabel } from "./skuExportLabel";
import type { BuySkuIdentity } from "./buySkuRename";
import type { SavedSpecCopySpecRow, SavedSpecCopyCustomRow } from "./specCopySnapshot";

export function physicalSkuSpecLabel(sku: BuySkuIdentity): string {
  return normalizeSpecColourPart(formatSkuExportLabel(sku));
}

export function savedCellTime(row: { updatedAt?: Date | string | number | null }): number {
  const value = row.updatedAt;
  const time = value instanceof Date ? value.getTime() : typeof value === "number" ? value : value ? Date.parse(value) : 0;
  return Number.isFinite(time) ? time : 0;
}

export function newestSavedCell<T extends { id: number; updatedAt?: Date | string | number | null }>(rows: readonly T[]): T | undefined {
  return rows.reduce<T | undefined>((latest, row) => !latest || savedCellTime(row) > savedCellTime(latest)
    || (savedCellTime(row) === savedCellTime(latest) && row.id > latest.id) ? row : latest, undefined);
}

/** Identity corrections are not copy/reset: only genuinely saved effective cells
 * are materialized. Source keys, shared rows, layout and representative IDs stay.
 * Include hidden/optional saved components as well as the current template. */
export function snapshotSkuIdentitySpecs(input: {
  previous: BuySkuIdentity;
  next: BuySkuIdentity;
  specRows: readonly SavedSpecCopySpecRow[];
  customRows: readonly SavedSpecCopyCustomRow[];
}) {
  const oldLabel = physicalSkuSpecLabel(input.previous);
  const newLabel = physicalSkuSpecLabel(input.next);
  const candidates = getSpecColourKeyCandidates(oldLabel, input.previous.colour);
  const resolve = <T extends { id: number; colour: string; updatedAt?: Date | string | number | null }>(rows: readonly T[], shared = false) => {
    for (const key of [...candidates, ...(shared ? ["__ALL__"] : [])]) {
      const row = newestSavedCell(rows.filter(row => normalizeSpecColourPart(row.colour) === key));
      if (row) return row;
    }
    return undefined;
  };
  const components: Array<{ component: string; value: string | null }> = [];
  for (const component of Array.from(new Set(input.specRows.map(row => row.component)))) {
    const source = resolve(input.specRows.filter(row => row.component === component));
    if (!source) continue;
    components.push({ component, value: component === "upper_1" && source.value === oldLabel ? newLabel : source.value });
  }
  const customCells = groupSpecCustomRows(input.customRows).flatMap(group => {
    const source = resolve(group.rows, true);
    if (!source) return [];
    // A nameless placeholder has no logical group to attach a new cell to.
    if (!group.rep.title.trim()) return [];
    return [{ representativeId: group.rep.id, section: group.rep.section, title: group.rep.title,
      sortOrder: group.rep.sortOrder, value: source.value, targetId: newestSavedCell(group.rows.filter(row => normalizeSpecColourPart(row.colour) === newLabel))?.id }];
  });
  return { oldLabel, newLabel, components, customCells };
}
