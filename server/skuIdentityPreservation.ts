import { and, eq } from "drizzle-orm";
import { skuMeta, customSkus, styleSpecs, specCustomRows, cancelledSkus, cancelledStyles } from "../drizzle/schema";
import { skuData } from "../client/src/lib/skuData";
import { getSkuCompositeIdentity, normalizeSkuIdentityPart } from "../shared/skuCompositeIdentity";
import { buildCancelledSkuKeySet, isCancelledSku } from "../shared/cancelledSkuIdentity";
import { newestSavedCell, savedCellTime, snapshotSkuIdentitySpecs } from "../shared/skuIdentitySpecPreservation";
import type { BuySkuIdentity } from "../shared/buySkuRename";
import type { getDb } from "./db";

type Connection = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type IdentityDbScope = Pick<Connection, "select" | "insert" | "update" | "delete">;
export const identityKey = (sku: BuySkuIdentity) => getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2);
const primaryKey = (sku: BuySkuIdentity) => getSkuCompositeIdentity(sku.style, sku.colour, sku.leather);
const rawSkus: readonly BuySkuIdentity[] = skuData.rawSkus;

export async function loadStyleIdentities(db: IdentityDbScope, style: string) {
  const meta = await db.select().from(skuMeta).where(eq(skuMeta.style, style)).for("update");
  const custom = await db.select().from(customSkus).where(eq(customSkus.style, style)).for("update");
  const raw = rawSkus.filter(row => normalizeSkuIdentityPart(row.style) === normalizeSkuIdentityPart(style));
  return { meta, custom, raw };
}
type Library = Awaited<ReturnType<typeof loadStyleIdentities>>;

function effectiveIdentity(raw: BuySkuIdentity, meta?: Library["meta"][number]): BuySkuIdentity {
  return { ...raw, colour: meta?.colourOverride || raw.colour, leather: meta?.leatherOverride || raw.leather,
    colour2: meta?.colour2 ?? raw.colour2, leather2: meta?.leather2 ?? raw.leather2 };
}

/** Fail closed when a primary-only edit cannot identify one physical source. */
export function selectStaticIdentity(library: Library, data: BuySkuIdentity & { sourceColour2?: string | null; sourceLeather2?: string | null }) {
  const meta = library.meta.filter(row => primaryKey(row) === primaryKey(data));
  const raw = library.raw.filter(row => primaryKey(row) === primaryKey(data));
  const rawUnique = Array.from(new Map(raw.map(row => [identityKey(row), row])).values());
  const options = meta.length ? meta.map(row => ({ metadata: row,
    previous: effectiveIdentity(rawUnique.length === 1 ? rawUnique[0] : row, row) }))
    : rawUnique.map(row => ({ metadata: undefined, previous: row }));
  const hasSelector = data.sourceColour2 !== undefined && data.sourceLeather2 !== undefined;
  const selected = hasSelector ? options.filter(option => normalizeSkuIdentityPart(option.previous.colour2) === normalizeSkuIdentityPart(data.sourceColour2)
    && normalizeSkuIdentityPart(option.previous.leather2) === normalizeSkuIdentityPart(data.sourceLeather2)) : options;
  const identities = new Set(selected.map(option => identityKey(option.previous)));
  if (identities.size > 1 || (!hasSelector && rawUnique.length > 1)) throw new Error("Ambiguous SKU identity: select the original Upper 2");
  if (selected.length > 1) throw new Error("Ambiguous duplicate SKU metadata: select one physical source");
  if (selected[0]) return selected[0];
  if (options.length) throw new Error("Original physical SKU not found");
  // Metadata may precede a static range entry. An explicit source selector is
  // authoritative; otherwise only the supplied primary identity is known.
  return { metadata: undefined, previous: { style: data.style, colour: data.colour, leather: data.leather,
    colour2: data.sourceColour2 ?? "", leather2: data.sourceLeather2 ?? "" } };
}

export async function rejectActiveIdentityCollision(db: IdentityDbScope, library: Library, next: BuySkuIdentity, options: {
  season?: string; excludedCustomIds?: number[]; sourceMetaId?: number; originalStatic?: BuySkuIdentity;
}) {
  const cancellations = await db.select().from(cancelledSkus).where(eq(cancelledSkus.style, next.style));
  const styleCancellations = await db.select().from(cancelledStyles).where(eq(cancelledStyles.style, next.style));
  const active = (identity: BuySkuIdentity, season?: string) => (season ? [season] : ["SS26", "W27"]).some(selectedSeason =>
    !styleCancellations.some(row => row.season === selectedSeason)
    && !isCancelledSku(buildCancelledSkuKeySet(cancellations.filter(row => row.season === selectedSeason)), identity));
  const targetKey = identityKey(next);
  const customCollision = library.custom.some(row => !options.excludedCustomIds?.includes(row.id)
    && (!options.season || row.season === options.season) && identityKey(row) === targetKey && active(row, row.season));
  const staticCollision = library.raw.some(raw => {
    if (options.originalStatic && identityKey(raw) === identityKey(options.originalStatic)) return false;
    const candidates = library.meta.filter(row => primaryKey(row) === primaryKey(raw));
    const meta = candidates.find(row => identityKey(row) === identityKey(raw)) ?? (candidates.length === 1 ? candidates[0] : undefined);
    const identity = effectiveIdentity(raw, meta);
    return identityKey(identity) === targetKey && active(identity, options.season);
  });
  const metaCollision = library.meta.some(row => row.id !== options.sourceMetaId
    && identityKey(effectiveIdentity(row, row)) === targetKey && active(effectiveIdentity(row, row), options.season));
  if (customCollision || staticCollision || metaCollision) throw new Error("A target physical SKU already exists; identity corrections cannot merge specifications");
}

export async function materializeRenamedSkuSpecs(db: IdentityDbScope, previous: BuySkuIdentity, next: BuySkuIdentity) {
  const specRows = await db.select().from(styleSpecs).where(eq(styleSpecs.style, previous.style)).for("update");
  const customRows = await db.select().from(specCustomRows).where(eq(specCustomRows.style, previous.style)).for("update");
  const snapshot = snapshotSkuIdentitySpecs({ previous, next, specRows, customRows });
  const updatedAt = new Date(Math.max(Date.now(), ...specRows.map(savedCellTime), ...customRows.map(savedCellTime)) + 1000);
  for (const cell of snapshot.components) {
    const target = newestSavedCell(specRows.filter(row => row.component === cell.component && normalizeSkuIdentityPart(row.colour) === snapshot.newLabel));
    if (target) await db.update(styleSpecs).set({ value: cell.value, updatedAt }).where(and(eq(styleSpecs.style, next.style), eq(styleSpecs.id, target.id)));
    else await db.insert(styleSpecs).values({ style: next.style, colour: snapshot.newLabel, component: cell.component, value: cell.value, updatedAt });
  }
  for (const cell of snapshot.customCells) {
    if (cell.targetId !== undefined) await db.update(specCustomRows).set({ value: cell.value, updatedAt }).where(and(eq(specCustomRows.style, next.style), eq(specCustomRows.id, cell.targetId)));
    else await db.insert(specCustomRows).values({ style: next.style, colour: snapshot.newLabel, section: cell.section, title: cell.title,
      sortOrder: cell.sortOrder, value: cell.value, updatedAt });
  }
}
