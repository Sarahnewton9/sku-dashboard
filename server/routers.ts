import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import axios from "axios";
import {
  getAllSkuMeta, upsertSkuMeta,
  getAllStyleMeta, upsertStyleRrp, upsertStyleFit, upsertStyleCategory,
  getStyleFittingImages, getAllStyleFittingImages, addStyleFittingImage, deleteStyleFittingImage,
  getFittingImages, addFittingImage, deleteFittingImage, getAllFittingImages,
  getAllBuySessions, getActiveBuySession, createBuySession, lockBuySession, deleteBuySession,
  getBuySessionItems, upsertBuySessionItem, getSessionTotals, getAllSessionQtys,
  getAllLastApprovals, upsertLastApproval, getDeletedLasts, deleteLast, restoreDeletedLast,
  getAllSeasonImports, createSeasonImport, getSeasonSkuData, deleteSeasonImport,
  getSpecsForStyle, upsertStyleSpec, deleteStyleSpecs, bulkUpsertStyleSpecs,
  getAllDropdownOptions, getDropdownOptions, addDropdownOption, deleteDropdownOption, deleteDropdownOptionByValue,
  getStyleSpecMeta, getAllStyleSpecMeta, upsertStyleSpecMeta,
  getSpecCountsForAllStyles,
  createFittingSession, updateFittingSession, deleteFittingSession, getFittingSessionsForStyle, getAllFittingSessions,
  addFittingSessionImage, deleteFittingSessionImage,
  upsertStyleImageOverride, deleteStyleImageOverride, getAllStyleImageOverrides,
  cancelStyle, restoreStyle, listCancelledStyles,
  addCustomSku, getAllCustomSkus, deleteCustomSku,
  unlockBuySession,
  renameBuySession,
  cancelSku, restoreSku, listCancelledSkus,
  getAllStyleSubCategories, upsertStyleSubCategory,
  getAllStyleTrendFlags,
  upsertStyleWebsiteImage,
  getAllStyleWebsiteImages,
  createFittingGroup, getAllFittingGroups, updateFittingGroup, deleteFittingGroup, addStyleToFittingGroup, removeStyleFromFittingGroup,
  getSpecCustomRowsForStyle, upsertSpecCustomRow, deleteSpecCustomRow, deleteSpecCustomRowGroup, upsertCustomRowForColour,
  getLatestPptxImport, listPptxImports,
  getAllLastHeelHeights, upsertLastHeelHeight,
  getChangesReport,
  getAllSkuNewOverrides, upsertSkuNewOverride,
  batchReorderCustomRows,
  getAllCustomStyles, addCustomStyle, deleteCustomStyle,
  getSpecRowOrder, upsertSpecRowOrder,
  getSpecHiddenColumns, hideSpecColumn, showSpecColumn,
  getCustomLasts, addCustomLast, deleteCustomLast, resetSpecColour,
} from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import nodemailer from "nodemailer";
import { ENV } from "./_core/env";

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
        sampleStatus: z.enum(["waiting", "fitting_sample", "received"]).optional(),
        orderQty: z.number().int().min(0).optional(),
        isSize11: z.boolean().optional(),
        costPrice: z.number().nullable().optional(),
        fitRating: z.enum(["tts", "runs_small", "runs_large"]).nullable().optional(),
        fittingNotes: z.string().nullable().optional(),
        sampleType: z.string().nullable().optional(),
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

    // Parse a DHL/supplier invoice XLSX and fuzzy-match to dashboard SKUs
    parseInvoice: publicProcedure
      .input(z.object({
        fileBase64: z.string(), // base64-encoded XLSX file
        allSkus: z.array(z.object({
          style: z.string(),
          colour: z.string(),
          leather: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        // Write temp file
        const tmpPath = path.join(os.tmpdir(), `invoice_${Date.now()}.xlsx`);
        fs.writeFileSync(tmpPath, Buffer.from(input.fileBase64, "base64"));

        let parsedRows: { style: string; colour: string; material: string; sampleType: string }[] = [];
        try {
          // Use xlsx package to read the file from buffer
          const XLSX = await import("xlsx");
          const fileBuffer = Buffer.from(input.fileBase64, "base64");
          const wb = XLSX.read(fileBuffer, { type: "buffer" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

          const ITEM_TYPES = new Set(["LEATHER SHOE SAMPLE", "TEXTILE SHOE SAMPLE", "RUBBER SHOE SAMPLE", "SHOE SAMPLE"]);
          for (const row of rows) {
            const col0 = String(row[0] ?? "").trim().toUpperCase();
            if (!ITEM_TYPES.has(col0)) continue;
            const sampleType = String(row[1] ?? "").trim();
            const style = String(row[2] ?? "").trim().toUpperCase();
            const colour = String(row[3] ?? "").trim().toUpperCase();
            const material = String(row[4] ?? "").trim();
            if (!style || !colour) continue;
            parsedRows.push({ style, colour, material, sampleType });
          }
        } finally {
          try { fs.unlinkSync(tmpPath); } catch {}
        }

        // Fuzzy match: normalise strings for comparison
        function norm(s: string) {
          return s.toUpperCase()
            .replace(/[^A-Z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
        function similarity(a: string, b: string): number {
          const na = norm(a), nb = norm(b);
          if (na === nb) return 1.0;
          // Token overlap score
          const ta = new Set(na.split(" "));
          const tb = new Set(nb.split(" "));
          let common = 0;
          Array.from(ta).forEach(t => { if (tb.has(t)) common++; });
          const unionSet = new Set(Array.from(ta).concat(Array.from(tb)));
          const union = unionSet.size;
          return union === 0 ? 0 : common / union;
        }

        const results: {
          invoiceStyle: string;
          invoiceColour: string;
          invoiceMaterial: string;
          sampleType: string;
          matchedStyle: string | null;
          matchedColour: string | null;
          matchedLeather: string | null;
          confidence: number;
          status: "matched" | "no_match";
        }[] = [];

        for (const row of parsedRows) {
          let bestScore = 0;
          let bestSku: typeof input.allSkus[0] | null = null;

          for (const sku of input.allSkus) {
            const styleScore = similarity(row.style, sku.style);
            if (styleScore < 0.5) continue; // style must be a reasonable match
            // Colour match: invoice colour may be "RED SUEDE", sku colour is "RED" and leather is "SUEDE"
            const combined = norm(`${sku.colour} ${sku.leather}`);
            const invoiceColour = norm(row.colour);
            const colourScore = similarity(invoiceColour, combined);
            const total = styleScore * 0.5 + colourScore * 0.5;
            if (total > bestScore) {
              bestScore = total;
              bestSku = sku;
            }
          }

          const THRESHOLD = 0.45;
          results.push({
            invoiceStyle: row.style,
            invoiceColour: row.colour,
            invoiceMaterial: row.material,
            sampleType: row.sampleType,
            matchedStyle: bestScore >= THRESHOLD ? bestSku!.style : null,
            matchedColour: bestScore >= THRESHOLD ? bestSku!.colour : null,
            matchedLeather: bestScore >= THRESHOLD ? bestSku!.leather : null,
            confidence: Math.round(bestScore * 100),
            status: bestScore >= THRESHOLD ? "matched" : "no_match",
          });
        }

        return { results, totalParsed: parsedRows.length };
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

    setCategory: publicProcedure
      .input(z.object({ style: z.string(), category: z.string().nullable() }))
      .mutation(async ({ input }) => {
        await upsertStyleCategory(input.style, input.category);
        return { ok: true };
      }),

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

    getAllSessionQtys: publicProcedure.query(async () => getAllSessionQtys()),

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
        nycQty: z.number().int().min(0).default(0),
      }))
      .mutation(async ({ input }) => {
        await upsertBuySessionItem(input.sessionId, input.style, input.colour, input.leather, input.auQty, input.usaQty, input.nycQty);
        return { success: true };
      }),

    rename: publicProcedure
      .input(z.object({ sessionId: z.number(), name: z.string().min(1).max(128) }))
      .mutation(async ({ input }) => {
        await renameBuySession(input.sessionId, input.name);
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

    getDeleted: publicProcedure.query(async () => getDeletedLasts()),

    upsert: publicProcedure
      .input(z.object({
        lastName: z.string(),
        status: z.enum(["approved", "waiting_revised"]),
        notes: z.string().nullable().optional(),
        size65Approved: z.boolean().optional(),
        size7Approved: z.boolean().optional(),
        size95Approved: z.boolean().optional(),
        proceedWithSamples: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertLastApproval(
          input.lastName,
          input.status,
          input.notes ?? null,
          input.size65Approved,
          input.size7Approved,
          input.size95Approved,
          input.proceedWithSamples,
        );
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ lastName: z.string() }))
      .mutation(async ({ input }) => {
        await deleteLast(input.lastName);
        return { success: true };
      }),

    restore: publicProcedure
      .input(z.object({ lastName: z.string() }))
      .mutation(async ({ input }) => {
        await restoreDeletedLast(input.lastName);
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
        sizeRecommendation: z.enum(["half_size_up", "full_size_up", "half_size_down", "full_size_down"]).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertStyleFit(input.style, input.fitRating ?? null, input.fittingNotes ?? null, input.fitApproved, input.sizeRecommendation);
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

    // Bulk upsert — saves many spec rows in a single DB call (much faster than individual upserts)
    bulkUpsert: publicProcedure
      .input(z.object({
        rows: z.array(z.object({
          style: z.string(),
          colour: z.string(),
          component: z.string(),
          value: z.string(),
        })),
        overwrite: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const count = await bulkUpsertStyleSpecs(input.rows, input.overwrite);
        return { success: true, count };
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

    deleteDropdownOptionByValue: publicProcedure
      .input(z.object({ component: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        await deleteDropdownOptionByValue(input.component, input.value);
        return { success: true };
      }),

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

    // Reset all spec values (template rows + custom rows) for a specific colour column
    resetColour: publicProcedure
      .input(z.object({
        style: z.string(),
        colour: z.string(),
      }))
      .mutation(async ({ input }) => {
        await resetSpecColour(input.style, input.colour);
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
      .input(z.object({ style: z.string(), fitModel: z.string(), sessionDate: z.string(), notes: z.string().optional(), sampleDate: z.string().nullable().optional(), sampleType: z.string().nullable().optional(), sampleSize: z.string().nullable().optional() }))
      .mutation(async ({ input }) => {
        const id = await createFittingSession(input);
        return { id };
      }),
    update: publicProcedure
      .input(z.object({ id: z.number(), fitModel: z.string().optional(), sessionDate: z.string().optional(), notes: z.string().nullable().optional(), sampleDate: z.string().nullable().optional(), sampleType: z.string().nullable().optional(), sampleSize: z.string().nullable().optional() }))
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

  customStyle: router({
    getAll: publicProcedure
      .query(async () => getAllCustomStyles()),

    add: publicProcedure
      .input(z.object({ style: z.string(), lastName: z.string(), category: z.string().optional() }))
      .mutation(async ({ input }) => {
        const id = await addCustomStyle(input.style, input.lastName, input.category);
        return { id };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCustomStyle(input.id);
        return { success: true };
      }),
  }),

  customLast: router({
    getAll: publicProcedure
      .query(async () => getCustomLasts()),

    add: publicProcedure
      .input(z.object({ lastName: z.string().min(1).max(128) }))
      .mutation(async ({ input }) => {
        await addCustomLast(input.lastName);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ lastName: z.string() }))
      .mutation(async ({ input }) => {
        await deleteCustomLast(input.lastName);
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
          // runtime cannot redirect python to its own stdlib.
          const cleanEnv = { ...process.env };
          delete cleanEnv.PYTHONPATH;
          delete cleanEnv.PYTHONHOME;
          delete cleanEnv.VIRTUAL_ENV;

          // Find python binary: try python3 first (works in most containers), then fallback
          const pythonBin = (() => {
            for (const bin of ["python3", "python", "/usr/bin/python3.11", "/usr/bin/python3"]) {
              try { execSync(`${bin} --version`, { stdio: "ignore", env: cleanEnv }); return bin; } catch {}
            }
            return "python3";
          })();

          const output = execSync(`${pythonBin} "${parserPath}" "${tmpFile}"`, {
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

    // Build diff from already-parsed PPTX data (used after multipart upload)
    buildDiff: publicProcedure
      .input(z.object({
        parsed: z.array(z.object({
          last: z.string(),
          styles: z.array(z.object({
            style: z.string(),
            skus: z.array(z.object({ colour: z.string(), leather: z.string(), status: z.string() })),
          })),
          error: z.string().optional(),
        })),
        // Full list of known SKUs from the static skuData + custom SKUs (passed by client)
        knownSkus: z.array(z.object({ style: z.string(), colour: z.string(), leather: z.string() })).optional(),
      }))
      .mutation(async ({ input }) => {
        const [cancelledSkus, cancelledStyles, allSkuMeta, customSkus] = await Promise.all([
          listCancelledSkus(),
          listCancelledStyles(),
          getAllSkuMeta(),
          getAllCustomSkus(),
        ]);
        const cancelledSkuSet = new Set(cancelledSkus.map((s) => `${s.style}|${s.colour}|${s.leather}`));
        const cancelledStyleSet = new Set(cancelledStyles.map((s) => s.style));
        const skuMetaMap = new Map(allSkuMeta.map((s) => [`${s.style}|${s.colour}|${s.leather}`, s]));

        // Build the set of all known SKUs (static + custom from DB)
        // If client passed knownSkus, use that; otherwise fall back to DB custom SKUs only
        const knownSkuSet = new Set<string>();
        if (input.knownSkus && input.knownSkus.length > 0) {
          for (const s of input.knownSkus) knownSkuSet.add(`${s.style}|${s.colour}|${s.leather}`);
        }
        // Always include custom SKUs from DB as known
        for (const s of customSkus) knownSkuSet.add(`${s.style}|${s.colour}|${s.leather}`);

        type DiffItem = { last: string; style: string; colour: string; leather: string; pptxStatus: string; currentStatus: string; action: string; sampleStatus?: string; };
        const toCancel: DiffItem[] = [];
        const toMarkSpecked: DiffItem[] = [];
        const toMarkSpeckedNoSample: DiffItem[] = [];
        const toAddNew: DiffItem[] = [];
        const alreadyCancelled: DiffItem[] = [];

        for (const slide of input.parsed) {
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
              const isKnown = knownSkuSet.size > 0 ? knownSkuSet.has(key) : true; // if no knownSkus passed, treat all as known
              const item: DiffItem = { last, style, colour, leather, pptxStatus: status, currentStatus: isAlreadyCancelledSku ? 'cancelled_sku' : isAlreadyCancelledStyle ? 'cancelled_style' : (meta?.sampleStatus ?? 'no_meta'), action: 'none' };

              if (status === 'cancelled') {
                // Skip cancelled new SKUs — no point adding then cancelling
                if (isAlreadyCancelledSku || isAlreadyCancelledStyle) alreadyCancelled.push({ ...item, action: 'already_cancelled' });
                else if (isKnown) toCancel.push({ ...item, action: 'cancel_sku' });
                // If not known and cancelled, just ignore
              } else if (!isKnown) {
                // New SKU — determine sample status from highlight
                const sampleStatus = status === 'specked' ? 'received' : 'waiting';
                toAddNew.push({ ...item, action: 'add_new', sampleStatus });
              } else if (status === 'specked') {
                if (!isAlreadyCancelledSku && !isAlreadyCancelledStyle && (!meta || meta.sampleStatus !== 'received'))
                  toMarkSpecked.push({ ...item, action: 'mark_specked' });
              } else if (status === 'specked_no_sample') {
                if (!isAlreadyCancelledSku && !isAlreadyCancelledStyle && (!meta || meta.sampleStatus !== 'received'))
                  toMarkSpeckedNoSample.push({ ...item, action: 'mark_specked_no_sample' });
              }
            }
          }
        }
        return { success: true, slideCount: input.parsed.filter((s) => !s.error).length, toCancel, toMarkSpecked, toMarkSpeckedNoSample, toAddNew, alreadyCancelled };
      }),

    // Apply the confirmed changes from a PPTX sync
    applyChanges: publicProcedure
      .input(z.object({
        cancelSkus: z.array(z.object({ style: z.string(), colour: z.string(), leather: z.string() })),
        markSpecked: z.array(z.object({ style: z.string(), colour: z.string(), leather: z.string() })),
        markSpeckedNoSample: z.array(z.object({ style: z.string(), colour: z.string(), leather: z.string() })),
        addNewSkus: z.array(z.object({
          style: z.string(),
          colour: z.string(),
          leather: z.string(),
          sampleStatus: z.enum(['received', 'waiting', 'fitting_sample']).default('waiting'),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        let cancelled = 0;
        let specked = 0;
        let speckedNoSample = 0;
        let added = 0;

        for (const sku of input.cancelSkus) {
          await cancelSku(sku.style, sku.colour, sku.leather);
          cancelled++;
        }
        for (const sku of input.markSpecked) {
          await upsertSkuMeta({ style: sku.style, colour: sku.colour, leather: sku.leather, sampleStatus: 'received' });
          specked++;
        }
        for (const sku of input.markSpeckedNoSample) {
          await upsertSkuMeta({ style: sku.style, colour: sku.colour, leather: sku.leather, sampleStatus: 'waiting' });
          speckedNoSample++;
        }
        for (const sku of (input.addNewSkus ?? [])) {
          // Add as custom SKU (isNew = true) then set sample status
          await addCustomSku(sku.style, sku.colour, sku.leather);
          await upsertSkuMeta({ style: sku.style, colour: sku.colour, leather: sku.leather, sampleStatus: sku.sampleStatus });
          added++;
        }

        return { success: true, cancelled, specked, speckedNoSample, added };
      }),

    // Re-scan the last stored PPTX with the current (fixed) parser and return only
    // SKUs that are missing from the known set (static + custom DB).
    rescan: publicProcedure
      .input(z.object({
        knownSkus: z.array(z.object({ style: z.string(), colour: z.string(), leather: z.string() })).optional(),
      }))
      .mutation(async ({ input }) => {
        const latest = await getLatestPptxImport();
        if (!latest) return { success: false, error: 'No stored PPTX found. Upload a PPT first.' };

        // Fetch the PPTX from S3
        const { storageGet } = await import('./storage');
        const { url } = await storageGet(latest.fileKey);
        const resp = await fetch(url);
        if (!resp.ok) return { success: false, error: `Failed to fetch stored PPTX (${resp.status})` };
        const buf = Buffer.from(await resp.arrayBuffer());

        // Re-parse with the current (fixed) parser
        const { parsePptxBuffer } = await import('./pptx_parser');
        const parsed = await parsePptxBuffer(buf);

        // Build known set
        const [cancelledSkus, cancelledStyles, allSkuMeta, customSkus] = await Promise.all([
          listCancelledSkus(),
          listCancelledStyles(),
          getAllSkuMeta(),
          getAllCustomSkus(),
        ]);
        const cancelledSkuSet = new Set(cancelledSkus.map((s) => `${s.style}|${s.colour}|${s.leather}`));
        const cancelledStyleSet = new Set(cancelledStyles.map((s) => s.style));
        const knownSkuSet = new Set<string>();
        if (input.knownSkus && input.knownSkus.length > 0) {
          for (const s of input.knownSkus) knownSkuSet.add(`${s.style}|${s.colour}|${s.leather}`);
        }
        for (const s of customSkus) knownSkuSet.add(`${s.style}|${s.colour}|${s.leather}`);

        type MissedItem = { last: string; style: string; colour: string; leather: string; pptxStatus: string; sampleStatus: string; action: string };
        const missed: MissedItem[] = [];
        for (const slide of parsed) {
          if ((slide as any).error) continue;
          const last = (slide as any).last ?? '';
          for (const styleData of (slide as any).styles ?? []) {
            const style = styleData.style;
            for (const sku of styleData.skus ?? []) {
              const { colour, leather, status } = sku;
              if (status === 'cancelled') continue;
              const key = `${style}|${colour}|${leather}`;
              const isAlreadyCancelledSku = cancelledSkuSet.has(key);
              const isAlreadyCancelledStyle = cancelledStyleSet.has(style);
              if (isAlreadyCancelledSku || isAlreadyCancelledStyle) continue;
              const isKnown = knownSkuSet.size > 0 ? knownSkuSet.has(key) : true;
              if (!isKnown) {
                const sampleStatus = status === 'specked' ? 'received' : 'waiting';
                missed.push({ last, style, colour, leather, pptxStatus: status, sampleStatus, action: 'add_new' });
              }
            }
          }
        }

        return {
          success: true,
          fileName: latest.fileName,
          uploadedAt: latest.uploadedAt,
          missed,
          totalMissed: missed.length,
        };
      }),

    // List stored PPTX imports
    listImports: publicProcedure.query(async () => listPptxImports()),

    // Parse a PPTX from a URL (used when browser uploads directly to storage to bypass proxy size limits)
    parseFromUrl: publicProcedure
      .input(z.object({
        url: z.string().url(),
        fileName: z.string().optional(),
        knownSkus: z.array(z.object({ style: z.string(), colour: z.string(), leather: z.string() })).optional(),
      }))
      .mutation(async ({ input }) => {
        // Download the PPTX from the provided URL
        const resp = await fetch(input.url);
        if (!resp.ok) throw new Error(`Failed to fetch PPTX from URL (${resp.status})`);
        const buf = Buffer.from(await resp.arrayBuffer());

        // Parse the PPTX
        const { parsePptxBuffer } = await import('./pptx_parser');
        const parsed = await parsePptxBuffer(buf);

        // Store in S3 for re-scan later
        try {
          const fileName = input.fileName || 'range_review.pptx';
          const fileKey = `pptx-imports/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { storagePut } = await import('./storage');
          const { key } = await storagePut(fileKey, buf, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
          await recordPptxImport(key, fileName);
        } catch (storeErr) {
          console.warn('[pptxSync.parseFromUrl] Failed to store PPTX in S3:', storeErr);
        }

        // Build diff (same logic as buildDiff)
        const [cancelledSkus, cancelledStyles, allSkuMeta, customSkus] = await Promise.all([
          listCancelledSkus(),
          listCancelledStyles(),
          getAllSkuMeta(),
          getAllCustomSkus(),
        ]);
        const cancelledSkuSet = new Set(cancelledSkus.map((s) => `${s.style}|${s.colour}|${s.leather}`));
        const cancelledStyleSet = new Set(cancelledStyles.map((s) => s.style));
        const skuMetaMap = new Map(allSkuMeta.map((s) => [`${s.style}|${s.colour}|${s.leather}`, s]));
        const knownSkuSet = new Set<string>();
        if (input.knownSkus && input.knownSkus.length > 0) {
          for (const s of input.knownSkus) knownSkuSet.add(`${s.style}|${s.colour}|${s.leather}`);
        }
        for (const s of customSkus) knownSkuSet.add(`${s.style}|${s.colour}|${s.leather}`);

        type DiffItem = { last: string; style: string; colour: string; leather: string; pptxStatus: string; currentStatus: string; action: string; sampleStatus?: string; };
        const toCancel: DiffItem[] = [];
        const toMarkSpecked: DiffItem[] = [];
        const toMarkSpeckedNoSample: DiffItem[] = [];
        const toAddNew: DiffItem[] = [];
        const alreadyCancelled: DiffItem[] = [];

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
              const isKnown = knownSkuSet.size > 0 ? knownSkuSet.has(key) : true;
              const item: DiffItem = { last, style, colour, leather, pptxStatus: status, currentStatus: isAlreadyCancelledSku ? 'cancelled_sku' : isAlreadyCancelledStyle ? 'cancelled_style' : (meta?.sampleStatus ?? 'no_meta'), action: 'none' };

              if (status === 'cancelled') {
                if (isAlreadyCancelledSku || isAlreadyCancelledStyle) alreadyCancelled.push({ ...item, action: 'already_cancelled' });
                else if (isKnown) toCancel.push({ ...item, action: 'cancel_sku' });
              } else if (!isKnown) {
                const sampleStatus = status === 'specked' ? 'received' : 'waiting';
                toAddNew.push({ ...item, action: 'add_new', sampleStatus });
              } else if (status === 'specked') {
                if (!isAlreadyCancelledSku && !isAlreadyCancelledStyle && (!meta || meta.sampleStatus !== 'received'))
                  toMarkSpecked.push({ ...item, action: 'mark_specked' });
              } else if (status === 'specked_no_sample') {
                if (!isAlreadyCancelledSku && !isAlreadyCancelledStyle && (!meta || meta.sampleStatus !== 'received'))
                  toMarkSpeckedNoSample.push({ ...item, action: 'mark_specked_no_sample' });
              }
            }
          }
        }
        return { success: true, slideCount: parsed.filter((s) => !s.error).length, toCancel, toMarkSpecked, toMarkSpeckedNoSample, toAddNew, alreadyCancelled };
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

  // ─── Last Heel Heights ────────────────────────────────────────────────────
  heelHeight: router({
    getAll: publicProcedure.query(async () => getAllLastHeelHeights()),
    upsert: publicProcedure
      .input(z.object({ lastName: z.string(), heelHeightCm: z.number() }))
      .mutation(async ({ input }) => {
        await upsertLastHeelHeight(input.lastName, input.heelHeightCm);
        return { success: true };
      }),
  }),

  // ─── Changes Report ──────────────────────────────────────────────────────────
  changesReport: router({
    get: publicProcedure
      .input(z.object({ since: z.date() }))
      .query(async ({ input }) => getChangesReport(input.since)),

    sendToTeam: publicProcedure
      .input(z.object({
        since: z.date(),
        sessionName: z.string(),
      }))
      .mutation(async ({ input }) => {
        const data = await getChangesReport(input.since);
        const today = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });

        // Build HTML email body
        function tableRows<T extends Record<string, unknown>>(items: T[], cols: Array<{ key: keyof T; label: string; fmt?: (v: unknown) => string }>): string {
          if (items.length === 0) return `<tr><td colspan="${cols.length}" style="padding:6px 8px;color:#888;">— None —</td></tr>`;
          return items.map(item =>
            `<tr>${cols.map(c => `<td style="padding:6px 8px;border-bottom:1px solid #eee;">${c.fmt ? c.fmt(item[c.key]) : String(item[c.key] ?? "—")}</td>`).join("")}</tr>`
          ).join("");
        }

        function section(title: string, colour: string, headers: string[], rows: string): string {
          return `
            <h3 style="margin:24px 0 8px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${colour};">${title}</h3>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead><tr>${headers.map(h => `<th style="text-align:left;padding:6px 8px;background:#f5e6d3;font-weight:600;">${h}</th>`).join("")}</tr></thead>
              <tbody>${rows}</tbody>
            </table>`;
        }

        const cancelledStyleRows = tableRows(data.cancelledStyles, [
          { key: "style", label: "Style" },
          { key: "cancelledAt", label: "Date Cancelled", fmt: v => new Date(v as Date).toLocaleDateString("en-AU") },
        ]);

        const cancelledSkuRows = tableRows(data.cancelledSkus, [
          { key: "style", label: "Style" },
          { key: "colour", label: "Colour" },
          { key: "leather", label: "Leather" },
          { key: "cancelledAt", label: "Date Cancelled", fmt: v => new Date(v as Date).toLocaleDateString("en-AU") },
        ]);

        const newColourRows = tableRows(data.newColours, [
          { key: "style", label: "Style" },
          { key: "colour", label: "Colour" },
          { key: "leather", label: "Leather" },
          { key: "createdAt", label: "Date Added", fmt: v => new Date(v as Date).toLocaleDateString("en-AU") },
        ]);

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;font-size:13px;color:#222;max-width:700px;margin:0 auto;padding:24px;">
  <h1 style="font-size:18px;font-weight:700;margin:0 0 4px;">Tony Bianco — SS26 Changes Report</h1>
  <p style="margin:0 0 4px;color:#555;font-size:12px;">Session: <strong>${input.sessionName}</strong></p>
  <p style="margin:0 0 20px;color:#555;font-size:12px;">Generated: ${today}</p>
  <hr style="border:none;border-top:2px solid #3d2b1f;margin-bottom:20px;">
  ${section("Cancelled Styles", "#8b1a1a", ["Style", "Date Cancelled"], cancelledStyleRows)}
  ${section("Cancelled Colours", "#8b1a1a", ["Style", "Colour", "Leather", "Date Cancelled"], cancelledSkuRows)}
  ${section("New Colours Added", "#1a5c3a", ["Style", "Colour", "Leather", "Date Added"], newColourRows)}
  <hr style="border:none;border-top:1px solid #eee;margin-top:32px;">
  <p style="font-size:11px;color:#aaa;margin-top:8px;">Sent from SKU Dashboard · Tony Bianco SS26</p>
</body>
</html>`;

        // Send via SMTP if configured, otherwise fall back to owner notification
        if (ENV.smtpHost && ENV.smtpUser && ENV.smtpPass) {
          const transporter = nodemailer.createTransport({
            host: ENV.smtpHost,
            port: ENV.smtpPort,
            secure: ENV.smtpPort === 465,
            auth: { user: ENV.smtpUser, pass: ENV.smtpPass },
          });
          const recipients = [
            "fatih@tonybianco.com",
            "amanda@tonybianco.com",
            "anthony@tonybianco.com",
            "alison@tonybianco.com",
            "sarah.newton@tonybianco.com",
          ];
          await transporter.sendMail({
            from: ENV.smtpFrom || ENV.smtpUser,
            to: recipients.join(", "),
            subject: `SS26 Changes Report — ${input.sessionName} (${today})`,
            html,
          });
          return { success: true, method: "smtp" as const };
        }

        // Fallback: notify owner via Manus notification (no SMTP configured)
        const { notifyOwner } = await import("./_core/notification");
        const textBody = [
          `Session: ${input.sessionName}`,
          `Date: ${today}`,
          "",
          `CANCELLED STYLES (${data.cancelledStyles.length}): ${data.cancelledStyles.map(s => s.style).join(", ") || "None"}`,
          `CANCELLED COLOURS (${data.cancelledSkus.length}): ${data.cancelledSkus.map(s => `${s.style} ${s.colour}`).join(", ") || "None"}`,
          `NEW COLOURS ADDED (${data.newColours.length}): ${data.newColours.map(s => `${s.style} ${s.colour}`).join(", ") || "None"}`,
        ].join("\n");
        await notifyOwner({ title: `SS26 Changes Report — ${input.sessionName}`, content: textBody });
        return { success: true, method: "notification" as const };
      }),
  }),

  // ─── SKU New/Existing Override ────────────────────────────────────────────
  skuNewOverride: router({
    getAll: publicProcedure.query(async () => getAllSkuNewOverrides()),

    upsert: publicProcedure
      .input(z.object({
        style: z.string(),
        colour: z.string(),
        leather: z.string().default(""),
        isNew: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await upsertSkuNewOverride(input.style, input.colour, input.leather, input.isNew);
        return { success: true };
      }),
  }),

  // ─── AI Dashboard Assistant ──────────────────────────────────────────────────
  chat: router({
    command: publicProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");

        // Define the tools the assistant can call
        const tools = [
          {
            type: "function" as const,
            function: {
              name: "mark_sku_new_or_existing",
              description: "Mark a SKU (style + colour + leather) as new or existing. Use this when the user says a SKU is not new, is existing, is a carryover, or conversely is new.",
              parameters: {
                type: "object",
                properties: {
                  style: { type: "string", description: "Style name in uppercase, e.g. NESTA" },
                  colour: { type: "string", description: "Colour name ONLY (not leather) in uppercase, e.g. VANILLA, BLACK, CHOC, MILK. Do NOT include the leather name here." },
                  leather: { type: "string", description: "Leather/material name ONLY in uppercase, e.g. VINTAGE, SUEDE, CAPRETTO, NAPPA, VENICE. Use empty string if not specified." },
                  is_new: { type: "boolean", description: "true if the SKU is new, false if it is existing/carryover" },
                },
                required: ["style", "colour", "is_new"],
                additionalProperties: false,
              },
            },
          },
          {
            type: "function" as const,
            function: {
              name: "update_sample_status",
              description: "Update the sample status for a SKU. Use when user says sample received, sample arrived, or sample is waiting.",
              parameters: {
                type: "object",
                properties: {
                  style: { type: "string", description: "Style name in uppercase" },
                  colour: { type: "string", description: "Colour name in uppercase" },
                  leather: { type: "string", description: "Leather/material name in uppercase. Use empty string if not specified." },
                  status: { type: "string", enum: ["waiting", "received"], description: "waiting = sample not yet received, received = sample has arrived" },
                },
                required: ["style", "colour", "status"],
                additionalProperties: false,
              },
            },
          },
          {
            type: "function" as const,
            function: {
              name: "cancel_sku",
              description: "Cancel a SKU (mark it as cancelled/dropped from the range). Use when user says cancel, drop, or remove a colour.",
              parameters: {
                type: "object",
                properties: {
                  style: { type: "string", description: "Style name in uppercase" },
                  colour: { type: "string", description: "Colour name in uppercase" },
                  leather: { type: "string", description: "Leather/material name in uppercase. Use empty string if not specified." },
                },
                required: ["style", "colour"],
                additionalProperties: false,
              },
            },
          },
          {
            type: "function" as const,
            function: {
              name: "restore_sku",
              description: "Restore a previously cancelled SKU. Use when user says restore, reinstate, or bring back a colour.",
              parameters: {
                type: "object",
                properties: {
                  style: { type: "string", description: "Style name in uppercase" },
                  colour: { type: "string", description: "Colour name in uppercase" },
                  leather: { type: "string", description: "Leather/material name in uppercase. Use empty string if not specified." },
                },
                required: ["style", "colour"],
                additionalProperties: false,
              },
            },
          },
          {
            type: "function" as const,
            function: {
              name: "cancel_style",
              description: "Cancel an entire style (all SKUs). Use when user says cancel or drop a whole style.",
              parameters: {
                type: "object",
                properties: {
                  style: { type: "string", description: "Style name in uppercase" },
                },
                required: ["style"],
                additionalProperties: false,
              },
            },
          },
          {
            type: "function" as const,
            function: {
              name: "mark_style_existing",
              description: "Mark ALL SKUs of an entire style as existing/carryover (not new). Use this when the user says a style is not new, is a carryover, is existing, or doesn't need to appear in fittings — and no specific colour is mentioned.",
              parameters: {
                type: "object",
                properties: {
                  style: { type: "string", description: "Style name in uppercase, e.g. PAXOS" },
                },
                required: ["style"],
                additionalProperties: false,
              },
            },
          },
          {
            type: "function" as const,
            function: {
              name: "no_action",
              description: "Use this when the user is asking a question, making a comment, or the request is unclear and no data change is needed.",
              parameters: {
                type: "object",
                properties: {
                  response: { type: "string", description: "A helpful response to the user" },
                },
                required: ["response"],
                additionalProperties: false,
              },
            },
          },
        ];

        const systemPrompt = `You are a helpful assistant for the Tony Bianco SKU dashboard.
You help the team make quick data changes by interpreting natural language commands.
The dashboard tracks shoe styles, colours, leathers, sample status, and buy quantities for the AW25/SS26 season.

When the user describes a change, call the appropriate tool. Be confident in interpreting shoe industry terminology:
- "carryover", "existing", "not new", "carry over", "is not new", "doesn't need to appear in fittings" → mark_style_existing if no colour is mentioned, OR mark_sku_new_or_existing if a specific colour is mentioned
- "new sku", "new colour", "new style" → mark_sku_new_or_existing with is_new=true (or mark_style_existing with is_new=true)
- "sample received", "sample arrived", "got the sample" → update_sample_status with status=received
- "waiting on sample", "sample not here" → update_sample_status with status=waiting
- "cancel", "drop", "remove" → cancel_sku or cancel_style
- "restore", "reinstate", "bring back" → restore_sku

IMPORTANT: If the user says a STYLE (not a specific colour) is not new / is existing / is a carryover, use mark_style_existing — this marks ALL colours of that style as existing in one go.
If the user mentions a specific colour, use mark_sku_new_or_existing for that specific SKU.

CRITICAL — Colour and leather are ALWAYS separate fields:
- Shoe names are typically "STYLE COLOUR LEATHER" e.g. "NESTA VANILLA VINTAGE" → style=NESTA, colour=VANILLA, leather=VINTAGE
- Common leathers: VINTAGE, SUEDE, NAPPA, CAPRETTO, VENICE, PATENT, SATIN, NUBUCK, BROCADE, SPECKLE, PONY
- The colour is the word BEFORE the leather. e.g. "VANILLA VINTAGE" → colour=VANILLA, leather=VINTAGE
- "BLACK VINTAGE" → colour=BLACK, leather=VINTAGE
- "CHOC SUEDE" → colour=CHOC, leather=SUEDE
- "MILK CAPRETTO" → colour=MILK, leather=CAPRETTO
- NEVER combine colour and leather into one field
Always uppercase all values.
If the request is unclear or is a question, use no_action.`;

        const llmMessages = [
          { role: "system" as const, content: systemPrompt },
          ...input.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        const result = await invokeLLM({
          messages: llmMessages,
          tools,
          tool_choice: "auto",
        });

        const choice = result.choices?.[0];
        const toolCall = choice?.message?.tool_calls?.[0];

        if (!toolCall) {
          // LLM chose to reply with text rather than call a tool — use that response
          const textReply = choice?.message?.content;
          if (textReply) {
            return { success: true, reply: String(textReply), action: null };
          }
          return { success: false, reply: "I couldn't understand that request. Could you rephrase it? Try something like: \"Paxos is not a new style\" or \"Sample received for Anja Black Patent\".", action: null };
        }

        const fnName = toolCall.function?.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function?.arguments ?? "{}");
        } catch {}

        let reply = "";
        let action: Record<string, unknown> | null = null;

        if (fnName === "mark_sku_new_or_existing") {
          const style = String(args.style ?? "").toUpperCase();
          const colour = String(args.colour ?? "").toUpperCase();
          const leather = String(args.leather ?? "").toUpperCase();
          const isNew = Boolean(args.is_new);
          await upsertSkuNewOverride(style, colour, leather, isNew);
          reply = `Done — **${style} ${colour}${leather ? ` ${leather}` : ""}** is now marked as **${isNew ? "new" : "existing"}**.`;
          action = { type: "mark_sku_new_or_existing", style, colour, leather, isNew };

        } else if (fnName === "update_sample_status") {
          const style = String(args.style ?? "").toUpperCase();
          const colour = String(args.colour ?? "").toUpperCase();
          const leather = String(args.leather ?? "").toUpperCase();
          const status = args.status as "waiting" | "received";
          await upsertSkuMeta({ style, colour, leather, sampleStatus: status });
          reply = `Done — **${style} ${colour}${leather ? ` ${leather}` : ""}** sample status set to **${status}**.`;
          action = { type: "update_sample_status", style, colour, leather, status };

        } else if (fnName === "cancel_sku") {
          const style = String(args.style ?? "").toUpperCase();
          const colour = String(args.colour ?? "").toUpperCase();
          const leather = String(args.leather ?? "").toUpperCase();
          await cancelSku(style, colour, leather);
          reply = `Done — **${style} ${colour}${leather ? ` ${leather}` : ""}** has been cancelled.`;
          action = { type: "cancel_sku", style, colour, leather };

        } else if (fnName === "restore_sku") {
          const style = String(args.style ?? "").toUpperCase();
          const colour = String(args.colour ?? "").toUpperCase();
          const leather = String(args.leather ?? "").toUpperCase();
          await restoreSku(style, colour, leather);
          reply = `Done — **${style} ${colour}${leather ? ` ${leather}` : ""}** has been restored.`;
          action = { type: "restore_sku", style, colour, leather };

        } else if (fnName === "cancel_style") {
          const style = String(args.style ?? "").toUpperCase();
          await cancelStyle(style);
          reply = `Done — **${style}** (all colours) has been cancelled.`;
          action = { type: "cancel_style", style };

        } else if (fnName === "mark_style_existing") {
          const style = String(args.style ?? "").toUpperCase();
          // Insert a style-level override row with colour="__all__" — the frontend checks this key
          // and applies it to all SKUs of the style when no per-SKU override exists
          await upsertSkuNewOverride(style, "__all__", "", false);
          reply = `Done — **${style}** is now marked as an existing/carryover style. All its SKUs will show as existing.`;
          action = { type: "mark_style_existing", style };

        } else if (fnName === "no_action") {
          reply = String(args.response ?? "How can I help?");
          action = null;
        } else {
          reply = "I'm not sure what to do with that. Could you rephrase?";
          action = null;
        }

        return { success: true, reply, action };
      }),
  }),

  // ─── Spec Row Order (custom ordering of all rows per style) ──────────────────────────
  specRowOrder: router({
    get: publicProcedure
      .input(z.object({ style: z.string() }))
      .query(async ({ input }) => {
        const rowKeys = await getSpecRowOrder(input.style);
        return { rowKeys };
      }),
    upsert: publicProcedure
      .input(z.object({ style: z.string(), rowKeys: z.array(z.string()) }))
      .mutation(async ({ input }) => {
        await upsertSpecRowOrder(input.style, input.rowKeys);
        return { success: true };
      }),
  }),
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
    deleteGroup: publicProcedure
      .input(z.object({ style: z.string(), section: z.string(), title: z.string() }))
      .mutation(async ({ input }) => {
        await deleteSpecCustomRowGroup(input.style, input.section, input.title);
        return { success: true };
      }),
    batchReorderCustomRows: publicProcedure
      .input(z.object({ orderedIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await batchReorderCustomRows(input.orderedIds);
        return { success: true };
      }),

    upsertForColour: publicProcedure
      .input(z.object({
        allRowId: z.number(),
        style: z.string(),
        section: z.string(),
        title: z.string(),
        sortOrder: z.number().default(0),
        targetColour: z.string(),
        newValue: z.string(),
        currentSharedValue: z.string(),
        allColours: z.array(z.string()),
      }))
      .mutation(async ({ input }) => upsertCustomRowForColour(input)),
  }),
  // ─── Spec Hidden Columns (hide individual colour columns per style) ───────────
  specHiddenColumns: router({
    getHidden: publicProcedure
      .input(z.object({ style: z.string() }))
      .query(async ({ input }) => {
        const hidden = await getSpecHiddenColumns(input.style);
        return { hidden };
      }),
    hide: publicProcedure
      .input(z.object({ style: z.string(), colour: z.string() }))
      .mutation(async ({ input }) => {
        await hideSpecColumn(input.style, input.colour);
        return { success: true };
      }),
    show: publicProcedure
      .input(z.object({ style: z.string(), colour: z.string() }))
      .mutation(async ({ input }) => {
        await showSpecColumn(input.style, input.colour);
        return { success: true };
      }),
  }),
});
// Patch buy.unlock into the existing buy router by re-exporting
// (We add it inline here since the buy router is defined earlier in this file)
export type AppRouter = typeof appRouter;

