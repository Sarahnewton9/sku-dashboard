import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Per-SKU metadata: sample status, order qty, size 11 flag, cost price, fitting info
 */
export const skuMeta = mysqlTable("sku_meta", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull(),
  colour: varchar("colour", { length: 64 }).notNull(),
  leather: varchar("leather", { length: 64 }).notNull().default(""),
  sampleStatus: mysqlEnum("sampleStatus", ["waiting", "received"]).default("waiting").notNull(),
  orderQty: int("orderQty").default(0),
  isSize11: boolean("isSize11").default(false).notNull(),
  costPrice: float("costPrice"),
  fitRating: mysqlEnum("fitRating", ["tts", "runs_small", "runs_large"]),
  fittingNotes: text("fittingNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SkuMeta = typeof skuMeta.$inferSelect;
export type InsertSkuMeta = typeof skuMeta.$inferInsert;

/**
 * Per-style metadata: RRP
 */
export const styleMeta = mysqlTable("style_meta", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull().unique(),
  rrp: float("rrp"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StyleMeta = typeof styleMeta.$inferSelect;
export type InsertStyleMeta = typeof styleMeta.$inferInsert;

/**
 * Fitting images — multiple images per SKU
 */
export const fittingImages = mysqlTable("fitting_images", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull(),
  colour: varchar("colour", { length: 64 }).notNull(),
  leather: varchar("leather", { length: 64 }).notNull().default(""),
  imageUrl: text("imageUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  uploadedBy: varchar("uploadedBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FittingImage = typeof fittingImages.$inferSelect;
export type InsertFittingImage = typeof fittingImages.$inferInsert;

/**
 * Buy sessions — each represents one weekly/periodic buy round
 * e.g. "Week 1 Buy — 2024-04-21"
 */
export const buySessions = mysqlTable("buy_sessions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  isLocked: boolean("isLocked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lockedAt: timestamp("lockedAt"),
});

export type BuySession = typeof buySessions.$inferSelect;
export type InsertBuySession = typeof buySessions.$inferInsert;

/**
 * Buy session items — one row per SKU per session
 */
export const buySessionItems = mysqlTable("buy_session_items", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  style: varchar("style", { length: 64 }).notNull(),
  colour: varchar("colour", { length: 64 }).notNull(),
  leather: varchar("leather", { length: 64 }).notNull().default(""),
  qty: int("qty").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BuySessionItem = typeof buySessionItems.$inferSelect;
export type InsertBuySessionItem = typeof buySessionItems.$inferInsert;