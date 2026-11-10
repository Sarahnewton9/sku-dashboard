import { getSpecColourKeyCandidates, normalizeSpecColourPart } from "./specColourKey";
import type { CrossStyleCustomRowCopy } from "./specCrossStyleCopy";
import { getCustomSpecRowAliases, getOrderedSpecRowKeys, groupSpecCustomRows } from "./specRowLayout";
import type { SpecComponent } from "./specTemplates";

export type SavedSpecCopyTimestamp = Date | string | number | null;

/** Structural types accept database rows without importing server/schema code. */
export type SavedSpecCopySpecRow = {
  id: number;
  colour: string;
  component: string;
  value: string | null;
  updatedAt?: SavedSpecCopyTimestamp;
};

export type SavedSpecCopyCustomRow = {
  id: number;
  colour: string;
  section: string;
  title: string;
  value: string | null;
  sortOrder: number;
  updatedAt?: SavedSpecCopyTimestamp;
};

export type SavedSpecCopySnapshotInput = {
  /** Rows must already be scoped to the selected source style's shared library. */
  specRows: readonly SavedSpecCopySpecRow[];
  /** The source template, including its saved optional-component settings. */
  template: readonly SpecComponent[];
  customRows: readonly SavedSpecCopyCustomRow[];
  rowKeys?: readonly string[] | null;
  sourceColourLabel: string;
  sourceRawColour?: string;
};

/** Source identities in saved visual order; destination keys may be different. */
export type SavedSpecCopySourceRow =
  | { kind: "component"; rowKey: string; component: string }
  | { kind: "custom"; rowKey: string; section: string; title: string; representativeId: number };

export type SavedSpecCopySnapshot = {
  components: Record<string, string>;
  customRows: CrossStyleCustomRowCopy[];
  sourceRows: SavedSpecCopySourceRow[];
};

function timestamp(value: SavedSpecCopyTimestamp | undefined): number {
  const result = value instanceof Date
    ? value.getTime()
    : typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : 0;
  return Number.isFinite(result) ? result : 0;
}

function isNewer(
  row: { id: number; updatedAt?: SavedSpecCopyTimestamp },
  previous: { id: number; updatedAt?: SavedSpecCopyTimestamp },
): boolean {
  const difference = timestamp(row.updatedAt) - timestamp(previous.updatedAt);
  return difference > 0 || (difference === 0 && row.id > previous.id);
}

function canonicalRowKey(key: string): string {
  // The editor writes t:/c:. Accept the older documented spellings as well.
  const deleted = key.startsWith("deleted:");
  const inner = deleted ? key.slice("deleted:".length) : key;
  const canonical = inner.startsWith("template:")
    ? `t:${inner.slice("template:".length)}`
    : inner.startsWith("custom:")
      ? `c:${inner.slice("custom:".length)}`
      : inner;
  return deleted ? `deleted:${canonical}` : canonical;
}

/**
 * Copy the saved visible source specification, never its historical value bag.
 *
 * The shared layout projection makes explicit tombstones win over live entries
 * for both template rows and every member of a custom group. Following the
 * editor convention, unrecorded new template/custom rows are appended. Empty
 * saved cells are meaningful: exact values (including whitespace and blank/null)
 * win over less-specific colour keys and __all__. Neither another SKU's values
 * nor orphan component IDs are promoted. Upper 1 belongs to the target SKU.
 *
 * This is a source-only projection: it does not clear unrelated target rows,
 * mutate data, choose a destination template, or read optimistic client drafts.
 * The returned sourceRows supplies the interleaved saved order for remapping;
 * custom sortOrder remains the source representative's saved value.
 */
export function buildSavedSpecCopySnapshot(input: SavedSpecCopySnapshotInput): SavedSpecCopySnapshot {
  const candidates = getSpecColourKeyCandidates(input.sourceColourLabel, input.sourceRawColour)
    .map(normalizeSpecColourPart);
  const candidateSet = new Set(candidates);
  const templateByKey = new Map(input.template.map((component) => [component.key, component]));

  // Choose the latest duplicate only within the same component + colour key.
  // Resolve colour specificity per cell afterwards, so an explicit blank wins.
  const componentCells = new Map<string, Map<string, SavedSpecCopySpecRow>>();
  for (const row of input.specRows) {
    if (row.component === "upper_1" || !templateByKey.has(row.component)) continue;
    const colour = normalizeSpecColourPart(row.colour);
    if (!candidateSet.has(colour)) continue;
    const cells = componentCells.get(row.component) ?? new Map<string, SavedSpecCopySpecRow>();
    const previous = cells.get(colour);
    if (!previous || isNewer(row, previous)) cells.set(colour, row);
    componentCells.set(row.component, cells);
  }

  const customGroups = groupSpecCustomRows(input.customRows.filter((row) => row.title.trim().length > 0));
  const aliases = getCustomSpecRowAliases(customGroups);
  const customByRowKey = new Map(customGroups.map((group) => [`c:${group.rep.id}`, group]));
  const available = [
    ...input.template.filter((component) => component.key !== "upper_1").map((component) => `t:${component.key}`),
    ...customGroups.map((group) => `c:${group.rep.id}`),
  ];
  const orderedKeys = getOrderedSpecRowKeys(available, input.rowKeys?.map(canonicalRowKey), aliases);
  const components: Record<string, string> = {};
  const customRows: CrossStyleCustomRowCopy[] = [];
  const sourceRows: SavedSpecCopySourceRow[] = [];

  for (const rowKey of orderedKeys) {
    if (rowKey.startsWith("t:")) {
      const component = rowKey.slice(2);
      const cells = componentCells.get(component);
      const savedRow = candidates.map((colour) => cells?.get(colour)).find((row) => row !== undefined);
      components[component] = savedRow?.value ?? "";
      sourceRows.push({ kind: "component", rowKey, component });
      continue;
    }
    const group = customByRowKey.get(rowKey);
    if (!group) continue;
    // Layout grouping chooses the stable lowest ID representative. Value
    // resolution deliberately chooses the latest row rather than its colourMap's
    // last ID, preserving newer saved values in historical duplicate records.
    const cells = new Map<string, SavedSpecCopyCustomRow>();
    for (const row of group.rows) {
      const colour = normalizeSpecColourPart(row.colour);
      if (colour !== "__ALL__" && !candidateSet.has(colour)) continue;
      const previous = cells.get(colour);
      if (!previous || isNewer(row, previous)) cells.set(colour, row);
    }
    const savedRow = candidates.map((colour) => cells.get(colour)).find((row) => row !== undefined)
      ?? cells.get("__ALL__");
    customRows.push({
      section: group.rep.section,
      title: group.rep.title,
      value: savedRow?.value ?? "",
      sortOrder: group.rep.sortOrder,
    });
    sourceRows.push({
      kind: "custom",
      rowKey,
      section: group.rep.section,
      title: group.rep.title,
      representativeId: group.rep.id,
    });
  }

  return { components, customRows, sourceRows };
}
