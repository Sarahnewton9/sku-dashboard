import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, fittingImages, skuMeta, styleMeta, styleFittingImages, users, buySessions, buySessionItems, lastApprovals, seasonImports, seasonSkuData, InsertSeasonSkuData, styleSpecs, specDropdownOptions, styleSpecMeta, fittingSessions, fittingSessionImages, styleImageOverrides, cancelledStyles, customSkus, cancelledSkus, styleSubCategories, styleTrendFlags, fittingGroups, fittingGroupStyles, FittingGroup, specCustomRows, SpecCustomRow, deletedLasts, pptxImports, lastHeelHeights, skuNewOverride, customStyles, specRowOrder, specHiddenColumns, customLasts, lastMeasurements, ap21StyleRefs, ap21ColourRefs } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── SKU Meta ────────────────────────────────────────────────────────────────

export async function getAllSkuMeta() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(skuMeta);
}

export async function getSkuMeta(style: string, colour: string, leather: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(skuMeta)
    .where(and(eq(skuMeta.style, style), eq(skuMeta.colour, colour), eq(skuMeta.leather, leather)))
    .limit(1);
  return result[0];
}

export async function upsertSkuMeta(data: {
  style: string; colour: string; leather: string;
  sampleStatus?: "waiting" | "fitting_sample" | "received";
  orderQty?: number;
  isSize11?: boolean;
  costPrice?: number | null;
  fitRating?: "tts" | "runs_small" | "runs_large" | null;
  fittingNotes?: string | null;
  sampleType?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getSkuMeta(data.style, data.colour, data.leather);
  if (existing) {
    const updateSet: Record<string, unknown> = {};
    if (data.sampleStatus !== undefined) updateSet.sampleStatus = data.sampleStatus;
    if (data.orderQty !== undefined) updateSet.orderQty = data.orderQty;
    if (data.isSize11 !== undefined) updateSet.isSize11 = data.isSize11;
    if (data.costPrice !== undefined) updateSet.costPrice = data.costPrice;
    if (data.fitRating !== undefined) updateSet.fitRating = data.fitRating;
    if (data.fittingNotes !== undefined) updateSet.fittingNotes = data.fittingNotes;
    if (data.sampleType !== undefined) updateSet.sampleType = data.sampleType;
    await db.update(skuMeta)
      .set(updateSet)
      .where(and(eq(skuMeta.style, data.style), eq(skuMeta.colour, data.colour), eq(skuMeta.leather, data.leather)));
  } else {
    await db.insert(skuMeta).values({
      style: data.style,
      colour: data.colour,
      leather: data.leather,
      sampleStatus: data.sampleStatus ?? "waiting",
      orderQty: data.orderQty ?? 0,
      isSize11: data.isSize11 ?? false,
      costPrice: data.costPrice ?? null,
      fitRating: data.fitRating ?? null,
      fittingNotes: data.fittingNotes ?? null,
      sampleType: data.sampleType ?? null,
    });
  }
}

// ─── Style Meta ──────────────────────────────────────────────────────────────

export async function getAllStyleMeta() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(styleMeta);
}

export async function upsertStyleRrp(style: string, rrp: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(styleMeta).values({ style, rrp }).onDuplicateKeyUpdate({ set: { rrp } });
}

export async function upsertStyleCategory(style: string, category: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(styleMeta).values({ style, category }).onDuplicateKeyUpdate({ set: { category } });
}

// ─── Style Fit (style-level fit rating + notes) ──────────────────────────────

export async function upsertStyleFit(
  style: string,
  fitRating: "tts" | "runs_small" | "runs_large" | null,
  fittingNotes: string | null,
  fitApproved?: boolean,
  sizeRecommendation?: "half_size_up" | "full_size_up" | "half_size_down" | "full_size_down" | null,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = { fitRating, fittingNotes };
  if (fitApproved !== undefined) updateSet.fitApproved = fitApproved;
  if (sizeRecommendation !== undefined) updateSet.sizeRecommendation = sizeRecommendation;
  await db.insert(styleMeta)
    .values({ style, fitRating, fittingNotes, fitApproved: fitApproved ?? false, sizeRecommendation: sizeRecommendation ?? null })
    .onDuplicateKeyUpdate({ set: updateSet as any });
}

// ─── Style Fitting Images ─────────────────────────────────────────────────────

export async function getStyleFittingImages(style: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(styleFittingImages).where(eq(styleFittingImages.style, style));
}

export async function getAllStyleFittingImages() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(styleFittingImages);
}

export async function addStyleFittingImage(data: { style: string; imageUrl: string; fileKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(styleFittingImages).values(data);
  const result = await db.select().from(styleFittingImages)
    .where(eq(styleFittingImages.fileKey, data.fileKey))
    .limit(1);
  return result[0];
}

export async function deleteStyleFittingImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(styleFittingImages).where(eq(styleFittingImages.id, id));
}

// ─── Fitting Images (legacy SKU-level) ───────────────────────────────────────

export async function getFittingImages(style: string, colour: string, leather: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fittingImages)
    .where(and(eq(fittingImages.style, style), eq(fittingImages.colour, colour), eq(fittingImages.leather, leather)));
}

export async function addFittingImage(data: {
  style: string; colour: string; leather: string;
  imageUrl: string; fileKey: string; uploadedBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(fittingImages).values({
    style: data.style,
    colour: data.colour,
    leather: data.leather,
    imageUrl: data.imageUrl,
    fileKey: data.fileKey,
    uploadedBy: data.uploadedBy ?? null,
  });
}

export async function deleteFittingImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(fittingImages).where(eq(fittingImages.id, id));
}

export async function getAllFittingImages() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fittingImages);
}

// ─── Buy Sessions ─────────────────────────────────────────────────────────────

export async function getAllBuySessions(season = "SS26") {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(buySessions).where(eq(buySessions.season, season)).orderBy(buySessions.createdAt);
}

export async function getActiveBuySession(season = "SS26") {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(buySessions)
    .where(and(eq(buySessions.isLocked, false), eq(buySessions.season, season)))
    .orderBy(buySessions.createdAt)
    .limit(1);
  return result[0] ?? null;
}

export async function createBuySession(name: string, season = "SS26") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(buySessions).values({ name, isLocked: false, season });
  // Return the newly created session
  const result = await db.select().from(buySessions)
    .where(and(eq(buySessions.name, name), eq(buySessions.season, season)))
    .orderBy(buySessions.createdAt)
    .limit(1);
  return result[0];
}

export async function lockBuySession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(buySessions)
    .set({ isLocked: true, lockedAt: new Date() })
    .where(eq(buySessions.id, id));
}

export async function getBuySessionItems(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(buySessionItems)
    .where(eq(buySessionItems.sessionId, sessionId));
}

export async function getSessionTotals(season = "SS26"): Promise<Record<number, { au: number; usa: number; nyc: number; la: number; total: number }>> {
  const db = await getDb();
  if (!db) return {};
  const sessionIds = (await db.select({ id: buySessions.id }).from(buySessions).where(eq(buySessions.season, season))).map(s => s.id);
  if (sessionIds.length === 0) return {};
  const rows = await db.select().from(buySessionItems).where(inArray(buySessionItems.sessionId, sessionIds));
  const totals: Record<number, { au: number; usa: number; nyc: number; la: number; total: number }> = {};
  for (const row of rows) {
    const au = row.auQty ?? 0;
    const usa = row.usaQty ?? 0;
    const nyc = row.nycQty ?? 0;
    const la = row.laQty ?? 0;
    if (!totals[row.sessionId]) totals[row.sessionId] = { au: 0, usa: 0, nyc: 0, la: 0, total: 0 };
    totals[row.sessionId].au += au;
    totals[row.sessionId].usa += usa;
    totals[row.sessionId].nyc += nyc;
    totals[row.sessionId].la += la;
    totals[row.sessionId].total += au + usa + nyc + la;
  }
  return totals;
}

