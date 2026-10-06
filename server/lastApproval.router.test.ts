import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getAllLastApprovals: vi.fn().mockResolvedValue([]),
  upsertLastApproval: vi.fn().mockResolvedValue(undefined),
  getDeletedLasts: vi.fn().mockResolvedValue([]),
  deleteLast: vi.fn().mockResolvedValue(undefined),
  restoreDeletedLast: vi.fn().mockResolvedValue(undefined),
}));

import { appRouter } from "./routers";
import * as db from "./db";

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { headers: {}, cookies: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("lastApproval.upsert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists notes against the active season", async () => {
    const caller = appRouter.createCaller(createCtx());

    await expect(caller.lastApproval.upsert({
      lastName: "FERGIE",
      season: "W27",
      status: "waiting_revised",
      notes: "Fitting 1/2 size short in length.",
    })).resolves.toEqual({ success: true });

    expect(db.upsertLastApproval).toHaveBeenCalledWith(
      "FERGIE",
      "waiting_revised",
      "Fitting 1/2 size short in length.",
      undefined,
      undefined,
      undefined,
      undefined,
      "W27",
    );
  });

  it("deletes and restores only the active season's Last Approval row", async () => {
    const caller = appRouter.createCaller(createCtx());

    await expect(caller.lastApproval.delete({ lastName: "NIKOH", season: "W27" }))
      .resolves.toEqual({ success: true });
    expect(db.deleteLast).toHaveBeenCalledWith("NIKOH", "W27");

    await expect(caller.lastApproval.restore({ lastName: "NIKOH", season: "W27" }))
      .resolves.toEqual({ success: true });
    expect(db.restoreDeletedLast).toHaveBeenCalledWith("NIKOH", "W27");
  });
});
