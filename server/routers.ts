import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import axios from "axios";
import {
  getAllSkuMeta, upsertSkuMeta,
  getAllStyleMeta, upsertStyleRrp,
  getFittingImages, addFittingImage, deleteFittingImage, getAllFittingImages,
  getAllBuySessions, getActiveBuySession, createBuySession, lockBuySession, deleteBuySession,
  getBuySessionItems, upsertBuySessionItem, getSessionTotals,
  getAllLastApprovals, upsertLastApproval,
} from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

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
        qty: z.number().int().min(0),
      }))
      .mutation(async ({ input }) => {
        await upsertBuySessionItem(input.sessionId, input.style, input.colour, input.leather, input.qty);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBuySession(input.sessionId);
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

  // Fitting images
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
});

export type AppRouter = typeof appRouter;