/**
 * Returns per-SKU totals across ALL sessions, plus a per-session breakdown.
 * Key: "style|colour|leather"
 * Only includes SKUs with at least 1 unit bought.
 */
export async function getAllSessionQtys(season = "SS26"): Promise<Record<string, {
  totalAu: number;
  totalUsa: number;
  totalNyc: number;
  totalLa: number;
  total: number;
  sessions: Array<{ sessionId: number; sessionName: string; au: number; usa: number; nyc: number; la: number }>;
}>> {
  const db = await getDb();
  if (!db) return {};
  const seasonSessions = await db.select().from(buySessions).where(eq(buySessions.season, season));
  const seasonSessionIds = seasonSessions.map(s => s.id);
  const [items, sessions] = await Promise.all([
    seasonSessionIds.length > 0 ? db.select().from(buySessionItems).where(inArray(buySessionItems.sessionId, seasonSessionIds)) : Promise.resolve([]),
    Promise.resolve(seasonSessions),
  ]);
  const sessionMap: Record<number, string> = {};
  for (const s of sessions) sessionMap[s.id] = s.name;
  const result: Record<string, { totalAu: number; totalUsa: number; totalNyc: number; totalLa: number; total: number; sessions: Array<{ sessionId: number; sessionName: string; au: number; usa: number; nyc: number; la: number }> }> = {};
  for (const row of items) {
    const au = row.auQty ?? 0;
    const usa = row.usaQty ?? 0;
    const nyc = row.nycQty ?? 0;
    const la = row.laQty ?? 0;
    if (au === 0 && usa === 0 && nyc === 0 && la === 0) continue;
    const key = `${row.style}|${row.colour}|${row.leather}`;
    if (!result[key]) result[key] = { totalAu: 0, totalUsa: 0, totalNyc: 0, totalLa: 0, total: 0, sessions: [] };
    result[key].totalAu += au;
    result[key].totalUsa += usa;
    result[key].totalNyc += nyc;
    result[key].totalLa += la;
    result[key].total += au + usa + nyc + la;
    result[key].sessions.push({ sessionId: row.sessionId, sessionName: sessionMap[row.sessionId] ?? `Session ${row.sessionId}`, au, usa, nyc, la });
  }
  return result;
}

export async function upsertBuySessionItem(
  sessionId: number, style: string, colour: string, leather: string,
  auQty: number, usaQty: number, nycQty: number = 0, laQty: number = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(buySessionItems)
    .where(and(
      eq(buySessionItems.sessionId, sessionId),
      eq(buySessionItems.style, style),
      eq(buySessionItems.colour, colour),
      eq(buySessionItems.leather, leather)
    ))
    .limit(1);
  const qty = auQty + usaQty + nycQty + laQty; // keep legacy qty in sync
  if (existing.length > 0) {
    await db.update(buySessionItems)
      .set({ auQty, usaQty, nycQty, laQty, qty })
      .where(eq(buySessionItems.id, existing[0].id));
  } else {
    await db.insert(buySessionItems).values({ sessionId, style, colour, leather, auQty, usaQty, nycQty, laQty, qty });
  }
}

// ─── Cancelled SKUs ─────────────────────────────────────────────────────────────────────────────

export async function cancelSku(style: string, colour: string, leather: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(cancelledSkus).values({ style, colour, leather })
    .onDuplicateKeyUpdate({ set: { cancelledAt: new Date() } });
}

export async function restoreSku(style: string, colour: string, leather: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cancelledSkus).where(
    and(
      eq(cancelledSkus.style, style),
      eq(cancelledSkus.colour, colour),
      eq(cancelledSkus.leather, leather)
    )
  );
}

export async function listCancelledSkus() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cancelledSkus);
}

// ─── Style Sub-Categories ─────────────────────────────────────────────────────────────────────────

export async function getAllStyleSubCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(styleSubCategories);
}

export async function upsertStyleSubCategory(style: string, subCategory: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(styleSubCategories)
    .where(eq(styleSubCategories.style, style)).limit(1);
  if (existing.length > 0) {
    await db.update(styleSubCategories).set({ subCategory }).where(eq(styleSubCategories.style, style));
  } else {
    await db.insert(styleSubCategories).values({ style, subCategory });
  }
}

export async function deleteBuySession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete all items first, then the session
  await db.delete(buySessionItems).where(eq(buySessionItems.sessionId, id));
  await db.delete(buySessions).where(eq(buySessions.id, id));
}

// ─── Last Approvals ─────────────────────────────────────────────────────────────────────────────

export async function getAllLastApprovals(season = "SS26") {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lastApprovals).where(eq(lastApprovals.season, season));
}

export async function upsertLastApproval(
  lastName: string,
  status: "approved" | "waiting_revised",
  notes?: string | null,
  size65Approved?: boolean,
  size7Approved?: boolean,
  size95Approved?: boolean,
  proceedWithSamples?: boolean,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values: Record<string, unknown> = { lastName, status, notes: notes ?? null };
  if (size65Approved !== undefined) values.size65Approved = size65Approved;
  if (size7Approved !== undefined) values.size7Approved = size7Approved;
  if (size95Approved !== undefined) values.size95Approved = size95Approved;
  if (proceedWithSamples !== undefined) values.proceedWithSamples = proceedWithSamples;
  await db.insert(lastApprovals)
    .values({ lastName, status, notes: notes ?? null,
      size65Approved: size65Approved ?? false,
      size7Approved: size7Approved ?? false,
      size95Approved: size95Approved ?? false,
      proceedWithSamples: proceedWithSamples ?? false,
    })
    .onDuplicateKeyUpdate({ set: values as any });
}

// ─── Deleted Lasts ───────────────────────────────────────────────────────────

export async function getDeletedLasts(season = "SS26"): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(deletedLasts).where(eq(deletedLasts.season, season));
  return rows.map(r => r.lastName);
}

export async function deleteLast(lastName: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(deletedLasts)
    .values({ lastName })
    .onDuplicateKeyUpdate({ set: { lastName } });
}

export async function restoreDeletedLast(lastName: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(deletedLasts).where(eq(deletedLasts.lastName, lastName));
}

// ─── Season Imports ──────────────────────────────────────────────────────────

export async function getAllSeasonImports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(seasonImports).orderBy(seasonImports.uploadedAt);
}

export async function createSeasonImport(label: string, rows: Omit<InsertSeasonSkuData, 'importId'>[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Insert the import record
  await db.insert(seasonImports).values({ label, rowCount: rows.length });
  // Get the new import id
  const result = await db.select().from(seasonImports)
    .orderBy(seasonImports.uploadedAt)
    .limit(1);
  // Get the last inserted (highest id)
  const allImports = await db.select().from(seasonImports);
  const newImport = allImports.sort((a, b) => b.id - a.id)[0];
  if (!newImport) throw new Error("Failed to create season import");
  // Insert all rows in batches of 200
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map(r => ({ ...r, importId: newImport.id }));
    await db.insert(seasonSkuData).values(batch);
  }
  return newImport;
}

export async function getSeasonSkuData(importId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(seasonSkuData).where(eq(seasonSkuData.importId, importId));
}

export async function deleteSeasonImport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(seasonSkuData).where(eq(seasonSkuData.importId, id));
  await db.delete(seasonImports).where(eq(seasonImports.id, id));
}

// ─── Style Specs ──────────────────────────────────────────────────────────────



export async function getSpecsForStyle(style: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(styleSpecs).where(eq(styleSpecs.style, style));
}

