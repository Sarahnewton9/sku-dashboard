import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  getAllSkuMeta, upsertSkuMeta,
  getAllStyleMeta, upsertStyleRrp,
  getFittingImages, addFittingImage, deleteFittingImage, getAllFittingImages,
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
