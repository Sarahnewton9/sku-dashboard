import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, fittingImages, skuMeta, styleMeta, users, buySessions, buySessionItems } from "../drizzle/schema";
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
  sampleStatus?: "waiting" | "received";
  orderQty?: number;
  isSize11?: boolean;
  costPrice?: number | null;
  fitRating?: "tts" | "runs_small" | "runs_large" | null;
  fittingNotes?: string | null;
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

// ─── Fitting Images ───────────────────────────────────────────────────────────

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
  if (!db) return undefined;
  const result = await db.select().from(buySessions)
    .where(eq(buySessions.isLocked, false))
    .orderBy(buySessions.createdAt)
    .limit(1);
  return result[0];
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

export async function getSessionTotals(): Promise<Record<number, number>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(buySessionItems);
  const totals: Record<number, number> = {};
  for (const row of rows) {
    totals[row.sessionId] = (totals[row.sessionId] ?? 0) + (row.qty ?? 0);
  }
  return totals;
}

export async function upsertBuySessionItem(sessionId: number, style: string, colour: string, leather: string, qty: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if item exists
  const existing = await db.select().from(buySessionItems)
    .where(and(
      eq(buySessionItems.sessionId, sessionId),
      eq(buySessionItems.style, style),
      eq(buySessionItems.colour, colour),
      eq(buySessionItems.leather, leather)
    ))
    .limit(1);
  if (existing.length > 0) {
    await db.update(buySessionItems)
      .set({ qty })
      .where(eq(buySessionItems.id, existing[0].id));
  } else {
    await db.insert(buySessionItems).values({ sessionId, style, colour, leather, qty });
  }
}