export async function upsertStyleSpec(style: string, colour: string, component: string, value: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(styleSpecs)
    .values({ style, colour, component, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

/**
 * Bulk upsert spec values — inserts or updates many rows in a single DB call.
 * @param rows Array of { style, colour, component, value } objects
 * @param overwrite If false, only inserts rows where value is currently NULL/empty
 * @returns number of rows processed
 */
export async function bulkUpsertStyleSpecs(
  rows: { style: string; colour: string; component: string; value: string }[],
  overwrite: boolean = true
): Promise<number> {
  if (rows.length === 0) return 0;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // MySQL supports multi-row INSERT ... ON DUPLICATE KEY UPDATE
  // Drizzle's .insert().values([...]) handles this natively
  if (overwrite) {
    // Overwrite mode: update value regardless of existing content
    await db.insert(styleSpecs)
      .values(rows)
      .onDuplicateKeyUpdate({ set: { value: sql`VALUES(value)` } });
  } else {
    // Fill-blanks mode: only update if current value is NULL or empty string
    await db.insert(styleSpecs)
      .values(rows)
      .onDuplicateKeyUpdate({
        set: {
          value: sql`IF(COALESCE(style_specs.value, '') = '', VALUES(value), style_specs.value)`,
        },
      });
  }
  return rows.length;
}

export async function deleteStyleSpecs(style: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(styleSpecs).where(eq(styleSpecs.style, style));
}

// ─── Spec Dropdown Options ────────────────────────────────────────────────────

export async function getDropdownOptions(component: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(specDropdownOptions)
    .where(eq(specDropdownOptions.component, component))
    .orderBy(specDropdownOptions.createdAt);
}

export async function getAllDropdownOptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(specDropdownOptions).orderBy(specDropdownOptions.component, specDropdownOptions.createdAt);
}

export async function addDropdownOption(component: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Avoid exact duplicates
  const existing = await db.select().from(specDropdownOptions)
    .where(and(eq(specDropdownOptions.component, component), eq(specDropdownOptions.value, value)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(specDropdownOptions).values({ component, value });
  const result = await db.select().from(specDropdownOptions)
    .where(and(eq(specDropdownOptions.component, component), eq(specDropdownOptions.value, value)))
    .limit(1);
  return result[0];
}

export async function deleteDropdownOption(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(specDropdownOptions).where(eq(specDropdownOptions.id, id));
}

export async function deleteDropdownOptionByValue(component: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(specDropdownOptions).where(
    and(eq(specDropdownOptions.component, component), eq(specDropdownOptions.value, value))
  );
}

export async function updateDropdownOption(id: number, value: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(specDropdownOptions).set({ value }).where(eq(specDropdownOptions.id, id));
}

// ─── Style Spec Meta (buckle, sub-type, notes) ────────────────────────────────

export async function getStyleSpecMeta(style: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(styleSpecMeta).where(eq(styleSpecMeta.style, style)).limit(1);
  return result[0] ?? null;
}

export async function getAllStyleSpecMeta() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(styleSpecMeta);
}

export async function upsertStyleSpecMeta(data: {
  style: string;
  hasBuckle?: boolean;
  dressShoeSubType?: "court" | "sling" | null;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (data.hasBuckle !== undefined) updateSet.hasBuckle = data.hasBuckle;
  if (data.dressShoeSubType !== undefined) updateSet.dressShoeSubType = data.dressShoeSubType;
  if (data.notes !== undefined) updateSet.notes = data.notes;
  await db.insert(styleSpecMeta)
    .values({
      style: data.style,
      hasBuckle: data.hasBuckle ?? false,
      dressShoeSubType: data.dressShoeSubType ?? null,
      notes: data.notes ?? null,
    })
    .onDuplicateKeyUpdate({ set: updateSet });
}

// ─── Spec counts per style (for sidebar completion indicators) ────────────────
export async function getSpecCountsForAllStyles(): Promise<{ style: string; filledCount: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      style: styleSpecs.style,
      filledCount: sql<number>`COUNT(*)`,
    })
    .from(styleSpecs)
    .where(sql`${styleSpecs.value} IS NOT NULL AND ${styleSpecs.value} != ''`)
    .groupBy(styleSpecs.style);
  return rows.map((r) => ({ style: r.style, filledCount: Number(r.filledCount) }));
}

// ─── Fitting Sessions ─────────────────────────────────────────────────────────
export async function createFittingSession(data: { style: string; fitModel: string; sessionDate: string; notes?: string; sampleDate?: string | null; sampleType?: string | null; sampleSize?: string | null; season?: string }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fittingSessions).values({
    style: data.style,
    fitModel: data.fitModel,
    sessionDate: data.sessionDate,
    notes: data.notes ?? null,
    sampleDate: data.sampleDate ?? null,
    sampleType: data.sampleType ?? null,
    sampleSize: data.sampleSize ?? null,
    season: data.season ?? "SS26",
  });
  return (result[0] as { insertId: number }).insertId;
}

export async function updateFittingSession(data: { id: number; fitModel?: string; sessionDate?: string; notes?: string | null; sampleDate?: string | null; sampleType?: string | null; sampleSize?: string | null }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (data.fitModel !== undefined) updateSet.fitModel = data.fitModel;
  if (data.sessionDate !== undefined) updateSet.sessionDate = data.sessionDate;
  if (data.notes !== undefined) updateSet.notes = data.notes;
  if (data.sampleDate !== undefined) updateSet.sampleDate = data.sampleDate;
  if (data.sampleType !== undefined) updateSet.sampleType = data.sampleType;
  if (data.sampleSize !== undefined) updateSet.sampleSize = data.sampleSize;
  if (Object.keys(updateSet).length === 0) return;
  await db.update(fittingSessions).set(updateSet).where(eq(fittingSessions.id, data.id));
}

export async function deleteFittingSession(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete images first
  await db.delete(fittingSessionImages).where(eq(fittingSessionImages.sessionId, id));
  await db.delete(fittingSessions).where(eq(fittingSessions.id, id));
}

export async function getFittingSessionsForStyle(style: string, season = "SS26"): Promise<Array<{
  id: number; style: string; fitModel: string; sessionDate: string; notes: string | null; sampleDate: string | null; sampleType: string | null; createdAt: Date;
  images: Array<{ id: number; imageUrl: string; fileKey: string; createdAt: Date }>;
}>> {
  const db = await getDb();
  if (!db) return [];
  const sessions = await db.select().from(fittingSessions).where(and(eq(fittingSessions.style, style), eq(fittingSessions.season, season))).orderBy(fittingSessions.sessionDate);
  const images = await db.select().from(fittingSessionImages).where(eq(fittingSessionImages.style, style));
  return sessions.map((s) => ({
    ...s,
    images: images.filter((img) => img.sessionId === s.id),
  }));
}

export async function getAllFittingSessions(season = "SS26"): Promise<Array<{
  id: number; style: string; fitModel: string; sessionDate: string; notes: string | null; sampleDate: string | null; sampleType: string | null; createdAt: Date;
  images: Array<{ id: number; sessionId: number; style: string; imageUrl: string; fileKey: string; createdAt: Date }>;
}>> {
  const db = await getDb();
  if (!db) return [];
  const sessions = await db.select().from(fittingSessions).where(eq(fittingSessions.season, season)).orderBy(fittingSessions.style, fittingSessions.sessionDate);
  const images = await db.select().from(fittingSessionImages);
  return sessions.map((s) => ({
    ...s,
    images: images.filter((img) => img.sessionId === s.id),
  }));
}

export async function addFittingSessionImage(data: { sessionId: number; style: string; imageUrl: string; fileKey: string }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(fittingSessionImages).values(data);
}

export async function deleteFittingSessionImage(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(fittingSessionImages).where(eq(fittingSessionImages.id, id));
}

// ─── Style Image Overrides ────────────────────────────────────────────────────
export async function upsertStyleImageOverride(data: { style: string; imageUrl: string; fileKey: string }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(styleImageOverrides)
    .values(data)
    .onDuplicateKeyUpdate({ set: { imageUrl: data.imageUrl, fileKey: data.fileKey } });
}

export async function deleteStyleImageOverride(style: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(styleImageOverrides).where(eq(styleImageOverrides.style, style));
}

export async function getAllStyleImageOverrides(): Promise<{ style: string; imageUrl: string }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ style: styleImageOverrides.style, imageUrl: styleImageOverrides.imageUrl }).from(styleImageOverrides);
  return rows;
}

