import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const emailDb = vi.hoisted(() => ({
  getSpecEmailRecipientGroups: vi.fn(),
  upsertSpecEmailRecipientGroup: vi.fn(),
  deleteSpecEmailRecipientGroup: vi.fn(),
  recordSpecEmailHistory: vi.fn(),
  getSpecEmailHistory: vi.fn(),
}));

const delivery = vi.hoisted(() => ({ sendSpecsEmail: vi.fn() }));

vi.mock("./db", () => ({
  getSpecEmailRecipientGroups: emailDb.getSpecEmailRecipientGroups,
  upsertSpecEmailRecipientGroup: emailDb.upsertSpecEmailRecipientGroup,
  deleteSpecEmailRecipientGroup: emailDb.deleteSpecEmailRecipientGroup,
  recordSpecEmailHistory: emailDb.recordSpecEmailHistory,
  getSpecEmailHistory: emailDb.getSpecEmailHistory,
}));

vi.mock("./resendSpecsEmail", () => ({ sendSpecsEmail: delivery.sendSpecsEmail }));

import { appRouter } from "./routers";

function createCtx(): TrpcContext {
  return {
    user: { id: 7, openId: "owner", name: "Product Team", email: "product@tonybianco.info", loginMethod: null, role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {}, cookies: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  };
}

const attachment = { filename: "CAPPA- TONY BIANCO DEV WINTER 2027.xlsx", base64: "a".repeat(120) };

describe("Specs email recipient and history router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delivery.sendSpecsEmail.mockResolvedValue({ id: "resend_123" });
    emailDb.getSpecEmailRecipientGroups.mockResolvedValue([]);
    emailDb.upsertSpecEmailRecipientGroup.mockResolvedValue({ id: 12, name: "Factory", recipients: ["factory@example.com"], cc: ["developer@example.com"], replyTo: "product@tonybianco.info" });
    emailDb.deleteSpecEmailRecipientGroup.mockResolvedValue(undefined);
    emailDb.recordSpecEmailHistory.mockResolvedValue(undefined);
    emailDb.getSpecEmailHistory.mockResolvedValue([]);
  });

  it("sends CC and reply-to details then records delivery against the style", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.email.sendSpecs({
      recipients: ["factory@example.com"],
      cc: ["developer@example.com"],
      replyTo: "product@tonybianco.info",
      subject: "CAPPA Specs",
      style: "CAPPA",
      last: "CHEEKY/CUBA",
      category: "Ballet Flat",
      season: "Winter 27",
      attachment,
    })).resolves.toEqual({ id: "resend_123" });

    expect(delivery.sendSpecsEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipients: ["factory@example.com"],
      cc: ["developer@example.com"],
      replyTo: "product@tonybianco.info",
    }));
    expect(emailDb.recordSpecEmailHistory).toHaveBeenCalledWith(expect.objectContaining({
      style: "CAPPA",
      season: "Winter 27",
      resendEmailId: "resend_123",
      sentByUserId: 7,
      sentByName: "Product Team",
    }));
  });

  it("saves and lists reusable recipient groups", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.email.saveRecipientGroup({
      name: "Factory",
      recipients: ["factory@example.com"],
      cc: ["developer@example.com"],
      replyTo: "product@tonybianco.info",
    })).resolves.toEqual({ group: expect.objectContaining({ name: "Factory" }) });
    expect(emailDb.upsertSpecEmailRecipientGroup).toHaveBeenCalledWith(expect.objectContaining({ name: "Factory" }));

    await expect(caller.email.listRecipientGroups()).resolves.toEqual([]);
    await expect(caller.email.getSpecsHistory({ style: "CAPPA", season: "Winter 27" })).resolves.toEqual([]);
  });

  it("removes a recipient group without touching delivery history", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.email.deleteRecipientGroup({ id: 12 })).resolves.toEqual({ success: true });
    expect(emailDb.deleteSpecEmailRecipientGroup).toHaveBeenCalledWith(12);
    expect(emailDb.recordSpecEmailHistory).not.toHaveBeenCalled();
  });
});
