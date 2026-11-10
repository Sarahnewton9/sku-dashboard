/** Shared by Specs rendering, row actions and factory exports. */
export type SpecLayoutCustomRow = { id: number; section: string; title: string; colour: string; sortOrder: number };
export type SpecCustomRowGroup<T extends SpecLayoutCustomRow> = { rep: T; rows: T[]; colourMap: Map<string, T> };

export function groupSpecCustomRows<T extends SpecLayoutCustomRow>(rows: readonly T[]): SpecCustomRowGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    // Unnamed rows are separate editable placeholders, not one combined group.
    const title = row.title.trim().replace(/\s+/g, " ").toUpperCase();
    const key = title ? `${row.section}\u0000${title}` : `unnamed:${row.id}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return Array.from(groups.values()).map((members) => ({
    rep: members[0], rows: members,
    colourMap: new Map(members.map((row) => [row.colour, row])),
  })).sort((a, b) => a.rep.sortOrder - b.rep.sortOrder || a.rep.id - b.rep.id);
}

export function getCustomSpecRowAliases<T extends SpecLayoutCustomRow>(groups: readonly SpecCustomRowGroup<T>[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const group of groups) for (const row of group.rows) aliases.set(`c:${row.id}`, `c:${group.rep.id}`);
  return aliases;
}

export function normalizeSpecRowLayout(keys: readonly string[], aliases: ReadonlyMap<string, string> = new Map()): string[] {
  const canonical = keys.map((key) => {
    const deleted = key.startsWith("deleted:");
    const stored = deleted ? key.slice(8) : key;
    const inner = stored.replace(/^template:/, "t:").replace(/^custom:/, "c:");
    const resolved = aliases.get(inner) ?? inner;
    return deleted && resolved !== "t:upper_1" ? `deleted:${resolved}` : resolved;
  });
  const hidden = new Set(canonical.filter((key) => key.startsWith("deleted:")).map((key) => key.slice(8)));
  const used = new Set<string>();
  return canonical.filter((key) => {
    const inner = key.startsWith("deleted:") ? key.slice(8) : key;
    if ((!key.startsWith("deleted:") && hidden.has(inner)) || used.has(inner)) return false;
    used.add(inner);
    return true;
  });
}

/** Saved hidden rows always win, including when the same ID also occurs live. */
export function getOrderedSpecRowKeys(available: readonly string[], saved?: readonly string[] | null, aliases?: ReadonlyMap<string, string>): string[] {
  const layout = normalizeSpecRowLayout(saved ?? [], aliases);
  const hidden = new Set(layout.filter((key) => key.startsWith("deleted:")).map((key) => key.slice(8)));
  const availableSet = new Set(available);
  const placed = new Set<string>();
  const ordered: string[] = [];
  for (const key of [...layout, ...available]) {
    if (key.startsWith("deleted:") || hidden.has(key) || !availableSet.has(key) || placed.has(key)) continue;
    placed.add(key);
    ordered.push(key);
  }
  return availableSet.has("t:upper_1") ? ["t:upper_1", ...ordered.filter((key) => key !== "t:upper_1")] : ordered;
}

/** Save/drag must retain deletions that aren't part of the rendered row list. */
export function mergeSpecRowOrder(ordered: readonly string[], saved?: readonly string[] | null): string[] {
  return normalizeSpecRowLayout([...ordered, ...(saved ?? []).filter((key) => key.startsWith("deleted:"))]);
}

/** Works for new template/custom rows which have not been saved in the layout yet. */
export function hideSpecRow(keys: readonly string[], rowKey: string): string[] {
  if (rowKey === "t:upper_1") return normalizeSpecRowLayout(keys);
  const marker = `deleted:${rowKey}`;
  const found = keys.some((key) => key === rowKey || key === marker);
  return normalizeSpecRowLayout(found ? keys.map((key) => key === rowKey ? marker : key) : [...keys, marker]);
}

export function restoreSpecRow(keys: readonly string[], rowKey: string): string[] {
  return normalizeSpecRowLayout(keys.map((key) => key === `deleted:${rowKey}` ? rowKey : key));
}

/** Temporary IDs and shared-row explosions must also remap hidden IDs. */
export function replaceSpecRowKey(keys: readonly string[], oldKey: string, newKey: string): string[] {
  return normalizeSpecRowLayout(keys.map((key) => key === oldKey ? newKey : key === `deleted:${oldKey}` ? `deleted:${newKey}` : key));
}

/** Never let an earlier drag/delete/add request overwrite a later layout save. */
export function createSpecRowSaveQueue() {
  const tails = new Map<string, Promise<unknown>>();
  return function enqueue<T>(style: string, save: () => Promise<T>): Promise<T> {
    const key = style.trim().toUpperCase();
    const previous = tails.get(key) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(save);
    tails.set(key, result);
    const cleanup = () => { if (tails.get(key) === result) tails.delete(key); };
    result.then(cleanup, cleanup);
    return result;
  };
}

export const enqueueSpecRowSave = createSpecRowSaveQueue();