// ─── Cancelled Styles ─────────────────────────────────────────────────────────

export async function cancelStyle(style: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(cancelledStyles)
    .values({ style })
    .onDuplicateKeyUpdate({ set: { style } }); // idempotent
}

export async function restoreStyle(style: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cancelledStyles).where(eq(cancelledStyles.style, style));
}

export async function listCancelledStyles(): Promise<{ style: string; cancelledAt: Date }[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select({ style: cancelledStyles.style, cancelledAt: cancelledStyles.cancelledAt }).from(cancelledStyles);
}

// ─── Custom SKUs ───────────────────────────────────────────────────────────────
export async function addCustomSku(style: string, colour: string, leather: string, season = "SS26"): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // If this exact style/colour/leather already exists for this season, return the existing id
  const existing = await db.select({ id: customSkus.id }).from(customSkus)
    .where(and(eq(customSkus.style, style), eq(customSkus.colour, colour), eq(customSkus.leather, leather), eq(customSkus.season, season)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const result = await db.insert(customSkus).values({ style, colour, leather, season });
  return (result[0] as any).insertId as number;
}

export async function getAllCustomSkus(season = "SS26"): Promise<{ id: number; style: string; colour: string; leather: string; isNew: boolean; createdAt: Date }[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customSkus).where(eq(customSkus.season, season));
}

export async function deleteCustomSku(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customSkus).where(eq(customSkus.id, id));
}

// ─── Custom Styles ────────────────────────────────────────────────────────────
export async function getAllCustomStyles(season = "SS26"): Promise<{ id: number; style: string; lastName: string; category: string | null; createdAt: Date }[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customStyles).where(eq(customStyles.season, season));
}

export async function addCustomStyle(style: string, lastName: string, category?: string, season = "SS26"): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .insert(customStyles)
    .values({ style, lastName, category: category ?? null, season })
    .onDuplicateKeyUpdate({ set: { lastName, category: category ?? null } });
  return (result[0] as any).insertId as number;
}

export async function deleteCustomStyle(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customStyles).where(eq(customStyles.id, id));
}

// ─── Unlock Buy Session ────────────────────────────────────────────────────────
export async function unlockBuySession(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(buySessions).set({ isLocked: false }).where(eq(buySessions.id, id));
}

export async function renameBuySession(id: number, name: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(buySessions).set({ name }).where(eq(buySessions.id, id));
}

// ─── Style Trend Flags ────────────────────────────────────────────────────────
export async function getAllStyleTrendFlags() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(styleTrendFlags);
  // Parse the JSON trends array; fall back to [trendFlag] for legacy rows
  return rows.map((r) => ({
    ...r,
    trends: (() => {
      try {
        const parsed = JSON.parse(r.trends ?? "[]");
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : [r.trendFlag];
      } catch {
        return [r.trendFlag];
      }
    })(),
  }));
}

export async function upsertStyleTrends(style: string, trends: string[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const trendFlag = trends[0] ?? "";
  const trendsJson = JSON.stringify(trends);
  await db.insert(styleTrendFlags)
    .values({ style, trendFlag, trends: trendsJson })
    .onDuplicateKeyUpdate({ set: { trendFlag, trends: trendsJson } });
}

export async function deleteStyleTrends(style: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(styleTrendFlags).where(eq(styleTrendFlags.style, style));
}

// ─── Style Website Images (scraped from tonybianco.com.au) ────────────────────

export async function upsertStyleWebsiteImage(style: string, websiteImageUrl: string | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(styleMeta)
    .values({ style, websiteImageUrl })
    .onDuplicateKeyUpdate({ set: { websiteImageUrl } });
}

export async function getAllStyleWebsiteImages(): Promise<{ style: string; websiteImageUrl: string | null }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ style: styleMeta.style, websiteImageUrl: styleMeta.websiteImageUrl }).from(styleMeta);
  return rows;
}


// ─── Fitting Groups ────────────────────────────────────────────────────────────

export async function createFittingGroup(name: string, sessionDate: string, notes: string | null): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fittingGroups).values({ name, sessionDate, notes });
  return (result[0] as any).insertId as number;
}

export async function getAllFittingGroups(): Promise<(FittingGroup & { styles: string[] })[]> {
  const db = await getDb();
  if (!db) return [];
  const groups = await db.select().from(fittingGroups).orderBy(fittingGroups.createdAt);
  const styleRows = await db.select().from(fittingGroupStyles);
  return groups.map((g) => ({
    ...g,
    styles: styleRows.filter((s) => s.groupId === g.id).map((s) => s.style),
  }));
}

export async function updateFittingGroup(id: number, name: string, sessionDate: string, notes: string | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(fittingGroups).set({ name, sessionDate, notes }).where(eq(fittingGroups.id, id));
}

export async function deleteFittingGroup(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(fittingGroupStyles).where(eq(fittingGroupStyles.groupId, id));
  await db.delete(fittingGroups).where(eq(fittingGroups.id, id));
}

export async function addStyleToFittingGroup(groupId: number, style: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(fittingGroupStyles).values({ groupId, style }).onDuplicateKeyUpdate({ set: { style } });
}

export async function removeStyleFromFittingGroup(groupId: number, style: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(fittingGroupStyles).where(and(eq(fittingGroupStyles.groupId, groupId), eq(fittingGroupStyles.style, style)));
}

// ─── Spec Custom Rows ─────────────────────────────────────────────────────────

export async function getSpecCustomRowsForStyle(style: string): Promise<SpecCustomRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(specCustomRows).where(eq(specCustomRows.style, style));
}

export async function upsertSpecCustomRow(data: {
  id?: number;
  style: string;
  colour: string;
  section: string;
  title: string;
  value: string;
  sortOrder?: number;
}): Promise<SpecCustomRow> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.id) {
    await db.update(specCustomRows)
      .set({ title: data.title, value: data.value, sortOrder: data.sortOrder ?? 0 })
      .where(eq(specCustomRows.id, data.id));
    const [row] = await db.select().from(specCustomRows).where(eq(specCustomRows.id, data.id));
    return row;
  } else {
    const [result] = await db.insert(specCustomRows).values({
      style: data.style,
      colour: data.colour,
      section: data.section,
      title: data.title,
      value: data.value,
      sortOrder: data.sortOrder ?? 0,
    });
    const insertId = (result as any).insertId;
    const [row] = await db.select().from(specCustomRows).where(eq(specCustomRows.id, insertId));
    return row;
  }
}

export async function deleteSpecCustomRow(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(specCustomRows).where(eq(specCustomRows.id, id));
}

/**
 * Delete ALL custom rows for a given style+section+title group.
 * This handles both __all__ rows and per-colour exploded rows.
 */
export async function deleteSpecCustomRowGroup(style: string, section: string, title: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(specCustomRows).where(
    and(
      eq(specCustomRows.style, style),
      eq(specCustomRows.section, section),
      eq(specCustomRows.title, title),
    )
  );
}

