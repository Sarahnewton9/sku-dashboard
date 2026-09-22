import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const handbagDb = vi.hoisted(() => ({
  createHandbagStyleParent: vi.fn(),
  updateHandbagStyleParent: vi.fn(),
  upsertHandbagStyle: vi.fn(),
  updateHandbagSku: vi.fn(),
  cancelHandbagSku: vi.fn(),
  restoreHandbagSku: vi.fn(),
}));

vi.mock("./db", () => ({
  getHandbagStyleParents: vi.fn().mockResolvedValue([]),
  createHandbagStyleParent: handbagDb.createHandbagStyleParent,
  updateHandbagStyleParent: handbagDb.updateHandbagStyleParent,
  upsertHandbagStyle: handbagDb.upsertHandbagStyle,
  updateHandbagSku: handbagDb.updateHandbagSku,
  cancelHandbagSku: handbagDb.cancelHandbagSku,
  restoreHandbagSku: handbagDb.restoreHandbagSku,
}));

function createCtx(): TrpcContext {
  return {
    user: { id: 1, openId: "owner", name: "Owner", email: null, loginMethod: null, role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {}, cookies: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  };
}

describe("handbag range manager router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handbagDb.createHandbagStyleParent.mockResolvedValue({ style: "ARIA" });
    handbagDb.updateHandbagStyleParent.mockResolvedValue(undefined);
    handbagDb.upsertHandbagStyle.mockResolvedValue(undefined);
    handbagDb.updateHandbagSku.mockResolvedValue({ outcome: "updated", sourceColour: "VESTRA", retainedColour: "VINO" });
    handbagDb.cancelHandbagSku.mockResolvedValue(undefined);
    handbagDb.restoreHandbagSku.mockResolvedValue(undefined);
  });

  it("creates a handbag style before its first SKU", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.handbag.createStyle({ style: "ARIA", seasonality: "W27", notes: "Campaign bag" }))
      .resolves.toEqual({ style: "ARIA" });
    expect(handbagDb.createHandbagStyleParent).toHaveBeenCalledWith({ style: "ARIA", seasonality: "W27", notes: "Campaign bag" });
  });

  it("saves handbag-only style seasonality", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.handbag.updateStyleDetails({ style: "ARIA", seasonality: "Core / Carry Over", notes: null }))
      .resolves.toEqual({ success: true });
    expect(handbagDb.updateHandbagStyleParent).toHaveBeenCalledWith({ style: "ARIA", seasonality: "Core / Carry Over", notes: null });
  });

  it("allows seasonality when adding a handbag SKU", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.handbag.upsertStyle({
      style: "ARIA",
      colour: "BLACK PEBBLE",
      material: "Pebble",
      seasonality: "SS26",
      rrp: 199.95,
      cost: 60,
    })).resolves.toEqual({ success: true });
    expect(handbagDb.upsertHandbagStyle).toHaveBeenCalledWith(expect.objectContaining({
      style: "ARIA",
      colour: "BLACK PEBBLE",
      seasonality: "SS26",
    }));
  });

  it("edits an existing handbag SKU through the duplicate-safe API", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.handbag.updateSku({
      style: "ELARA",
      oldColour: "VESTRA",
      colour: "VINO",
      material: "CROCO",
      seasonality: "SS26",
      rrp: 249.95,
      cost: null,
      notes: null,
    })).resolves.toEqual({ outcome: "updated", sourceColour: "VESTRA", retainedColour: "VINO" });
    expect(handbagDb.updateHandbagSku).toHaveBeenCalledWith(expect.objectContaining({
      style: "ELARA",
      oldColour: "VESTRA",
      colour: "VINO",
    }));
  });

  it("cancels and restores a single handbag SKU without deleting range data", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.handbag.cancelSku({ style: "ELARA", colour: "VESTRA" })).resolves.toEqual({ success: true });
    await expect(caller.handbag.restoreSku({ style: "ELARA", colour: "VESTRA" })).resolves.toEqual({ success: true });
    expect(handbagDb.cancelHandbagSku).toHaveBeenCalledWith("ELARA", "VESTRA");
    expect(handbagDb.restoreHandbagSku).toHaveBeenCalledWith("ELARA", "VESTRA");
  });
});
