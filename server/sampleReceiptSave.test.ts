import { describe, expect, it, vi } from "vitest";
import { requireTrpcJsonResponse } from "../client/src/lib/trpcResponse";
import { saveSampleReceipt } from "../client/src/lib/sampleReceiptSave";

describe("tRPC response contract", () => {
  it("passes JSON success and tRPC errors through without consuming or rewriting them", async () => {
    for (const status of [200, 400, 401, 500]) {
      const response = new Response('{"result":"unchanged"}', { status, headers: { "content-type": "application/json; charset=utf-8" } });
      expect(requireTrpcJsonResponse(response)).toBe(response);
      expect(await response.json()).toEqual({ result: "unchanged" });
    }
  });
  it("reports an unreachable published API instead of parsing the 404 HTML", () => {
    const response = new Response('<!DOCTYPE html>PRIVATE BODY', { status: 404, headers: { "content-type": "text/html" } });
    expect(() => requireTrpcJsonResponse(response)).toThrow("save service could not be reached");
    expect(() => requireTrpcJsonResponse(response)).not.toThrow("PRIVATE BODY");
  });
  it("rejects SPA HTML even if the proxy says success", () => {
    expect(() => requireTrpcJsonResponse(new Response('<!DOCTYPE html>', { headers: { "content-type": "text/html" } }))).toThrow("webpage instead of a save response");
  });
  it("does not accept a followed sign-in redirect as an API result", () => {
    const response = new Response('{}', { headers: { "content-type": "application/json" } });
    Object.defineProperty(response, "redirected", { value: true });
    expect(() => requireTrpcJsonResponse(response)).toThrow("sign in again");
  });
});

function options() {
  const rollback = vi.fn();
  return { rollback, setPending: vi.fn(), prepare: vi.fn(async () => rollback),
    save: vi.fn(async () => ({ success: true })), reconcile: vi.fn(async () => {}), onError: vi.fn() };
}

describe("receipt save lifecycle", () => {
  it("clears pending and reconciles after a confirmed save", async () => {
    const o = options(); expect(await saveSampleReceipt(o)).toBe(true);
    expect(o.setPending.mock.calls).toEqual([[true], [false]]);
    expect(o.rollback).not.toHaveBeenCalled(); expect(o.reconcile).toHaveBeenCalledOnce();
  });
  it("rolls back an unconfirmed save, reports the error and does not retry it", async () => {
    const o = options(); const error = new Error("webpage instead of save response"); o.save.mockRejectedValue(error);
    expect(await saveSampleReceipt(o)).toBe(false);
    expect(o.rollback).toHaveBeenCalledOnce(); expect(o.onError).toHaveBeenCalledWith(error);
    expect(o.save).toHaveBeenCalledOnce(); expect(o.setPending.mock.calls).toEqual([[true], [false]]);
    expect(o.reconcile).toHaveBeenCalledOnce();
  });
  it("also clears pending when cache preparation fails before any write", async () => {
    const o = options(); o.prepare.mockRejectedValue(new Error("cancel failed"));
    expect(await saveSampleReceipt(o)).toBe(false);
    expect(o.save).not.toHaveBeenCalled(); expect(o.rollback).not.toHaveBeenCalled();
    expect(o.setPending.mock.calls).toEqual([[true], [false]]);
  });
  it("does not leave a spinner waiting on a stalled or rejected refetch", async () => {
    for (const reconcile of [() => new Promise<void>(() => {}), async () => { throw new Error("offline"); }, () => { throw new Error("offline"); }]) {
      const o = { ...options(), reconcile };
      expect(await saveSampleReceipt(o)).toBe(true);
      expect(o.setPending.mock.calls).toEqual([[true], [false]]);
      await Promise.resolve();
    }
  });
});