/**
 * Upsert a custom row value for a specific colour.
 *
 * If the row is currently stored as `__all__` (single shared value), this
 * function "explodes" it into individual per-colour rows (one per colour in
 * `allColours`), then updates the target colour's row with the new value.
 *
 * If per-colour rows already exist for this title, it simply upserts the
 * specific colour's row.
 */
export async function upsertCustomRowForColour(data: {
  /** The __all__ row id (used to delete it when exploding) */
  allRowId: number;
  style: string;
  section: string;
  title: string;
  sortOrder: number;
  /** The colour being edited */
  targetColour: string;
  /** New value for targetColour */
  newValue: string;
  /** Current shared value (used to seed all other colours when exploding) */
  currentSharedValue: string;
  /** All colours for this style (used to create per-colour rows) */
  allColours: string[];
}): Promise<{ rows: SpecCustomRow[]; newRepId: number | null; wasExploded: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if per-colour rows already exist for this style+section+title
  const existing = await db.select().from(specCustomRows)
    .where(
      and(
        eq(specCustomRows.style, data.style),
        eq(specCustomRows.section, data.section),
        eq(specCustomRows.title, data.title),
      )
    );

  const hasAllRow = existing.some((r) => r.colour === "__all__");

  if (hasAllRow) {
    // Explode: delete the __all__ row and insert per-colour rows
    await db.delete(specCustomRows).where(eq(specCustomRows.id, data.allRowId));
    for (const colour of data.allColours) {
      const value = colour === data.targetColour ? data.newValue : data.currentSharedValue;
      await db.insert(specCustomRows).values({
        style: data.style,
        colour,
        section: data.section,
        title: data.title,
        value,
        sortOrder: data.sortOrder,
      });
    }
  } else {
    // Per-colour rows already exist — upsert the target colour's row
    const targetRow = existing.find((r) => r.colour === data.targetColour);
    if (targetRow) {
      await db.update(specCustomRows)
        .set({ value: data.newValue })
        .where(eq(specCustomRows.id, targetRow.id));
    } else {
      // Colour row doesn't exist yet (e.g. new colour added after rows were created)
      await db.insert(specCustomRows).values({
        style: data.style,
        colour: data.targetColour,
        section: data.section,
        title: data.title,
        value: data.newValue,
        sortOrder: data.sortOrder,
      });
    }
  }

  // Return all rows for this style+section+title
  const newRows = await db.select().from(specCustomRows)
    .where(
      and(
        eq(specCustomRows.style, data.style),
        eq(specCustomRows.section, data.section),
        eq(specCustomRows.title, data.title),
      )
    );
  // Also return the new representative id (lowest id) so the client can update rowKeys
  const newRepId = newRows.length > 0 ? Math.min(...newRows.map((r) => r.id)) : null;
  return { rows: newRows, newRepId, wasExploded: hasAllRow };
}

// ─── PPTX Import Log ────────────────────────────────────────────────────────────────────────────

export async function recordPptxImport(fileKey: string, fileName: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(pptxImports).values({ fileKey, fileName });
  return (result as any).insertId;
}

export async function getLatestPptxImport(): Promise<{ id: number; fileKey: string; fileName: string; uploadedAt: Date } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pptxImports).orderBy(desc(pptxImports.uploadedAt)).limit(1);
  return rows[0] ?? null;
}

export async function listPptxImports(): Promise<Array<{ id: number; fileKey: string; fileName: string; uploadedAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pptxImports).orderBy(desc(pptxImports.uploadedAt)).limit(20);
}

// ─── Last Heel Heights ────────────────────────────────────────────────────────
export async function getAllLastHeelHeights(): Promise<Array<{ lastName: string; heelHeightCm: number }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(lastHeelHeights);
  return rows.map(r => ({ lastName: r.lastName, heelHeightCm: r.heelHeightCm }));
}

export async function upsertLastHeelHeight(lastName: string, heelHeightCm: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(lastHeelHeights)
    .values({ lastName, heelHeightCm })
    .onDuplicateKeyUpdate({ set: { heelHeightCm } });
}

// ─── Changes Report ───────────────────────────────────────────────────────────
export async function getChangesReport(since: Date): Promise<{
  cancelledStyles: Array<{ style: string; cancelledAt: Date }>;
  cancelledSkus: Array<{ style: string; colour: string; leather: string; cancelledAt: Date }>;
  newColours: Array<{ style: string; colour: string; leather: string; createdAt: Date }>;
}> {
  const db = await getDb();
  if (!db) return { cancelledStyles: [], cancelledSkus: [], newColours: [] };
  const [cStyles, cSkus, nColours] = await Promise.all([
    db.select({ style: cancelledStyles.style, cancelledAt: cancelledStyles.cancelledAt })
      .from(cancelledStyles)
      .where(gte(cancelledStyles.cancelledAt, since)),
    db.select({ style: cancelledSkus.style, colour: cancelledSkus.colour, leather: cancelledSkus.leather, cancelledAt: cancelledSkus.cancelledAt })
      .from(cancelledSkus)
      .where(gte(cancelledSkus.cancelledAt, since)),
    db.select({ style: customSkus.style, colour: customSkus.colour, leather: customSkus.leather, createdAt: customSkus.createdAt })
      .from(customSkus)
      .where(gte(customSkus.createdAt, since)),
  ]);
  return { cancelledStyles: cStyles, cancelledSkus: cSkus, newColours: nColours };
}

// ─── SKU New/Existing Override ────────────────────────────────────────────────
export async function getAllSkuNewOverrides(): Promise<Array<{ style: string; colour: string; leather: string; isNew: boolean }>> {
  const db = await getDb();
  if (!db) return [];
  return db.select({ style: skuNewOverride.style, colour: skuNewOverride.colour, leather: skuNewOverride.leather, isNew: skuNewOverride.isNew })
    .from(skuNewOverride);
}

export async function upsertSkuNewOverride(style: string, colour: string, leather: string, isNew: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Preserve the __all__ sentinel as-is; uppercase everything else
  const normColour = colour === "__all__" ? "__all__" : colour.toUpperCase();
  const normLeather = leather === "__all__" ? "__all__" : leather.toUpperCase();
  await db.insert(skuNewOverride)
    .values({ style: style.toUpperCase(), colour: normColour, leather: normLeather, isNew })
    .onDuplicateKeyUpdate({ set: { isNew } });
}

// ─── Batch reorder custom spec rows ──────────────────────────────────────────

export async function batchReorderCustomRows(orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(specCustomRows)
        .set({ sortOrder: i })
        .where(eq(specCustomRows.id, orderedIds[i]));
    }
  });
}

// ─── Spec row order (custom ordering of all rows per style) ──────────────────
export async function getSpecRowOrder(style: string): Promise<string[] | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(specRowOrder).where(eq(specRowOrder.style, style.toUpperCase())).limit(1);
  if (rows.length === 0) return null;
  try { return JSON.parse(rows[0].rowKeys) as string[]; } catch { return null; }
}

export async function upsertSpecRowOrder(style: string, rowKeys: string[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const json = JSON.stringify(rowKeys);
  await db.insert(specRowOrder).values({ style: style.toUpperCase(), rowKeys: json })
    .onDuplicateKeyUpdate({ set: { rowKeys: json } });
}

// ── Spec Hidden Columns ─────────────────────────────────────────────────────

export async function getSpecHiddenColumns(style: string): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(specHiddenColumns).where(eq(specHiddenColumns.style, style));
  return rows.map((r) => r.colour);
}

export async function hideSpecColumn(style: string, colour: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(specHiddenColumns).values({ style, colour }).onDuplicateKeyUpdate({ set: { colour } });
}

