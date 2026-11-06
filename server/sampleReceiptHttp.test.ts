import express from "express";
import { createServer, type Server } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiNotFound, apiErrorHandler } from "./apiResponseGuards";
import { requireTrpcJsonResponse } from "../client/src/lib/trpcResponse";

const saved = vi.hoisted(() => ({ upsert: vi.fn(async (_input: unknown) => {}) }));
vi.mock("./db", async (original) => ({ ...await original<object>(), upsertSkuMeta: saved.upsert }));
import { appRouter, type AppRouter } from "./routers";

let server: Server, base: string;
beforeEach(async () => {
  saved.upsert.mockReset(); saved.upsert.mockResolvedValue(undefined);
  const app = express(); app.use(express.json());
  app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext: ({ req, res }) => ({ user: null, req, res }) }));
  app.use('/api', apiNotFound); app.use(apiErrorHandler);
  app.get('*', (_req, res) => res.type('html').send('<!DOCTYPE html><h1>SKU Dash</h1>'));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address(); if (!addr || typeof addr === 'string') throw Error('Missing test port');
  base = `http://127.0.0.1:${addr.port}`;
});
afterEach(async () => {
  server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
const input = { style: "GATOR", colour: "CHOCOLATE", leather: "VENICE", colour2: "", leather2: "", sampleStatus: "received" as const };
const client = () => createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: `${base}/api/trpc`, transformer: superjson,
  fetch: async (url, init) => requireTrpcJsonResponse(await fetch(url, { ...init, credentials: 'include' })),
})] });

describe('sample receipt HTTP contract', () => {
  it('saves a batched receipt via the actual router with both uppers, returning decodable JSON', async () => {
    expect(await client().sku.update.mutate(input)).toEqual({ success: true });
    expect(saved.upsert).toHaveBeenCalledWith(input); expect(saved.upsert).toHaveBeenCalledOnce();
  });
  it('rejects an HTML 404 gateway response with actionable wording before JSON parsing', async () => {
    const fetches = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => requireTrpcJsonResponse(await fetch(url, init)));
    const offline = createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({
      url: `${base}/unavailable-api`, transformer: superjson, fetch: fetches,
    })] });
    await expect(offline.sku.update.mutate(input)).rejects.toThrow('save service could not be reached');
    expect(fetches).toHaveBeenCalledOnce(); expect(saved.upsert).not.toHaveBeenCalled();
  });
  it('serialises a persistence error as JSON rather than serving HTML and does not retry', async () => {
    saved.upsert.mockRejectedValue(new Error('Receipt store unavailable'));
    await expect(client().sku.update.mutate(input)).rejects.toThrow('Receipt store unavailable');
    expect(saved.upsert).toHaveBeenCalledOnce();
  });
  it('returns JSON for a missing API route rather than the frontend document', async () => {
    const response = await fetch(`${base}/api/missing?batch=1`, { method: 'POST' });
    expect(response.status).toBe(404); expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toMatchObject([{ error: { json: { data: { code: 'NOT_FOUND' } } } }]);
  });
  it('returns JSON for malformed request bodies before the router and makes no write', async () => {
    const response = await fetch(`${base}/api/trpc/sku.update?batch=1`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' });
    expect(response.status).toBe(400); expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toMatchObject([{ error: { json: { data: { code: 'BAD_REQUEST' } } } }]);
    expect(saved.upsert).not.toHaveBeenCalled();
  });
  it('keeps unknown tRPC procedures as JSON errors and page navigation as HTML', async () => {
    const api = await fetch(`${base}/api/trpc/does.not.exist`);
    expect(api.status).toBe(404); expect(api.headers.get('content-type')).toContain('application/json');
    const page = await fetch(`${base}/overview`); expect(page.status).toBe(200); expect(await page.text()).toContain('<!DOCTYPE html>');
  });
});
