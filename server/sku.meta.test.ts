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
  upsertSkuMeta: vi.fn().mockResolvedValue(undefined),
  getAllStyleMeta: vi.fn().mockResolvedValue([
    { id: 1, style: "ALYX", rrp: 299.95 },
  ]),
  upsertStyleRrp: vi.fn().mockResolvedValue(undefined),
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

describe("fitting.getImages", () => {
  it("returns images for a SKU", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.fitting.getImages({ style: "ALYX", colour: "BLACK", leather: "COMO" });
    expect(Array.isArray(result)).toBe(true);
  });
});