export async function showSpecColumn(style: string, colour: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(specHiddenColumns).where(
    and(eq(specHiddenColumns.style, style), eq(specHiddenColumns.colour, colour))
  );
}

// ─── Custom Lasts ─────────────────────────────────────────────────────────────

export async function getCustomLasts(season = "SS26"): Promise<Array<{ lastName: string; isRunOn: boolean }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ lastName: customLasts.lastName, isRunOn: customLasts.isRunOn })
    .from(customLasts)
    .where(eq(customLasts.season, season))
    .orderBy(customLasts.lastName);
  return rows.map((r) => ({ lastName: r.lastName, isRunOn: r.isRunOn ?? false }));
}

export async function addCustomLast(lastName: string, season = "SS26"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const name = lastName.toUpperCase().trim();
  // Insert (or upsert) the custom last for this season
  await db.insert(customLasts).values({ lastName: name, season }).onDuplicateKeyUpdate({ set: { lastName: name } });
  // Also remove from deleted_lasts so re-adding a previously deleted last works
  await db.delete(deletedLasts).where(and(eq(deletedLasts.lastName, name), eq(deletedLasts.season, season)));
}

export async function deleteCustomLast(lastName: string, season = "SS26"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customLasts).where(and(eq(customLasts.lastName, lastName), eq(customLasts.season, season)));
}

// ─── Reset Spec Colour Column ──────────────────────────────────────────────────

/**
 * Clears all spec values for a specific colour column within a style.
 * Deletes all style_specs rows for style+colour (template rows) and
 * clears the value field of all per-colour custom rows for that colour.
 */
export async function resetSpecColour(style: string, colour: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(styleSpecs)
    .where(and(eq(styleSpecs.style, style), eq(styleSpecs.colour, colour)));
  await db.update(specCustomRows)
    .set({ value: "" })
    .where(and(eq(specCustomRows.style, style), eq(specCustomRows.colour, colour)));
}

// ─── Spec Status ──────────────────────────────────────────────────────────────
/**
 * Sets the specStatus for a style in style_spec_meta.
 * Creates the row if it doesn't exist yet.
 */
export async function setSpecStatus(
  style: string,
  status: "not_started" | "in_progress" | "complete"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(styleSpecMeta)
    .values({ style, specStatus: status })
    .onDuplicateKeyUpdate({ set: { specStatus: status } });
}

/**
 * Checks whether every (style, colour, component) cell is filled for the given style.
 * Uses the saved rowKeys to determine which template components are expected,
 * and checks all non-cancelled colour columns.
 * Returns true only if every cell has a non-empty value.
 */
export async function checkAllSpecsFilled(
  style: string,
  colours: string[],
  rowKeys: string[]
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  if (colours.length === 0 || rowKeys.length === 0) return false;

  // Only check template rows (custom rows are optional)
  const templateComponents = rowKeys
    .filter((k) => k.startsWith("template:"))
    .map((k) => k.replace("template:", ""));

  if (templateComponents.length === 0) return false;

  // Count filled cells for this style
  const rows = await db
    .select({
      colour: styleSpecs.colour,
      component: styleSpecs.component,
      value: styleSpecs.value,
    })
    .from(styleSpecs)
    .where(
      and(
        eq(styleSpecs.style, style),
        sql`${styleSpecs.value} IS NOT NULL AND ${styleSpecs.value} != ''`
      )
    );

  const filledSet = new Set(rows.map((r) => `${r.colour}::${r.component}`));

  for (const colour of colours) {
    for (const component of templateComponents) {
      if (!filledSet.has(`${colour}::${component}`)) {
        return false;
      }
    }
  }
  return true;
}

/** Bulk update specStatus for multiple styles at once */
export async function bulkSetSpecStatus(
  styles: string[],
  status: "not_started" | "in_progress" | "complete"
): Promise<void> {
  if (styles.length === 0) return;
  const db = await getDb();
  if (!db) return;
  for (const style of styles) {
    await db
      .insert(styleSpecMeta)
      .values({ style, specStatus: status })
      .onDuplicateKeyUpdate({ set: { specStatus: status } });
  }
}

/**
 * Copy custom rows from a source style/colour to one or more target colours in a target style.
 * For each custom row in sourceRows:
 *   - If the target style already has a row with the same section+title, update it.
 *   - Otherwise, insert a new __all__ row (shared across all colours) with the source value.
 * This is used by the cross-style copy panel.
 */
export async function bulkCopyCustomRows(data: {
  targetStyle: string;
  targetColours: string[];
  /** Each item represents one custom row group from the source style */
  rows: Array<{
    section: string;
    title: string;
    value: string;
    sortOrder: number;
  }>;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const row of data.rows) {
    if (!row.value) continue;

    // Check if target style already has rows for this section+title
    const existing = await db.select().from(specCustomRows).where(
      and(
        eq(specCustomRows.style, data.targetStyle),
        eq(specCustomRows.section, row.section),
        eq(specCustomRows.title, row.title),
      )
    );

    if (existing.length === 0) {
      // No rows yet — insert a single __all__ row with the source value
      await db.insert(specCustomRows).values({
        style: data.targetStyle,
        colour: "__all__",
        section: row.section,
        title: row.title,
        value: row.value,
        sortOrder: row.sortOrder,
      });
    } else {
      // Rows exist — update all of them (both __all__ and per-colour) to the source value
      await db.update(specCustomRows)
        .set({ value: row.value })
        .where(
          and(
            eq(specCustomRows.style, data.targetStyle),
            eq(specCustomRows.section, row.section),
            eq(specCustomRows.title, row.title),
          )
        );
    }
  }
}

// ─── Last Measurements ───────────────────────────────────────────────────────

/**
 * Returns all last measurements grouped by lastName → { LENGTH: {size: value}, GIRTH: {size: value} }
 * Optionally filter to a specific lastName.
 */
export async function getLastMeasurements(lastName?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = lastName
    ? await db.select().from(lastMeasurements).where(eq(lastMeasurements.lastName, lastName))
    : await db.select().from(lastMeasurements);
  return rows;
}

export async function upsertLastMeasurement(lastName: string, measureType: "LENGTH" | "GIRTH", size: string, value: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(lastMeasurements).values({ lastName, measureType, size, value })
    .onDuplicateKeyUpdate({ set: { value } });
}


// ─── Markdown SKUs ────────────────────────────────────────────────────────────

export async function getMarkdownSkus(statusFilter?: "pending" | "deleted" | "restored") {
  const db = await getDb();
  if (!db) return [];
  const { markdownSkus } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  if (statusFilter) {
    return db.select().from(markdownSkus).where(eq(markdownSkus.status, statusFilter));
  }
  return db.select().from(markdownSkus);
}

/** Upsert a batch of markdown SKUs (flagged from scan).
 * - New SKUs are inserted as 'pending'.
 * - Existing 'pending' or 'restored' SKUs have their URL/title refreshed.
 * - Existing 'deleted' SKUs are left untouched (user already confirmed deletion).
 */
export async function flagMarkdownSkus(items: { styleCode: string; colour: string; productTitle?: string; sourceUrl?: string }[]) {
  const db = await getDb();
  if (!db) return 0;
  const { markdownSkus } = await import("../drizzle/schema");
  const { eq, and, sql } = await import("drizzle-orm");

  // Fetch all existing deleted entries so we can skip them
  const deletedRows = await db
    .select({ styleCode: markdownSkus.styleCode, colour: markdownSkus.colour })
    .from(markdownSkus)
    .where(eq(markdownSkus.status, "deleted"));
  const deletedSet = new Set(deletedRows.map(r => `${r.styleCode}|${r.colour}`));

  let flagged = 0;
  for (const item of items) {
    // Skip anything the user has already confirmed as deleted
    if (deletedSet.has(`${item.styleCode}|${item.colour}`)) continue;
    try {
      await db.insert(markdownSkus).values({
        styleCode: item.styleCode,
        colour: item.colour,
        productTitle: item.productTitle ?? null,
        sourceUrl: item.sourceUrl ?? null,
        status: "pending",
      }).onDuplicateKeyUpdate({
        set: {
          // Only refresh metadata — never reset status back to pending for deleted rows
          productTitle: item.productTitle ?? null,
          sourceUrl: item.sourceUrl ?? null,
          flaggedAt: new Date(),
        },
      });
      flagged++;
    } catch {}
  }
  return flagged;
}

