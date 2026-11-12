import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";

const state = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  inserted: {} as Record<string, unknown>,
  updated: {} as Record<string, unknown>,
}));

// Replace the driver itself: importing the real helper/router can never write to a DB.
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onDuplicateKeyUpdate: async ({ set }: { set: Record<string, unknown> }) => {
          state.inserted = { ...values };
          state.updated = { ...set };
          const key = `${values.lastName}|${values.season}`;
          const existing = state.rows.get(key);
          state.rows.set(key, existing ? { ...existing, ...set } : {
            status: "waiting_revised",
            notes: null,
            size65Approved: false,
            size7Approved: false,
            size95Approved: false,
            size55Approved: false,
            size6Approved: false,
            size9Approved: false,
            proceedWithSamples: false,
            ...values,
          });
        },
      }),
    }),
  }),
}));

import { lastApprovals } from "../drizzle/schema";
import { upsertLastApproval } from "./db";
import { appRouter } from "./routers";

const lastName = "FERGIE";
const season = "W27";
const key = `${lastName}|${season}`;
const newSizeFields = ["size55Approved", "size6Approved", "size9Approved"] as const;
const allSizeFields = ["size65Approved", "size7Approved", "size95Approved", ...newSizeFields] as const;

function caller() {
  const ctx: TrpcContext = {
    user: null,
    req: { headers: {}, cookies: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

function existingRow() {
  return {
    lastName,
    season,
    status: "approved",
    notes: "Keep the size 7 first-fitting note.",
    size65Approved: true,
    size7Approved: true,
    size95Approved: true,
    size55Approved: true,
    size6Approved: true,
    size9Approved: true,
    proceedWithSamples: true,
  };
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://mock");
  state.rows.clear();
  state.inserted = {};
  state.updated = {};
});
afterEach(() => vi.unstubAllEnvs());

describe("last approval schema", () => {
  it("retains distinct legacy sizes and adds false, non-null defaults for the real new sizes", () => {
    const columns = getTableColumns(lastApprovals);
    for (const field of [...allSizeFields, "proceedWithSamples"] as const) {
      expect(columns[field].name).toBe(field);
      expect(columns[field].notNull).toBe(true);
      expect(columns[field].default).toBe(false);
    }
    expect(columns.size55Approved).not.toBe(columns.size65Approved);
    expect(columns.size9Approved).not.toBe(columns.size95Approved);
  });
});

describe("upsertLastApproval mock persistence", () => {
  it.each(newSizeFields)("stores %s independently without reusing a legacy size", async field => {
    await upsertLastApproval(lastName, undefined, undefined, undefined, undefined, undefined, undefined,
      season, field === "size55Approved" ? true : undefined,
      field === "size6Approved" ? true : undefined,
      field === "size9Approved" ? true : undefined);

    const row = state.rows.get(key)!;
    for (const size of allSizeFields) expect(row[size]).toBe(size === field);
    expect(row.status).toBe("waiting_revised");
    expect(row.notes).toBeNull();
    expect(row.proceedWithSamples).toBe(false);
    expect(state.updated).toEqual({ lastName, season, [field]: true });
  });

  it("retains the old positional size 7 argument and never maps it to another size", async () => {
    await upsertLastApproval(lastName, "approved", "First fitting", false, true, false, false, season,
      true, false, true);
    expect(state.rows.get(key)).toMatchObject({
      size7Approved: true, size55Approved: true, size6Approved: false, size9Approved: true,
      size65Approved: false, size95Approved: false,
    });
  });

  it("does not reset any omitted approvals, notes, status, or samples sign-off", async () => {
    const original = existingRow();
    state.rows.set(key, original);
    await upsertLastApproval(lastName, undefined, undefined, undefined, undefined, undefined, undefined, season);
    expect(state.rows.get(key)).toEqual(original);
    expect(state.updated).toEqual({ lastName, season });
    expect(state.inserted).toEqual({ lastName, season });
  });

  it("updates supplied false/null/status values without disturbing omitted sizes", async () => {
    state.rows.set(key, existingRow());
    await upsertLastApproval(lastName, "waiting_revised", null, undefined, false, undefined, false,
      season, false, undefined, false);
    expect(state.rows.get(key)).toEqual({
      ...existingRow(), status: "waiting_revised", notes: null, size7Approved: false,
      size55Approved: false, size9Approved: false, proceedWithSamples: false,
    });
    expect(state.updated).not.toHaveProperty("size6Approved");
    expect(state.updated).not.toHaveProperty("size65Approved");
    expect(state.updated).not.toHaveProperty("size95Approved");
  });

  it("accepts the legacy signature and preserves season isolation", async () => {
    state.rows.set(key, existingRow());
    await upsertLastApproval(lastName, "approved", "Legacy call", true, true, true, true);
    expect(state.rows.get(`${lastName}|SS26`)).toMatchObject({
      status: "approved", notes: "Legacy call", size65Approved: true, size7Approved: true,
      size95Approved: true, proceedWithSamples: true,
      size55Approved: false, size6Approved: false, size9Approved: false,
    });
    expect(state.rows.get(key)).toEqual(existingRow());
  });
});

describe("lastApproval.upsert router through mock persistence", () => {
  it.each(newSizeFields)("validates and persists an independent %s checkbox-only update", async field => {
    state.rows.set(key, existingRow());
    await expect(caller().lastApproval.upsert({ lastName, season, [field]: false }))
      .resolves.toEqual({ success: true });
    expect(state.rows.get(key)).toEqual({ ...existingRow(), [field]: false });
    expect(state.updated).toEqual({ lastName, season, [field]: false });
  });

  it("preserves size 7 and all omitted fields when adding the new size approvals", async () => {
    state.rows.set(key, { ...existingRow(), size55Approved: false, size6Approved: false, size9Approved: false });
    await caller().lastApproval.upsert({ lastName, season, size55Approved: true, size6Approved: true, size9Approved: true });
    expect(state.rows.get(key)).toEqual(existingRow());
    expect(state.updated).not.toHaveProperty("status");
    expect(state.updated).not.toHaveProperty("notes");
    expect(state.updated).not.toHaveProperty("size7Approved");
  });

  it("persists a size 7-only first-fitting update using the original column", async () => {
    state.rows.set(key, { ...existingRow(), size7Approved: false });
    await caller().lastApproval.upsert({ lastName, season, size7Approved: true });
    expect(state.rows.get(key)).toEqual(existingRow());
    expect(state.updated).toEqual({ lastName, season, size7Approved: true });
  });

  it("preserves omitted notes but permits explicit empty-string and null clearing", async () => {
    state.rows.set(key, existingRow());
    const api = caller();
    await api.lastApproval.upsert({ lastName, season, status: "waiting_revised" });
    expect(state.rows.get(key)?.notes).toBe(existingRow().notes);
    await api.lastApproval.upsert({ lastName, season, notes: "" });
    expect(state.rows.get(key)?.notes).toBe("");
    await api.lastApproval.upsert({ lastName, season, notes: null });
    expect(state.rows.get(key)).toEqual({ ...existingRow(), status: "waiting_revised", notes: null });
  });

  it("accepts unchanged legacy API payloads and defaults the season to SS26", async () => {
    await expect(caller().lastApproval.upsert({
      lastName, status: "approved", notes: "Legacy", size65Approved: true,
      size7Approved: true, size95Approved: true, proceedWithSamples: true,
    })).resolves.toEqual({ success: true });
    expect(state.rows.get(`${lastName}|SS26`)).toEqual({
      ...existingRow(), season: "SS26", notes: "Legacy",
      size55Approved: false, size6Approved: false, size9Approved: false,
    });
  });

  it.each(newSizeFields)("rejects a non-boolean %s without writing", async field => {
    await expect(caller().lastApproval.upsert({ lastName, season, [field]: "true" } as never))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.rows.size).toBe(0);
    expect(state.updated).toEqual({});
  });
});
