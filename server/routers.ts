import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import axios from "axios";
import {
  getAllSkuMeta, upsertSkuMeta,
  getAllStyleMeta, upsertStyleRrp, upsertStyleFit,
  getStyleFittingImages, getAllStyleFittingImages, addStyleFittingImage, deleteStyleFittingImage,
  getFittingImages, addFittingImage, deleteFittingImage, getAllFittingImages,
  getAllBuySessions, getActiveBuySession, createBuySession, lockBuySession, deleteBuySession,
  getBuySessionItems, upsertBuySessionItem, getSessionTotals,
  getAllLastApprovals, upsertLastApproval,
  getAllSeasonImports, createSeasonImport, getSeasonSkuData, deleteSeasonImport,
  getSpecsForStyle, upsertStyleSpec, deleteStyleSpecs,
  getAllDropdownOptions, getDropdownOptions, addDropdownOption, deleteDropdownOption,
  getStyleSpecMeta, getAllStyleSpecMeta, upsertStyleSpecMeta,
  getSpecCountsForAllStyles,
  createFittingSession, updateFittingSession, deleteFittingSession, getFittingSessionsForStyle, getAllFittingSessions,
  addFittingSessionImage, deleteFittingSessionImage,
  upsertStyleImageOverride, deleteStyleImageOverride, getAllStyleImageOverrides,
  cancelStyle, restoreStyle, listCancelledStyles,
  addCustomSku, getAllCustomSkus, deleteCustomSku,
  unlockBuySession,
  cancelSku, restoreSku, listCancelledSkus,
  getAllStyleSubCategories, upsertStyleSubCategory,
  getAllStyleTrendFlags,
  upsertStyleWebsiteImage,
  getAllStyleWebsiteImages,
  createFittingGroup, getAllFittingGroups, updateFittingGroup, deleteFittingGroup, addStyleToFittingGroup, removeStyleFromFittingGroup,
  getSpecCustomRowsForStyle, upsertSpecCustomRow, deleteSpecCustomRow,
} from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // SKU metadata: sample status, order qty, size11, cost, fitting notes
  sku: router({
    getAll: publicProcedure.query(async () => getAllSkuMeta()),

    update: publicProcedure
      .input(z.object({
        style: z.string(),
        colour: z.string(),
        leather: z.string().default(""),
        sampleStatus: z.enum(["waiting", "received"]).optional(),
        orderQty: z.number().int().min(0).optional(),
        isSize11: z.boolean().optional(),
        costPrice: z.number().nullable().optional(),
        fitRating: z.enum(["tts", "runs_small", "runs_large"]).nullable().optional(),
        fittingNotes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertSkuMeta(input);
        return { success: true };
      }),

    // Set Size 11 for ALL SKUs in a style at once
    updateStyleSize11: publicProcedure
      .input(z.object({
        style: z.string(),
        skus: z.array(z.object({ colour: z.string(), leather: z.string().default("") })),
        isSize11: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        for (const sku of input.skus) {
          await upsertSkuMeta({ style: input.style, colour: sku.colour, leather: sku.leather, isSize11: input.isSize11 });
        }
        return { updated: input.skus.length };
      }),

    importCosts: publicProcedure
      .input(z.array(z.object({
        style: z.string(),
        colour: z.string(),
        leather: z.string().default(""),
        cost: z.number(),
      })))
      .mutation(async ({ input }) => {
        let updated = 0;
        for (const item of input) {
          await upsertSkuMeta({ style: item.style, colour: item.colour, leather: item.leather, costPrice: item.cost });
          updated++;
        }
        return { updated };
      }),

    // Fetch size 11 availability from tonybianco.com.au Shopify API
    // Uses the 'available:size:11' and 'hidden:size:11' product tags to determine availability
    fetchSize11FromTonyBianco: publicProcedure
      .input(z.object({
        // All SKUs to update, grouped by style
        skusByStyle: z.record(z.string(), z.array(z.object({
          colour: z.string(),
          leather: z.string().default(""),
        }))),
      }))
      .mutation(async ({ input }) => {
        const headers = {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        };

        // Fetch all pages from Shopify products.json
        const styleSize11Map: Record<string, boolean> = {};
        let page = 1;
        while (page <= 10) {
          const url = `https://tonybianco.com.au/collections/all/products.json?limit=250&page=${page}`;
          const resp = await axios.get(url, { headers, timeout: 30000 });
          const products = resp.data?.products ?? [];
          if (!products.length) break;

          for (const p of products) {
            const title: string = p.title?.trim() ?? "";
            const styleName = title.split(" ")[0]?.toUpperCase();
            if (!styleName) continue;

            const tags: string[] = p.tags ?? [];
            let has11: boolean;
            if (tags.includes("available:size:11")) {
              has11 = true;
            } else if (tags.includes("hidden:size:11")) {
              has11 = false;
            } else {
              // Fallback: check variants
              has11 = (p.variants ?? []).some((v: Record<string, string>) =>
                [v.option1, v.option2, v.option3].includes("11")
              );
            }

            // True wins — if any colourway has size 11, the style has size 11
            if (!(styleName in styleSize11Map) || has11) {
              styleSize11Map[styleName] = has11;
            }
          }

          if (products.length < 250) break;
          page++;
          await new Promise((r) => setTimeout(r, 300));
        }

        // Apply to all SKUs in the input
        let updated = 0;
        const results: { style: string; isSize11: boolean }[] = [];
        for (const [style, skus] of Object.entries(input.skusByStyle)) {
          const isSize11 = styleSize11Map[style.toUpperCase()];
          if (isSize11 === undefined) continue; // style not found on website — skip
          for (const sku of skus) {
            await upsertSkuMeta({ style, colour: sku.colour, leather: sku.leather, isSize11 });
            updated++;
          }
          results.push({ style, isSize11 });
        }

        return {
          updated,
          results,
          totalWebsiteStyles: Object.keys(styleSize11Map).length,
          matchedStyles: results.length,
          notFoundStyles: Object.keys(input.skusByStyle).filter(
            (s) => !(s.toUpperCase() in styleSize11Map)
          ),
        };
      }),
  }),

  // Style metadata: RRP
  style: router({
    getAll: publicProcedure.query(async () => getAllStyleMeta()),

    importRrp: publicProcedure
      .input(z.array(z.object({ style: z.string(), rrp: z.number() })))
      .mutation(async ({ input }) => {
        let updated = 0;
        for (const item of input) {
          await upsertStyleRrp(item.style, item.rrp);
          updated++;
        }
        return { updated };
      }),

    // Fetch RRPs from Tony Bianco AU Shopify API and bulk-import them
    fetchFromTonyBianco: publicProcedure
      .input(z.object({
        styleNames: z.array(z.string()), // style names to match against
      }))
      .mutation(async ({ input }) => {
        const headers = {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

        // Fetch all pages from Shopify products.json
        const allProducts: Record<string, number> = {};
        let page = 1;
        while (page <= 30) {
          const url = `https://tonybianco.com.au/products.json?limit=250&page=${page}`;
          const resp = await axios.get(url, { headers, timeout: 30000 });
          const products = resp.data?.products ?? [];
          if (!products.length) break;
          for (const p of products) {
            const name: string = p.title?.trim();
            const price = parseFloat(p.variants?.[0]?.price ?? "0");
            if (name && price > 0 && !allProducts[name]) {
              allProducts[name] = price;
            }
          }
          page++;
          await new Promise((r) => setTimeout(r, 300));
        }

        // Match products to style names
        const styleRrp: Record<string, number[]> = {};
        for (const [productName, price] of Object.entries(allProducts)) {
          for (const style of input.styleNames) {
            const regex = new RegExp(`^${style.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
            if (regex.test(productName)) {
              if (!styleRrp[style]) styleRrp[style] = [];
              styleRrp[style].push(price);
              break;
            }
          }
        }

        // Always use the HIGHEST price per style — markdowns are excluded, full price is the max
        let updated = 0;
        const results: { style: string; rrp: number }[] = [];
        for (const [style, prices] of Object.entries(styleRrp)) {
          const rrp = Math.max(...prices);
          await upsertStyleRrp(style, rrp);
          results.push({ style, rrp });
          updated++;
        }

        return { updated, results, totalProducts: Object.keys(allProducts).length };
      }),

    // Fetch style images from tonybianco.com.au Shopify API and store in DB
    fetchImages: publicProcedure
      .input(z.object({
        styleNames: z.array(z.string()), // style names to match against (uppercase)
      }))
      .mutation(async ({ input }) => {
        const headers = {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

        // Fetch all pages from Shopify products.json and build style code -> first image map
        // Products have a StyleCode~ tag (e.g. "StyleCode~EDGY") that matches our style names
        const styleImageMap: Record<string, string> = {};
        let page = 1;
        while (page <= 30) {
          const url = `https://tonybianco.com.au/products.json?limit=250&page=${page}`;
          const resp = await axios.get(url, { headers, timeout: 30000 });
          const products = resp.data?.products ?? [];
          if (!products.length) break;
          for (const p of products) {
            // Extract StyleCode from tags
            const tags: string[] = p.tags ?? [];
            const styleCodeTag = tags.find((t: string) => t.startsWith("StyleCode~"));
            if (!styleCodeTag) continue;
            const styleCode = styleCodeTag.split("~")[1]?.toUpperCase();
            if (!styleCode || styleCode.startsWith("B-")) continue; // skip bags
            // Only store the first image found for each style code
            if (!styleImageMap[styleCode]) {
              const images = p.images ?? [];
              if (images.length > 0) {
                styleImageMap[styleCode] = images[0].src as string;
              }
            }
          }
          page++;
          await new Promise((r) => setTimeout(r, 300));
        }

        // Match our style names against the fetched style codes and save to DB
        let updated = 0;
        const results: { style: string; imageUrl: string | null; found: boolean }[] = [];
        for (const styleName of input.styleNames) {
          const imageUrl = styleImageMap[styleName.toUpperCase()] ?? null;
          await upsertStyleWebsiteImage(styleName, imageUrl);
          results.push({ style: styleName, imageUrl, found: !!imageUrl });
          if (imageUrl) updated++;
        }

        return { updated, total: input.styleNames.length, results };
      }),

    // Get all stored website image URLs
    getImages: publicProcedure.query(async () => getAllStyleWebsiteImages()),
  }),

  // Buy sessions
  buy: router({
    getSessions: publicProcedure.query(async () => getAllBuySessions()),

    getSessionTotals: publicProcedure.query(async () => getSessionTotals()),

    getActive: publicProcedure.query(async () => getActiveBuySession()),

    getItems: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => getBuySessionItems(input.sessionId)),

    create: publicProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const session = await createBuySession(input.name);
        return session;
      }),

    lock: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        await lockBuySession(input.sessionId);
        return { success: true };
      }),

    upsertItem: publicProcedure
      .input(z.object({
        sessionId: z.number(),
        style: z.string(),
        colour: z.string(),
        leather: z.string().default(""),
        auQty: z.number().int().min(0).default(0),
        usaQty: z.number().int().min(0).default(0),
      }))
      .mutation(async ({ input }) => {
        await upsertBuySessionItem(input.sessionId, input.style, input.colour, input.leather, input.auQty, input.usaQty);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBuySession(input.sessionId);
        return { success: true };
      }),

    unlock: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        await unlockBuySession(input.sessionId);
        return { success: true };
      }),
  }),

  // Last approvals
  lastApproval: router({
    getAll: publicProcedure.query(async () => getAllLastApprovals()),

    upsert: publicProcedure
      .input(z.object({
        lastName: z.string(),
        status: z.enum(["approved", "waiting_revised"]),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertLastApproval(input.lastName, input.status, input.notes ?? null);
        return { success: true };
      }),
  }),

  // Style-level fitting (fit rating, notes, images)
  styleFitting: router({
    getAll: publicProcedure.query(async () => getAllStyleFittingImages()),

    getImages: publicProcedure
      .input(z.object({ style: z.string() }))
      .query(async ({ input }) => getStyleFittingImages(input.style)),

    updateFit: publicProcedure
      .input(z.object({
        style: z.string(),
        fitRating: z.enum(["tts", "runs_small", "runs_large"]).nullable().optional(),
        fittingNotes: z.string().nullable().optional(),
        fitApproved: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertStyleFit(input.style, input.fitRating ?? null, input.fittingNotes ?? null, input.fitApproved);
        return { success: true };
      }),

    uploadImage: publicProcedure
      .input(z.object({
        style: z.string(),
        imageData: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const base64 = input.imageData.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const fileKey = `style-fitting/${input.style}-${nanoid(8)}.jpg`.replace(/\s+/g, "_");
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        const saved = await addStyleFittingImage({ style: input.style, imageUrl: url, fileKey });
        return { id: saved?.id, url, fileKey };
      }),

    deleteImage: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteStyleFittingImage(input.id);
        return { success: true };
      }),
  }),

  // Fitting images (legacy SKU-level)
  fitting: router({
    getImages: publicProcedure
      .input(z.object({ style: z.string(), colour: z.string(), leather: z.string().default("") }))
      .query(async ({ input }) => getFittingImages(input.style, input.colour, input.leather)),

    getAllImages: publicProcedure.query(async () => getAllFittingImages()),

    uploadImage: publicProcedure
      .input(z.object({
        style: z.string(),
        colour: z.string(),
        leather: z.string().default(""),
        imageData: z.string(),
        mimeType: z.string().default("image/jpeg"),
        uploadedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const base64 = input.imageData.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const fileKey = `fitting-images/${input.style}-${input.colour}-${input.leather}-${nanoid(8)}.jpg`.replace(/\s+/g, "_");
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        await addFittingImage({ style: input.style, colour: input.colour, leather: input.leather, imageUrl: url, fileKey, uploadedBy: input.uploadedBy });
        return { url, fileKey };
      }),

    deleteImage: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFittingImage(input.id);
        return { success: true };
      }),
  }),

  // Season Analysis — import Total Season Excel files and analyse vs current range
  season: router({
    getAll: publicProcedure.query(async () => getAllSeasonImports()),

    getData: publicProcedure
      .input(z.object({ importId: z.number() }))
      .query(async ({ input }) => getSeasonSkuData(input.importId)),

    import: publicProcedure
      .input(z.object({
        label: z.string(),
        rows: z.array(z.object({
          style: z.string(),
          colour: z.string(),
          leather: z.string().default(""),
          colourDescription: z.string().default(""),
          subCategory: z.string().nullable().optional(),
          auOrigPrice: z.number().nullable().optional(),
          totalUnitsSold: z.number().int().default(0),
          lastWeekUnits: z.number().int().default(0),
          lastWeekSellThru: z.number().default(0),
          avgWeeklySellThru: z.number().default(0),
          stdSellThru: z.number().nullable().optional(),
          totalSoh: z.number().int().default(0),
        })),
      }))
      .mutation(async ({ input }) => {
        const newImport = await createSeasonImport(input.label, input.rows);
        return { success: true, importId: newImport.id, rowCount: input.rows.length };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSeasonImport(input.id);
        return { success: true };
      }),
  }),
  // Specs — product specification sheets per style
  specs: router({
    getForStyle: publicProcedure
      .input(z.object({ style: z.string() }))
      .query(async ({ input }) => getSpecsForStyle(input.style)),

    upsert: publicProcedure
      .input(z.object({
        style: z.string(),
        colour: z.string(),
        component: z.string(),
        value: z.string().nullable(),
      }))
      .mutation(async ({ input }) => {
        await upsertStyleSpec(input.style, input.colour, input.component, input.value);
        return { success: true };
      }),

    deleteAll: publicProcedure
      .input(z.object({ style: z.string() }))
      .mutation(async ({ input }) => {
        await deleteStyleSpecs(input.style);
        return { success: true };
      }),

    // Dropdown options
    getDropdownOptions: publicProcedure
      .input(z.object({ component: z.string() }))
      .query(async ({ input }) => getDropdownOptions(input.component)),

    getAllDropdownOptions: publicProcedure
      .query(async () => getAllDropdownOptions()),

    addDropdownOption: publicProcedure
      .input(z.object({ component: z.string(), value: z.string() }))
      .mutation(async ({ input }) => addDropdownOption(input.component, input.value)),

    deleteDropdownOption: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDropdownOption(input.id);
        return { success: true };
      }),

    // Style spec meta (buckle, sub-type, notes)
    getMeta: publicProcedure
      .input(z.object({ style: z.string() }))
      .query(async ({ input }) => getStyleSpecMeta(input.style)),

    getAllMeta: publicProcedure
      .query(async () => getAllStyleSpecMeta()),
    getCounts: publicProcedure
      .query(async () => getSpecCountsForAllStyles()),

    upsertMeta: publicProcedure
      .input(z.object({
        style: z.string(),
        hasBuckle: z.boolean().optional(),
        dressShoeSubType: z.enum(["court", "sling"]).nullable().optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertStyleSpecMeta(input);
        return { success: true };
      }),
  }),

  fittingSession: router({
    getAll: publicProcedure
      .query(async () => getAllFittingSessions()),
    getForStyle: publicProcedure
      .input(z.object({ style: z.string() }))
      .query(async ({ input }) => getFittingSessionsForStyle(input.style)),
    create: publicProcedure
      .input(z.object({ style: z.string(), fitModel: z.string(), sessionDate: z.string(), notes: z.string().optional() }))
      .mutation(async ({ input }) => {
        const id = await createFittingSession(input);
        return { id };
      }),
    update: publicProcedure
      .input(z.object({ id: z.number(), fitModel: z.string().optional(), sessionDate: z.string().optional(), notes: z.string().nullable().optional() }))
      .mutation(async ({ input }) => {
        await updateFittingSession(input);
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFittingSession(input.id);
        return { success: true };
      }),
    uploadImage: publicProcedure
      .input(z.object({ sessionId: z.number(), style: z.string(), imageBase64: z.string(), mimeType: z.string() }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.imageBase64, 'base64');
        const ext = input.mimeType.split('/')[1] || 'jpg';
        const fileKey = `fitting-sessions/${input.style}-${input.sessionId}-${nanoid(8)}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        await addFittingSessionImage({ sessionId: input.sessionId, style: input.style, imageUrl: url, fileKey });
        return { url, fileKey };
      }),
    deleteImage: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFittingSessionImage(input.id);
        return { success: true };
      }),
  }),

  styleImage: router({
    getAll: publicProcedure
      .query(async () => getAllStyleImageOverrides()),
    upload: publicProcedure
      .input(z.object({ style: z.string(), imageBase64: z.string(), mimeType: z.string() }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.imageBase64, 'base64');
        const ext = input.mimeType.split('/')[1] || 'jpg';
        const fileKey = `style-images/${input.style}-${nanoid(8)}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        await upsertStyleImageOverride({ style: input.style, imageUrl: url, fileKey });
        return { url };
      }),
    revert: publicProcedure
      .input(z.object({ style: z.string() }))
      .mutation(async ({ input }) => {
        await deleteStyleImageOverride(input.style);
        return { success: true };
      }),
  }),

  styles: router({
    listCancelled: publicProcedure
      .query(async () => listCancelledStyles()),

    cancel: publicProcedure
      .input(z.object({ style: z.string() }))
      .mutation(async ({ input }) => {
        await cancelStyle(input.style);
        return { success: true };
      }),

    restore: publicProcedure
      .input(z.object({ style: z.string() }))
      .mutation(async ({ input }) => {
        await restoreStyle(input.style);
        return { success: true };
      }),
  }),

  customSku: router({
    getAll: publicProcedure
      .query(async () => getAllCustomSkus()),

    add: publicProcedure
      .input(z.object({ style: z.string(), colour: z.string(), leather: z.string() }))
      .mutation(async ({ input }) => {
        const id = await addCustomSku(input.style, input.colour, input.leather);
        return { id };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCustomSku(input.id);
        return { success: true };
      }),
  }),

  cancelledSku: router({
    list: publicProcedure.query(async () => listCancelledSkus()),

    cancel: publicProcedure
      .input(z.object({ style: z.string(), colour: z.string(), leather: z.string() }))
      .mutation(async ({ input }) => {
        await cancelSku(input.style, input.colour, input.leather);
        return { success: true };
      }),

    restore: publicProcedure
      .input(z.object({ style: z.string(), colour: z.string(), leather: z.string() }))
      .mutation(async ({ input }) => {
        await restoreSku(input.style, input.colour, input.leather);
        return { success: true };
      }),
  }),

  styleSubCategory: router({
    getAll: publicProcedure.query(async () => getAllStyleSubCategories()),

    upsert: publicProcedure
      .input(z.object({ style: z.string(), subCategory: z.string() }))
      .mutation(async ({ input }) => {
        await upsertStyleSubCategory(input.style, input.subCategory);
        return { success: true };
      }),
  }),

  trendFlag: router({
    getAll: publicProcedure.query(async () => getAllStyleTrendFlags()),
  }),

  // PowerPoint range review sync
  pptxSync: router({
    // Parse a PPTX file (base64-encoded) and return a diff vs the current DB state
    parse: publicProcedure
      .input(z.object({
        fileBase64: z.string(), // base64-encoded .pptx file
      }))
      .mutation(async ({ input }) => {
        // Write the PPTX to a temp file
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `range_review_${Date.now()}.pptx`);
        try {
          const buf = Buffer.from(input.fileBase64, "base64");
          fs.writeFileSync(tmpFile, buf);

          // Run the Python parser
          const parserPath = path.join(process.cwd(), "server", "pptx_parser.py");
          // Build a clean environment: strip PYTHONPATH/PYTHONHOME so the uv
          // runtime cannot redirect /usr/bin/python3.11 to its own stdlib.
          const cleanEnv = { ...process.env };
          delete cleanEnv.PYTHONPATH;
          delete cleanEnv.PYTHONHOME;
          delete cleanEnv.VIRTUAL_ENV;

          const output = execSync(`/usr/bin/python3.11 "${parserPath}" "${tmpFile}"`, {
            timeout: 60000,
            maxBuffer: 10 * 1024 * 1024,
            env: cleanEnv,
          }).toString();

          const parsed: Array<{
            last: string;
            styles: Array<{
              style: string;
              skus: Array<{ colour: string; leather: string; status: string }>;
            }>;
            error?: string;
          }> = JSON.parse(output);

          // Load current DB state
          const [cancelledSkus, cancelledStyles, allSkuMeta] = await Promise.all([
            listCancelledSkus(),
            listCancelledStyles(),
            getAllSkuMeta(),
          ]);

          const cancelledSkuSet = new Set(
            cancelledSkus.map((s) => `${s.style}|${s.colour}|${s.leather}`)
          );
          const cancelledStyleSet = new Set(cancelledStyles.map((s) => s.style));
          const skuMetaMap = new Map(
            allSkuMeta.map((s) => [`${s.style}|${s.colour}|${s.leather}`, s])
          );

          // Build diff
          type DiffItem = {
            last: string;
            style: string;
            colour: string;
            leather: string;
            pptxStatus: string;
            currentStatus: string;
            action: string;
          };

          const toCancel: DiffItem[] = [];
          const toMarkSpecked: DiffItem[] = [];
          const toMarkSpeckedNoSample: DiffItem[] = [];
          const missingFromDb: DiffItem[] = [];
          const alreadyCancelled: DiffItem[] = [];

          // Build a set of all known SKUs (from static skuData embedded in client)
          // We use the DB skuMeta as the source of truth for "known" SKUs
          // A SKU is "in the dashboard" if it has a skuMeta record OR is in the static data
          // For simplicity, we check skuMeta and also track what we see in the PPTX

          for (const slide of parsed) {
            if (slide.error) continue;
            const last = slide.last;
            for (const styleData of slide.styles) {
              const style = styleData.style;
              for (const sku of styleData.skus) {
                const { colour, leather, status } = sku;
                const key = `${style}|${colour}|${leather}`;
                const isAlreadyCancelledSku = cancelledSkuSet.has(key);
                const isAlreadyCancelledStyle = cancelledStyleSet.has(style);
                const meta = skuMetaMap.get(key);

                const item: DiffItem = { last, style, colour, leather, pptxStatus: status, currentStatus: isAlreadyCancelledSku ? 'cancelled_sku' : isAlreadyCancelledStyle ? 'cancelled_style' : (meta?.sampleStatus ?? 'no_meta'), action: 'none' };

                if (status === 'cancelled') {
                  if (isAlreadyCancelledSku || isAlreadyCancelledStyle) {
                    alreadyCancelled.push({ ...item, action: 'already_cancelled' });
                  } else {
                    toCancel.push({ ...item, action: 'cancel_sku' });
                  }
                } else if (status === 'specked') {
                  if (!isAlreadyCancelledSku && !isAlreadyCancelledStyle) {
                    if (!meta || meta.sampleStatus !== 'received') {
                      toMarkSpecked.push({ ...item, action: 'mark_specked' });
                    }
                  }
                } else if (status === 'specked_no_sample') {
                  if (!isAlreadyCancelledSku && !isAlreadyCancelledStyle) {
                    if (!meta || meta.sampleStatus !== 'received') {
                      toMarkSpeckedNoSample.push({ ...item, action: 'mark_specked_no_sample' });
                    }
                  }
                }
              }
            }
          }

          return {
            success: true,
            slideCount: parsed.filter((s) => !s.error).length,
            toCancel,
            toMarkSpecked,
            toMarkSpeckedNoSample,
            missingFromDb,
            alreadyCancelled,
          };
        } finally {
          try { fs.unlinkSync(tmpFile); } catch {}
        }
      }),

    // Apply the confirmed changes from a PPTX sync
    applyChanges: publicProcedure
      .input(z.object({
        cancelSkus: z.array(z.object({ style: z.string(), colour: z.string(), leather: z.string() })),
        markSpecked: z.array(z.object({ style: z.string(), colour: z.string(), leather: z.string() })),
        markSpeckedNoSample: z.array(z.object({ style: z.string(), colour: z.string(), leather: z.string() })),
      }))
      .mutation(async ({ input }) => {
        let cancelled = 0;
        let specked = 0;
        let speckedNoSample = 0;

        for (const sku of input.cancelSkus) {
          await cancelSku(sku.style, sku.colour, sku.leather);
          cancelled++;
        }
        for (const sku of input.markSpecked) {
          await upsertSkuMeta({ style: sku.style, colour: sku.colour, leather: sku.leather, sampleStatus: 'received' });
          specked++;
        }
        for (const sku of input.markSpeckedNoSample) {
          // specked_no_sample = waiting status (sample not yet received)
          // We just ensure the skuMeta record exists so it's tracked
          await upsertSkuMeta({ style: sku.style, colour: sku.colour, leather: sku.leather, sampleStatus: 'waiting' });
          speckedNoSample++;
        }

        return { success: true, cancelled, specked, speckedNoSample };
      }),
  }),

  // ─── Fitting Groups ──────────────────────────────────────────────────────────
  fittingGroup: router({
    getAll: publicProcedure.query(async () => getAllFittingGroups()),

    create: publicProcedure
      .input(z.object({ name: z.string(), sessionDate: z.string().default(""), notes: z.string().nullable().optional() }))
      .mutation(async ({ input }) => {
        const id = await createFittingGroup(input.name, input.sessionDate, input.notes ?? null);
        return { id };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), name: z.string(), sessionDate: z.string().default(""), notes: z.string().nullable().optional() }))
      .mutation(async ({ input }) => {
        await updateFittingGroup(input.id, input.name, input.sessionDate, input.notes ?? null);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFittingGroup(input.id);
        return { success: true };
      }),

    addStyle: publicProcedure
      .input(z.object({ groupId: z.number(), style: z.string() }))
      .mutation(async ({ input }) => {
        await addStyleToFittingGroup(input.groupId, input.style);
        return { success: true };
      }),

    removeStyle: publicProcedure
      .input(z.object({ groupId: z.number(), style: z.string() }))
      .mutation(async ({ input }) => {
        await removeStyleFromFittingGroup(input.groupId, input.style);
        return { success: true };
      }),
  }),

  // ─── Spec Custom Rows ───────────────────────────────────────────────────────
  specCustomRow: router({
    getByStyle: publicProcedure
      .input(z.object({ style: z.string() }))
      .query(async ({ input }) => getSpecCustomRowsForStyle(input.style)),

    upsert: publicProcedure
      .input(z.object({
        id: z.number().optional(),
        style: z.string(),
        colour: z.string().default("__all__"),
        section: z.string(),
        title: z.string(),
        value: z.string().default(""),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => upsertSpecCustomRow(input)),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSpecCustomRow(input.id);
        return { success: true };
      }),
  }),
});
// Patch buy.unlock into the existing buy router by re-exporting
// (We add it inline here since the buy router is defined earlier in this file)
export type AppRouter = typeof appRouter;;

