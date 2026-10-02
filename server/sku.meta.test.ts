/**
 * Tests for SKU metadata and style metadata procedures
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the DB module to avoid real DB calls in tests
vi.mock("./db", () => ({
  getAllSkuMeta: vi.fn().mockResolvedValue([
    { id: 1, style: "ALYX", colour: "BLACK", leather: "COMO", sampleStatus: "waiting", orderQty: 0, isSize11: false, costPrice: null, fitRating: null, fittingNotes: null },
  ]),
  getSeasonSkuCosts: vi.fn().mockResolvedValue([]),
  upsertSeasonSkuCosts: vi.fn().mockResolvedValue(undefined),
  upsertSkuMeta: vi.fn().mockResolvedValue(undefined),
  getAllStyleMeta: vi.fn().mockResolvedValue([
    { id: 1, style: "ALYX", rrp: 299.95 },
  ]),
  upsertStyleRrp: vi.fn().mockResolvedValue(undefined),
  upsertStylePricing: vi.fn().mockResolvedValue(undefined),
  getAllCustomSkus: vi.fn().mockResolvedValue([
    { id: 1, style: "FERGIE", colour: "BLACK", leather: "SUEDE", season: "W27" },
  ]),
  updateCustomStyleDetails: vi.fn().mockResolvedValue(undefined),
  getFittingImages: vi.fn().mockResolvedValue([]),
  addFittingImage: vi.fn().mockResolvedValue({ id: 1 }),
  deleteFittingImage: vi.fn().mockResolvedValue(undefined),
  getAllFittingImages: vi.fn().mockResolvedValue([]),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/test.jpg", key: "test.jpg" }),
}));

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { headers: {}, cookies: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  };
}

describe("sku.getAll", () => {
  it("returns all SKU metadata", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.sku.getAll();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("style");
    expect(result[0]).toHaveProperty("colour");
  });
});

describe("sku.update", () => {
  it("updates SKU metadata successfully", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.sku.update({
      style: "ALYX",
      colour: "BLACK",
      leather: "COMO",
      sampleStatus: "received",
      orderQty: 10,
      isSize11: true,
    });
    expect(result).toEqual({ success: true });
  });

  it("updates fitting notes", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.sku.update({
      style: "ALYX",
      colour: "BLACK",
      leather: "COMO",
      fittingNotes: "Runs slightly narrow in the toe box.",
      fitRating: "tts",
    });
    expect(result).toEqual({ success: true });
  });

  it("accepts a colour override for a static dashboard SKU", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.sku.update({
      style: "ALYX",
      colour: "BLACK",
      leather: "COMO",
      colourOverride: "BLACK PATENT",
      leatherOverride: "PATENT",
    });
    expect(result).toEqual({ success: true });
  });

  it("accepts Upper 2 colour and leather updates for a static dashboard SKU", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.sku.update({
      style: "ALYX",
      colour: "BLACK",
      leather: "COMO",
      colour2: "LIPSTICK",
      leather2: "SUEDE",
    });

    expect(result).toEqual({ success: true });
    expect(db.upsertSkuMeta).toHaveBeenLastCalledWith(expect.objectContaining({
      colour2: "LIPSTICK",
      leather2: "SUEDE",
    }));
  });

  it("accepts a colour-specific RRP override", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.sku.update({
      style: "ALYX",
      colour: "BLACK",
      leather: "COMO",
      rrpOverride: 319.95,
    })).resolves.toEqual({ success: true });
    expect(db.upsertSkuMeta).toHaveBeenLastCalledWith(expect.objectContaining({ rrpOverride: 319.95 }));
  });
});

describe("sku.importCosts", () => {
  it("imports cost prices in bulk", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.sku.importCosts([
      { style: "ALYX", colour: "BLACK", leather: "COMO", cost: 89.50 },
      { style: "ANJA", colour: "MILK", leather: "SUEDE", cost: 95.00 },
    ]);
    expect(result).toHaveProperty("updated");
    expect(result.updated).toBe(2);
  });
});

describe("sku.importCostRequest", () => {
  it("persists the completed factory workbook against the requested season and both uppers", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.sku.importCostRequest({
      season: "W27",
      costs: [{
        style: "ROBYN",
        colour: "ECRU",
        leather: "SNAKE",
        colour2: "LIPSTICK",
        leather2: "SUEDE",
        cost: 96.25,
      }],
    })).resolves.toEqual({ updated: 1 });
    expect(db.upsertSeasonSkuCosts).toHaveBeenLastCalledWith([{
      style: "ROBYN",
      colour: "ECRU",
      leather: "SNAKE",
      colour2: "LIPSTICK",
      leather2: "SUEDE",
      cost: 96.25,
      season: "W27",
    }]);
  });

  it("rejects blank or zero factory costs", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.sku.importCostRequest({
      season: "W27",
      costs: [{ style: "ROBYN", colour: "ECRU", cost: 0 }],
    })).rejects.toThrow();
  });
});

describe("style.getAll", () => {
  it("returns all style metadata", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.style.getAll();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("style");
    expect(result[0]).toHaveProperty("rrp");
  });
});

describe("style.importRrp", () => {
  it("imports RRP in bulk", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.style.importRrp([
      { style: "ALYX", rrp: 299.95 },
      { style: "ANJA", rrp: 349.00 },
    ]);
    expect(result).toHaveProperty("updated");
    expect(result.updated).toBe(2);
  });
});

describe("style.updatePricing", () => {
  it("stores landed cost, target margin and selected RRP", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.style.updatePricing({
      style: "ALYX",
      landedCost: 48.25,
      targetMargin: 0.70,
      rrp: 219.95,
      pricingSource: "Summer 26 Buy Plan",
    })).resolves.toEqual({ success: true });
    expect(db.upsertStylePricing).toHaveBeenLastCalledWith({
      style: "ALYX",
      landedCost: 48.25,
      targetMargin: 0.70,
      rrp: 219.95,
      pricingSource: "Summer 26 Buy Plan",
    });
  });
});

describe("customStyle.updateDetails", () => {
  it("updates the new style details and applies Size 11 to its colourways", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.customStyle.updateDetails({
      id: 1,
      style: "FERGIE",
      lastName: "FERGIE",
      category: "DRESS SHOE",
      isSize11: true,
      season: "W27",
    });
    expect(result).toEqual({ success: true, updatedSkus: 1 });
  });

  it("passes the style identity needed to synchronise the W27 carry-over parent", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(createCtx());

    await caller.customStyle.updateDetails({
      id: 1,
      style: "FERGIE",
      lastName: "FERGIE",
      category: "DRESS SHOE",
      isSize11: false,
      season: "SS26",
    });

    expect(db.updateCustomStyleDetails).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 1,
      style: "FERGIE",
      season: "SS26",
    }));
  });
});

describe("fitting.getImages", () => {
  it("returns images for a SKU", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.fitting.getImages({ style: "ALYX", colour: "BLACK", leather: "COMO" });
    expect(Array.isArray(result)).toBe(true);
  });
});
