import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const handbagDb = vi.hoisted(() => ({
  createHandbagStyleParent: vi.fn(),
  updateHandbagStyleParent: vi.fn(),
  upsertHandbagStyle: vi.fn(),
}));

vi.mock("./db", () => ({
  getHandbagStyleParents: vi.fn().mockResolvedValue([]),
  createHandbagStyleParent: handbagDb.createHandbagStyleParent,
  updateHandbagStyleParent: handbagDb.updateHandbagStyleParent,
  upsertHandbagStyle: handbagDb.upsertHandbagStyle,
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
  });

  it("creates a handbag style before its first SKU", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.handbag.createStyle({ style: "ARIA", seasonality: "New Season", notes: "Campaign bag" }))
      .resolves.toEqual({ style: "ARIA" });
    expect(handbagDb.createHandbagStyleParent).toHaveBeenCalledWith({ style: "ARIA", seasonality: "New Season", notes: "Campaign bag" });
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
      seasonality: "New Season",
      rrp: 199.95,
      cost: 60,
    })).resolves.toEqual({ success: true });
    expect(handbagDb.upsertHandbagStyle).toHaveBeenCalledWith(expect.objectContaining({
      style: "ARIA",
      colour: "BLACK PEBBLE",
      seasonality: "New Season",
    }));
  });
});