export async function updateMarkdownSkuStatus(ids: number[], status: "pending" | "deleted" | "restored") {
  const db = await getDb();
  if (!db) return;
  const { markdownSkus } = await import("../drizzle/schema");
  const { inArray } = await import("drizzle-orm");
  if (ids.length === 0) return;
  await db.update(markdownSkus).set({ status }).where(inArray(markdownSkus.id, ids));
}

// ─── Handbag helpers ─────────────────────────────────────────────────────────

export async function getHandbagStyles() {
  const db = await getDb();
  if (!db) return [];
  const { handbagStyles } = await import("../drizzle/schema");
  const { asc } = await import("drizzle-orm");
  return db.select().from(handbagStyles).orderBy(asc(handbagStyles.style), asc(handbagStyles.colour));
}

export async function upsertHandbagStyle(item: {
  style: string; colour: string; material?: string; section?: string;
  notes?: string; rrp?: number | null; cost?: number | null; imageUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  const { handbagStyles } = await import("../drizzle/schema");
  const { sql } = await import("drizzle-orm");
  // Build update set — only include fields that were explicitly provided
  const updateSet: Record<string, unknown> = {};
  if (item.material !== undefined) updateSet.material = item.material;
  if (item.section !== undefined) updateSet.section = item.section;
  if (item.notes !== undefined) updateSet.notes = item.notes;
  if (item.rrp !== undefined) updateSet.rrp = item.rrp;
  if (item.cost !== undefined) updateSet.cost = item.cost;
  if (item.imageUrl !== undefined) updateSet.imageUrl = item.imageUrl;
  await db.insert(handbagStyles).values({
    style: item.style,
    colour: item.colour,
    material: item.material ?? null,
    section: item.section ?? null,
    notes: item.notes ?? null,
    rrp: item.rrp ?? null,
    cost: item.cost ?? null,
    imageUrl: item.imageUrl ?? null,
  }).onDuplicateKeyUpdate({
    set: Object.keys(updateSet).length > 0 ? updateSet as any : { material: sql`material` },
  });
}

export async function deleteHandbagStyle(style: string, colour: string) {
  const db = await getDb();
  if (!db) return;
  const { handbagStyles } = await import("../drizzle/schema");
  const { and, eq } = await import("drizzle-orm");
  await db.delete(handbagStyles).where(and(eq(handbagStyles.style, style), eq(handbagStyles.colour, colour)));
}

export async function getHandbagBuySessions() {
  const db = await getDb();
  if (!db) return [];
  const { handbagBuySessions } = await import("../drizzle/schema");
  const { desc } = await import("drizzle-orm");
  return db.select().from(handbagBuySessions).orderBy(desc(handbagBuySessions.createdAt));
}

export async function createHandbagBuySession(name: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const { handbagBuySessions } = await import("../drizzle/schema");
  const [result] = await db.insert(handbagBuySessions).values({ name });
  return { id: (result as any).insertId as number, name };
}

export async function deleteHandbagBuySession(id: number) {
  const db = await getDb();
  if (!db) return;
  const { handbagBuySessions, handbagBuyItems } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await db.delete(handbagBuyItems).where(eq(handbagBuyItems.sessionId, id));
  await db.delete(handbagBuySessions).where(eq(handbagBuySessions.id, id));
}

export async function getHandbagBuyItems(sessionId?: number) {
  const db = await getDb();
  if (!db) return [];
  const { handbagBuyItems } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  if (sessionId !== undefined) {
    return db.select().from(handbagBuyItems).where(eq(handbagBuyItems.sessionId, sessionId));
  }
  return db.select().from(handbagBuyItems);
}

export async function upsertHandbagBuyItem(item: {
  sessionId: number; style: string; colour: string;
  auQty: number; usaQty: number; nycQty: number;
}) {
  const db = await getDb();
  if (!db) return;
  const { handbagBuyItems } = await import("../drizzle/schema");
  await db.insert(handbagBuyItems).values({
    sessionId: item.sessionId,
    style: item.style,
    colour: item.colour,
    auQty: item.auQty,
    usaQty: item.usaQty,
    nycQty: item.nycQty,
  }).onDuplicateKeyUpdate({
    set: {
      auQty: item.auQty,
      usaQty: item.usaQty,
      nycQty: item.nycQty,
    },
  });
}

export async function deleteHandbagBuyItem(id: number) {
  const db = await getDb();
  if (!db) return;
  const { handbagBuyItems } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await db.delete(handbagBuyItems).where(eq(handbagBuyItems.id, id));
}

// ── Sales Analysis ──────────────────────────────────────────────────────────

export async function listSalesSnapshots() {
  const db = await getDb();
  if (!db) return [];
  const { salesSnapshots } = await import("../drizzle/schema");
  const { desc } = await import("drizzle-orm");
  return db.select().from(salesSnapshots).orderBy(desc(salesSnapshots.createdAt));
}

export async function createSalesSnapshot(name: string, rows: { style: string; colour: string; units: number }[]) {
  const db = await getDb();
  if (!db) return null;
  const { salesSnapshots, salesRows } = await import("../drizzle/schema");
  const [result] = await db.insert(salesSnapshots).values({ name });
  const snapshotId = (result as any).insertId as number;
  if (rows.length > 0) {
    await db.insert(salesRows).values(rows.map((r) => ({ snapshotId, style: r.style, colour: r.colour, units: r.units })));
  }
  return snapshotId;
}

export async function getSalesSnapshot(snapshotId: number) {
  const db = await getDb();
  if (!db) return [];
  const { salesRows } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  return db.select().from(salesRows).where(eq(salesRows.snapshotId, snapshotId));
}

export async function deleteSalesSnapshot(snapshotId: number) {
  const db = await getDb();
  if (!db) return;
  const { salesSnapshots, salesRows } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await db.delete(salesRows).where(eq(salesRows.snapshotId, snapshotId));
  await db.delete(salesSnapshots).where(eq(salesSnapshots.id, snapshotId));
}

// ── Handbag Rename ──────────────────────────────────────────────────────────

export async function renameHandbagStyle(oldStyle: string, newStyle: string) {
  const db = await getDb();
  if (!db) return;
  const { handbagStyles, handbagBuyItems } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(handbagStyles).set({ style: newStyle }).where(eq(handbagStyles.style, oldStyle));
  await db.update(handbagBuyItems).set({ style: newStyle }).where(eq(handbagBuyItems.style, oldStyle));
}

export async function renameHandbagColour(style: string, oldColour: string, newColour: string) {
  const db = await getDb();
  if (!db) return;
  const { handbagStyles, handbagBuyItems } = await import("../drizzle/schema");
  const { and, eq } = await import("drizzle-orm");
  await db.update(handbagStyles).set({ colour: newColour }).where(and(eq(handbagStyles.style, style), eq(handbagStyles.colour, oldColour)));
  await db.update(handbagBuyItems).set({ colour: newColour }).where(and(eq(handbagBuyItems.style, style), eq(handbagBuyItems.colour, oldColour)));
}

// ── Handbag Style Image ──────────────────────────────────────────────────────
export async function updateHandbagStyleImage(style: string, imageUrl: string | null) {
  const db = await getDb();
  if (!db) return;
  const { handbagStyles } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(handbagStyles).set({ styleImageUrl: imageUrl } as any).where(eq(handbagStyles.style, style));
}

// ── Colour Codes (AP21 Export) ───────────────────────────────────────────────
export async function getAllColourCodes() {
  const db = await getDb();
  if (!db) return [];
  const { colourCodes } = await import("../drizzle/schema");
  const { asc } = await import("drizzle-orm");
  return db.select().from(colourCodes).orderBy(asc(colourCodes.colourDescription));
}

export async function getColourCodeByDescription(description: string) {
  const db = await getDb();
  if (!db) return null;
  const { colourCodes } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const upper = description.toUpperCase();
  const rows = await db.select().from(colourCodes).where(eq(colourCodes.colourDescription, upper)).limit(1);
  return rows[0] ?? null;
}

export async function upsertColourCode(description: string, code: string) {
  const db = await getDb();
  if (!db) return;
  const { colourCodes } = await import("../drizzle/schema");
  const upper = description.toUpperCase();
  await db.insert(colourCodes)
    .values({ colourDescription: upper, colourCode: code })
    .onDuplicateKeyUpdate({ set: { colourCode: code } });
}

export async function getMissingColourCodes(descriptions: string[]) {
  if (descriptions.length === 0) return [];
  const db = await getDb();
  if (!db) return descriptions;
  const { colourCodes } = await import("../drizzle/schema");
  const { inArray } = await import("drizzle-orm");
  const uppers = descriptions.map((d) => d.toUpperCase());
  const found = await db.select({ colourDescription: colourCodes.colourDescription })
    .from(colourCodes)
    .where(inArray(colourCodes.colourDescription, uppers));
  const foundSet = new Set(found.map((r) => r.colourDescription));
  return uppers.filter((d) => !foundSet.has(d));
}

// ─── AP21 Size Range helpers ────────────────────────────────────────────────

export type Ap21SizeRange = "AU5-11" | "AU6-9" | "AU5-10" | "EU35-42" | "EU35-41";

/** Returns the AP21 size range for a style, defaulting to AU5-11 if not set. */
export async function getAp21SizeRange(style: string): Promise<Ap21SizeRange> {
  const db = await getDb();
  if (!db) return "AU5-11";
  const row = await db.select({ ap21SizeRange: styleMeta.ap21SizeRange })
    .from(styleMeta)
    .where(eq(styleMeta.style, style.toUpperCase()))
    .limit(1);
  return (row[0]?.ap21SizeRange as Ap21SizeRange) ?? "AU5-11";
}

/** Upserts the AP21 size range for a style. */
export async function setAp21SizeRange(style: string, sizeRange: Ap21SizeRange) {
  const db = await getDb();
  if (!db) return;
  const upper = style.toUpperCase();
  await db.insert(styleMeta)
    .values({ style: upper, ap21SizeRange: sizeRange })
    .onDuplicateKeyUpdate({ set: { ap21SizeRange: sizeRange } });
}

/** Returns a map of style → ap21SizeRange for all styles that have one set. */
export async function getAllAp21SizeRanges(): Promise<Record<string, Ap21SizeRange>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select({ style: styleMeta.style, ap21SizeRange: styleMeta.ap21SizeRange })
    .from(styleMeta);
  const result: Record<string, Ap21SizeRange> = {};
  for (const r of rows) {
    if (r.ap21SizeRange) result[r.style] = r.ap21SizeRange as Ap21SizeRange;
  }
  return result;
}

