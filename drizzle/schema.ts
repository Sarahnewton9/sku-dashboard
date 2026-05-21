import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float, boolean, uniqueIndex } from "drizzle-orm/mysql-core";

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
  sampleType: varchar("sampleType", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SkuMeta = typeof skuMeta.$inferSelect;
export type InsertSkuMeta = typeof skuMeta.$inferInsert;

/**
 * Per-style metadata: RRP, fit rating, fitting notes
 */
export const styleMeta = mysqlTable("style_meta", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull().unique(),
  rrp: float("rrp"),
  fitRating: mysqlEnum("fitRating", ["tts", "runs_small", "runs_large"]),
  fittingNotes: text("fittingNotes"),
  fitApproved: boolean("fitApproved").default(false).notNull(),
  /** Size recommendation when fit rating is runs_small or runs_large */
  sizeRecommendation: mysqlEnum("sizeRecommendation", ["half_size_up", "full_size_up", "half_size_down", "full_size_down"]),
  /** Image URL scraped from tonybianco.com.au — one representative image per style */
  websiteImageUrl: text("websiteImageUrl"),
  /** Shoe category — drives spec template and filtering across the app */
  category: varchar("category", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StyleMeta = typeof styleMeta.$inferSelect;
export type InsertStyleMeta = typeof styleMeta.$inferInsert;

/**
 * Fitting images — multiple images per SKU (legacy, kept for backwards compat)
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
 * Style-level fitting images — one set of images per style (not per SKU)
 */
export const styleFittingImages = mysqlTable("style_fitting_images", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StyleFittingImage = typeof styleFittingImages.$inferSelect;
export type InsertStyleFittingImage = typeof styleFittingImages.$inferInsert;

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
  qty: int("qty").default(0).notNull(),       // legacy — kept for backwards compat
  auQty: int("auQty").default(0).notNull(),   // AU buy quantity
  usaQty: int("usaQty").default(0).notNull(), // USA buy quantity
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BuySessionItem = typeof buySessionItems.$inferSelect;
export type InsertBuySessionItem = typeof buySessionItems.$inferInsert;

/**
 * Last approval status — tracks whether each last has been approved or is waiting on revisions
 */
export const lastApprovals = mysqlTable("last_approvals", {
  id: int("id").autoincrement().primaryKey(),
  lastName: varchar("lastName", { length: 128 }).notNull().unique(),
  status: mysqlEnum("status", ["approved", "waiting_revised"]).default("waiting_revised").notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LastApproval = typeof lastApprovals.$inferSelect;
export type InsertLastApproval = typeof lastApprovals.$inferInsert;

/**
 * Season imports — each upload of a Total Season Excel file
 */
export const seasonImports = mysqlTable("season_imports", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  rowCount: int("rowCount").default(0).notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type SeasonImport = typeof seasonImports.$inferSelect;
export type InsertSeasonImport = typeof seasonImports.$inferInsert;

/**
 * Season SKU data — one row per SKU per import
 * Stores the key metrics from the Total Season report
 */
export const seasonSkuData = mysqlTable("season_sku_data", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("importId").notNull(),
  style: varchar("style", { length: 64 }).notNull(),
  colour: varchar("colour", { length: 64 }).notNull(),
  leather: varchar("leather", { length: 128 }).notNull().default(""),
  colourDescription: varchar("colourDescription", { length: 128 }).notNull().default(""),
  subCategory: varchar("subCategory", { length: 64 }),
  auOrigPrice: float("auOrigPrice"),
  totalUnitsSold: int("totalUnitsSold").default(0).notNull(),
  lastWeekUnits: int("lastWeekUnits").default(0).notNull(),
  lastWeekSellThru: float("lastWeekSellThru").default(0).notNull(),
  avgWeeklySellThru: float("avgWeeklySellThru").default(0).notNull(),
  stdSellThru: float("stdSellThru"),
  totalSoh: int("totalSoh").default(0).notNull(),
});

export type SeasonSkuData = typeof seasonSkuData.$inferSelect;
export type InsertSeasonSkuData = typeof seasonSkuData.$inferInsert;

/**
 * Style specs — one row per (style, colour, component) combination
 * Stores the value for each spec field per colour per style
 */
export const styleSpecs = mysqlTable("style_specs", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull(),
  colour: varchar("colour", { length: 64 }).notNull(),
  component: varchar("component", { length: 128 }).notNull(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("style_colour_component_uniq").on(t.style, t.colour, t.component),
}));

export type StyleSpec = typeof styleSpecs.$inferSelect;
export type InsertStyleSpec = typeof styleSpecs.$inferInsert;

/**
 * Spec dropdown options — stores custom/additional dropdown values per component field
 * Seeded with defaults; users can add new values which are persisted here
 */
export const specDropdownOptions = mysqlTable("spec_dropdown_options", {
  id: int("id").autoincrement().primaryKey(),
  component: varchar("component", { length: 128 }).notNull(),
  value: varchar("value", { length: 256 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SpecDropdownOption = typeof specDropdownOptions.$inferSelect;
export type InsertSpecDropdownOption = typeof specDropdownOptions.$inferInsert;

/**
 * Style spec metadata — style-level spec settings (buckle Y/N, dress shoe sub-type, notes)
 */
export const styleSpecMeta = mysqlTable("style_spec_meta", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull().unique(),
  hasBuckle: boolean("hasBuckle").default(false).notNull(),
  dressShoeSubType: mysqlEnum("dressShoeSubType", ["court", "sling"]),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StyleSpecMeta = typeof styleSpecMeta.$inferSelect;
export type InsertStyleSpecMeta = typeof styleSpecMeta.$inferInsert;

/**
 * Fitting sessions — each represents one fitting event for a style
 * A style can have multiple sessions (e.g. fitted on different models)
 */
export const fittingSessions = mysqlTable("fitting_sessions", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull(),
  fitModel: varchar("fitModel", { length: 128 }).notNull().default(""),
  sessionDate: varchar("sessionDate", { length: 32 }).notNull().default(""),
  notes: text("notes"),
  sampleDate: varchar("sampleDate", { length: 32 }),
  sampleType: varchar("sampleType", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FittingSession = typeof fittingSessions.$inferSelect;
export type InsertFittingSession = typeof fittingSessions.$inferInsert;

/**
 * Fitting session images — images linked to a specific fitting session
 */
export const fittingSessionImages = mysqlTable("fitting_session_images", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  style: varchar("style", { length: 64 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FittingSessionImage = typeof fittingSessionImages.$inferSelect;
export type InsertFittingSessionImage = typeof fittingSessionImages.$inferInsert;

/**
 * Style image overrides — manual image uploads that replace the CDN image for a style
 */
export const styleImageOverrides = mysqlTable("style_image_overrides", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull().unique(),
  imageUrl: text("imageUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StyleImageOverride = typeof styleImageOverrides.$inferSelect;
export type InsertStyleImageOverride = typeof styleImageOverrides.$inferInsert;

/**
 * Cancelled styles — styles that have been removed from the active range
 * Can be restored at any time
 */
export const cancelledStyles = mysqlTable("cancelled_styles", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull().unique(),
  cancelledAt: timestamp("cancelledAt").defaultNow().notNull(),
});

export type CancelledStyle = typeof cancelledStyles.$inferSelect;
export type InsertCancelledStyle = typeof cancelledStyles.$inferInsert;

/**
 * Deleted lasts — lasts that have been removed from the Last Approval page.
 * Persists across page refreshes.
 */
export const deletedLasts = mysqlTable("deleted_lasts", {
  id: int("id").autoincrement().primaryKey(),
  lastName: varchar("lastName", { length: 128 }).notNull().unique(),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
});

export type DeletedLast = typeof deletedLasts.$inferSelect;
export type InsertDeletedLast = typeof deletedLasts.$inferInsert;
/**
 * Custom SKUs — colours/leathers added manually during the buying process.
 * These are treated as new SKUs and appear across all dashboard sections.
 */
export const customSkus = mysqlTable("custom_skus", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull(),
  colour: varchar("colour", { length: 64 }).notNull(),
  leather: varchar("leather", { length: 64 }).notNull().default(""),
  isNew: boolean("is_new").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CustomSku = typeof customSkus.$inferSelect;
export type InsertCustomSku = typeof customSkus.$inferInsert;

/**
 * Cancelled SKUs — individual colour/leather combos removed from the active range.
 * Can be restored at any time.
 */
export const cancelledSkus = mysqlTable("cancelled_skus", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull(),
  colour: varchar("colour", { length: 64 }).notNull(),
  leather: varchar("leather", { length: 64 }).notNull().default(""),
  cancelledAt: timestamp("cancelledAt").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("cancelled_skus_uniq").on(t.style, t.colour, t.leather),
}));

export type CancelledSku = typeof cancelledSkus.$inferSelect;
export type InsertCancelledSku = typeof cancelledSkus.$inferInsert;

/**
 * Style sub-category overrides — maps styles to their specific sub-category
 * (e.g. Wedge -> Casual Wedge, Ankle Boot -> Dress Ankle Boot)
 */
export const styleSubCategories = mysqlTable("style_sub_categories", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull().unique(),
  subCategory: varchar("subCategory", { length: 64 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StyleSubCategory = typeof styleSubCategories.$inferSelect;
export type InsertStyleSubCategory = typeof styleSubCategories.$inferInsert;

/**
 * Style trend flags — marks Ballet Flat and Loafer styles as trend flags
 * These styles have their category overridden to CASUAL FLAT in the UI
 */
export const styleTrendFlags = mysqlTable("style_trend_flags", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull().unique(),
  trendFlag: varchar("trendFlag", { length: 64 }).notNull(), // e.g. "Ballet Flat", "Loafer"
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StyleTrendFlag = typeof styleTrendFlags.$inferSelect;
export type InsertStyleTrendFlag = typeof styleTrendFlags.$inferInsert;

/**
 * Fitting groups — named collections of styles for a fitting session
 * e.g. "Week 1 Fitting", "Factory Visit March"
 */
export const fittingGroups = mysqlTable("fitting_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  sessionDate: varchar("sessionDate", { length: 32 }).notNull().default(""),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FittingGroup = typeof fittingGroups.$inferSelect;
export type InsertFittingGroup = typeof fittingGroups.$inferInsert;

/**
 * Fitting group styles — styles belonging to a fitting group
 */
export const fittingGroupStyles = mysqlTable("fitting_group_styles", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  style: varchar("style", { length: 64 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("fitting_group_styles_uniq").on(t.groupId, t.style),
}));

export type FittingGroupStyle = typeof fittingGroupStyles.$inferSelect;
export type InsertFittingGroupStyle = typeof fittingGroupStyles.$inferInsert;

/**
 * Spec custom rows — free-form rows added by the user inside a spec section
 * e.g. section=upper, title="Flower", value="Yes" for JAYDE
 * One row per (style, colour, section, sortOrder) — sortOrder is used for ordering within a section
 */
export const specCustomRows = mysqlTable("spec_custom_rows", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull(),
  colour: varchar("colour", { length: 64 }).notNull().default("__all__"),
  section: varchar("section", { length: 64 }).notNull(),
  title: varchar("title", { length: 256 }).notNull().default(""),
  value: text("value").default(""),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SpecCustomRow = typeof specCustomRows.$inferSelect;
export type InsertSpecCustomRow = typeof specCustomRows.$inferInsert;

/**
 * PPTX import log — stores the S3 key of each uploaded range review PPTX
 * so the fixed parser can re-scan past imports for missed SKUs.
 */
export const pptxImports = mysqlTable("pptx_imports", {
  id: int("id").autoincrement().primaryKey(),
  fileKey: varchar("file_key", { length: 512 }).notNull(),
  fileName: varchar("file_name", { length: 256 }).notNull().default(""),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});
export type PptxImport = typeof pptxImports.$inferSelect;
export type InsertPptxImport = typeof pptxImports.$inferInsert;

/**
 * Heel heights per last — only relevant for Dress Shoe, Dress Sandal, and Wedge categories.
 * Scraped from tonybianco.com.au product descriptions; editable via the admin UI.
 */
export const lastHeelHeights = mysqlTable("last_heel_heights", {
  id: int("id").autoincrement().primaryKey(),
  lastName: varchar("last_name", { length: 128 }).notNull().unique(),
  heelHeightCm: float("heel_height_cm").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LastHeelHeight = typeof lastHeelHeights.$inferSelect;
export type InsertLastHeelHeight = typeof lastHeelHeights.$inferInsert;

/**
 * Custom styles — brand-new styles added manually (not yet in the static skuData).
 * Linked to a last so they appear in the Last Approval tab and all downstream tabs.
 */
export const customStyles = mysqlTable("custom_styles", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull().unique(),
  lastName: varchar("last_name", { length: 128 }).notNull(),
  category: varchar("category", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CustomStyle = typeof customStyles.$inferSelect;
export type InsertCustomStyle = typeof customStyles.$inferInsert;

/**
 * SKU new/existing override — allows manually overriding the is_new flag from static skuData.
 * When a row exists here, it takes precedence over the static data.
 */
export const skuNewOverride = mysqlTable("sku_new_override", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull(),
  colour: varchar("colour", { length: 64 }).notNull(),
  leather: varchar("leather", { length: 64 }).notNull().default(""),
  isNew: boolean("isNew").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  skuIdx: uniqueIndex("sku_new_override_sku_idx").on(t.style, t.colour, t.leather),
}));
export type SkuNewOverride = typeof skuNewOverride.$inferSelect;
export type InsertSkuNewOverride = typeof skuNewOverride.$inferInsert;

/**
 * Spec row order — stores the custom row order for a style's spec form.
 * rowKeys is a JSON array of strings like ["template:upper_1", "custom:42", "template:lining", ...].
 * If a template key is absent from the array it is treated as hidden/deleted.
 * If no row exists for a style the default template order is used.
 */
export const specRowOrder = mysqlTable("spec_row_order", {
  id: int("id").autoincrement().primaryKey(),
  style: varchar("style", { length: 64 }).notNull().unique(),
  rowKeys: text("row_keys").notNull(), // JSON array of "template:key" | "custom:id"
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SpecRowOrder = typeof specRowOrder.$inferSelect;
export type InsertSpecRowOrder = typeof specRowOrder.$inferInsert;
