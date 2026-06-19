import { and, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, fittingImages, skuMeta, styleMeta, styleFittingImages, users, buySessions, buySessionItems, lastApprovals, seasonImports, seasonSkuData, InsertSeasonSkuData, styleSpecs, specDropdownOptions, styleSpecMeta, fittingSessions, fittingSessionImages, styleImageOverrides, cancelledStyles, customSkus, cancelledSkus, styleSubCategories, styleTrendFlags, fittingGroups, fittingGroupStyles, FittingGroup, specCustomRows, SpecCustomRow, deletedLasts, pptxImports, lastHeelHeights, skuNewOverride, customStyles, specRowOrder, specHiddenColumns, customLasts } from "../drizzle/schema";
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

export async function getAllBuySessions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(buySessions).orderBy(buySessions.createdAt);
}

export async function getActiveBuySession() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(buySessions)
    .where(eq(buySessions.isLocked, false))
    .orderBy(buySessions.createdAt)
    .limit(1);
  return result[0] ?? null;
}

export async function createBuySession(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(buySessions).values({ name, isLocked: false });
  // Return the newly created session
  const result = await db.select().from(buySessions)
    .where(eq(buySessions.name, name))
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

export async function getSessionTotals(): Promise<Record<number, { au: number; usa: number; nyc: number; total: number }>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(buySessionItems);
  const totals: Record<number, { au: number; usa: number; nyc: number; total: number }> = {};
  for (const row of rows) {
    const au = row.auQty ?? 0;
    const usa = row.usaQty ?? 0;
    const nyc = row.nycQty ?? 0;
    if (!totals[row.sessionId]) totals[row.sessionId] = { au: 0, usa: 0, nyc: 0, total: 0 };
    totals[row.sessionId].au += au;
    totals[row.sessionId].usa += usa;
    totals[row.sessionId].nyc += nyc;
    totals[row.sessionId].total += au + usa + nyc;
  }
  return totals;
}

/**
 * Returns per-SKU totals across ALL sessions, plus a per-session breakdown.
 * Key: "style|colour|leather"
 * Only includes SKUs with at least 1 unit bought.
 */
export async function getAllSessionQtys(): Promise<Record<string, {
  totalAu: number;
  totalUsa: number;
  totalNyc: number;
  total: number;
  sessions: Array<{ sessionId: number; sessionName: string; au: number; usa: number; nyc: number }>;
}>> {
  const db = await getDb();
  if (!db) return {};
  const [items, sessions] = await Promise.all([
    db.select().from(buySessionItems),
    db.select().from(buySessions),
  ]);
  const sessionMap: Record<number, string> = {};
  for (const s of sessions) sessionMap[s.id] = s.name;
  const result: Record<string, { totalAu: number; totalUsa: number; totalNyc: number; total: number; sessions: Array<{ sessionId: number; sessionName: string; au: number; usa: number; nyc: number }> }> = {};
  for (const row of items) {
    const au = row.auQty ?? 0;
    const usa = row.usaQty ?? 0;
    const nyc = row.nycQty ?? 0;
    if (au === 0 && usa === 0 && nyc === 0) continue;
    const key = `${row.style}|${row.colour}|${row.leather}`;
    if (!result[key]) result[key] = { totalAu: 0, totalUsa: 0, totalNyc: 0, total: 0, sessions: [] };
    result[key].totalAu += au;
    result[key].totalUsa += usa;
    result[key].totalNyc += nyc;
    result[key].total += au + usa + nyc;
    result[key].sessions.push({ sessionId: row.sessionId, sessionName: sessionMap[row.sessionId] ?? `Session ${row.sessionId}`, au, usa, nyc });
  }
  return result;
}

export async function upsertBuySessionItem(
  sessionId: number, style: string, colour: string, leather: string,
  auQty: number, usaQty: number, nycQty: number = 0
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
  const qty = auQty + usaQty + nycQty; // keep legacy qty in sync
  if (existing.length > 0) {
    await db.update(buySessionItems)
      .set({ auQty, usaQty, nycQty, qty })
      .where(eq(buySessionItems.id, existing[0].id));
  } else {
    await db.insert(buySessionItems).values({ sessionId, style, colour, leather, auQty, usaQty, nycQty, qty });
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

export async function getAllLastApprovals() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lastApprovals);
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

export async function getDeletedLasts(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(deletedLasts);
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
export async function createFittingSession(data: { style: string; fitModel: string; sessionDate: string; notes?: string; sampleDate?: string | null; sampleType?: string | null; sampleSize?: string | null }): Promise<number> {
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

export async function getFittingSessionsForStyle(style: string): Promise<Array<{
  id: number; style: string; fitModel: string; sessionDate: string; notes: string | null; sampleDate: string | null; sampleType: string | null; createdAt: Date;
  images: Array<{ id: number; imageUrl: string; fileKey: string; createdAt: Date }>;
}>> {
  const db = await getDb();
  if (!db) return [];
  const sessions = await db.select().from(fittingSessions).where(eq(fittingSessions.style, style)).orderBy(fittingSessions.sessionDate);
  const images = await db.select().from(fittingSessionImages).where(eq(fittingSessionImages.style, style));
  return sessions.map((s) => ({
    ...s,
    images: images.filter((img) => img.sessionId === s.id),
  }));
}

export async function getAllFittingSessions(): Promise<Array<{
  id: number; style: string; fitModel: string; sessionDate: string; notes: string | null; sampleDate: string | null; sampleType: string | null; createdAt: Date;
  images: Array<{ id: number; sessionId: number; style: string; imageUrl: string; fileKey: string; createdAt: Date }>;
}>> {
  const db = await getDb();
  if (!db) return [];
  const sessions = await db.select().from(fittingSessions).orderBy(fittingSessions.style, fittingSessions.sessionDate);
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
export async function addCustomSku(style: string, colour: string, leather: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Prevent duplicates — check if this exact style/colour/leather already exists
  const existing = await db.select({ id: customSkus.id }).from(customSkus)
    .where(and(eq(customSkus.style, style), eq(customSkus.colour, colour), eq(customSkus.leather, leather)))
    .limit(1);
  if (existing.length > 0) throw new Error(`SKU already exists: ${style} ${colour} ${leather}`);
  const result = await db.insert(customSkus).values({ style, colour, leather });
  return (result[0] as any).insertId as number;
}

export async function getAllCustomSkus(): Promise<{ id: number; style: string; colour: string; leather: string; isNew: boolean; createdAt: Date }[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customSkus);
}

export async function deleteCustomSku(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customSkus).where(eq(customSkus.id, id));
}

// ─── Custom Styles ────────────────────────────────────────────────────────────
export async function getAllCustomStyles(): Promise<{ id: number; style: string; lastName: string; category: string | null; createdAt: Date }[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customStyles);
}

export async function addCustomStyle(style: string, lastName: string, category?: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customStyles).values({ style, lastName, category: category ?? null });
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
  return db.select().from(styleTrendFlags);
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

export async function getCustomLasts(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ lastName: customLasts.lastName }).from(customLasts).orderBy(customLasts.lastName);
  return rows.map((r) => r.lastName);
}

export async function addCustomLast(lastName: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const name = lastName.toUpperCase().trim();
  // Insert (or upsert) the custom last
  await db.insert(customLasts).values({ lastName: name }).onDuplicateKeyUpdate({ set: { lastName: name } });
  // Also remove from deleted_lasts so re-adding a previously deleted last works
  await db.delete(deletedLasts).where(eq(deletedLasts.lastName, name));
}

export async function deleteCustomLast(lastName: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customLasts).where(eq(customLasts.lastName, lastName));
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