// ── AP21 Style Refs ──────────────────────────────────────────────────────────

export async function getAp21StyleRefs(style: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(ap21StyleRefs).where(eq(ap21StyleRefs.style, style)).limit(1);
  return rows[0] ?? null;
}

export async function upsertAp21StyleRefs(style: string, data: {
  subCategory?: string | null;
  rangeType?: string | null;
  toeShape?: string | null;
  upperHeight?: string | null;
  countryOfOrigin?: string | null;
  supplier?: string | null;
  hsCode?: string | null;
  season?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(ap21StyleRefs).values({ style, ...data }).onDuplicateKeyUpdate({
    set: { ...data, updatedAt: new Date() },
  });
}

export async function getAllAp21StyleRefs(): Promise<Record<string, typeof ap21StyleRefs.$inferSelect>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(ap21StyleRefs);
  const result: Record<string, typeof ap21StyleRefs.$inferSelect> = {};
  for (const r of rows) result[r.style] = r;
  return result;
}

// ── AP21 Colour Refs ─────────────────────────────────────────────────────────

export async function getAp21ColourRefs(style: string, colourKey: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(ap21ColourRefs)
    .where(and(eq(ap21ColourRefs.style, style), eq(ap21ColourRefs.colourKey, colourKey)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertAp21ColourRefs(style: string, colourKey: string, data: {
  upperMaterial?: string | null;
  soleMaterial?: string | null;
  liningMaterial?: string | null;
  season?: string | null;
  productStatus?: string | null;
  fabrication?: string | null;
  iconic?: string | null;
  webColourGroup?: string | null;
  occasion?: string | null;
  web?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(ap21ColourRefs).values({ style, colourKey, ...data }).onDuplicateKeyUpdate({
    set: { ...data, updatedAt: new Date() },
  });
}

export async function getAllAp21ColourRefsForStyle(style: string): Promise<Record<string, typeof ap21ColourRefs.$inferSelect>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(ap21ColourRefs).where(eq(ap21ColourRefs.style, style));
  const result: Record<string, typeof ap21ColourRefs.$inferSelect> = {};
  for (const r of rows) result[r.colourKey] = r;
  return result;
}

export async function getAllAp21ColourRefsAll(): Promise<Record<string, Record<string, typeof ap21ColourRefs.$inferSelect>>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(ap21ColourRefs);
  const result: Record<string, Record<string, typeof ap21ColourRefs.$inferSelect>> = {};
  for (const r of rows) {
    if (!result[r.style]) result[r.style] = {};
    result[r.style][r.colourKey] = r;
  }
  return result;
}

// ─── AP21 Export — Style Selector Helpers ────────────────────────────────────

/** Returns all styles that have never been exported to AP21 (ap21ExportedAt IS NULL). */
export async function getAp21UnexportedStyles(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ style: styleMeta.style })
    .from(styleMeta)
    .where(sql`${styleMeta.ap21ExportedAt} IS NULL`);
  return rows.map((r) => r.style);
}

/** Marks the given styles as exported to AP21 by setting ap21ExportedAt to now. */
export async function markStylesAsAp21Exported(styles: string[]): Promise<void> {
  if (!styles.length) return;
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  for (const style of styles) {
    await db
      .insert(styleMeta)
      .values({ style, ap21ExportedAt: now })
      .onDuplicateKeyUpdate({ set: { ap21ExportedAt: now } });
  }
}

/** Resets ap21ExportedAt to NULL for a style so it re-appears in the export checklist. */
export async function resetAp21ExportedAt(style: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(styleMeta)
    .set({ ap21ExportedAt: null as any })
    .where(eq(styleMeta.style, style));
}

/** Returns a map of style → ap21ExportedAt for all styles that have been exported. */
export async function getAp21ExportedStyles(): Promise<Record<string, Date>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select({ style: styleMeta.style, ap21ExportedAt: styleMeta.ap21ExportedAt })
    .from(styleMeta)
    .where(sql`${styleMeta.ap21ExportedAt} IS NOT NULL`);
  const result: Record<string, Date> = {};
  for (const r of rows) if (r.ap21ExportedAt) result[r.style] = r.ap21ExportedAt;
  return result;
}
