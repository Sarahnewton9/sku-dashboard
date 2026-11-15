import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { TrpcContext } from "./_core/context";

const state = vi.hoisted(() => ({
  rows: new Map<number, Record<string, unknown>>(),
  nextId: 1,
  inserts: [] as { table: string; values: Record<string, unknown> }[],
  updates: [] as { table: string; values: Record<string, unknown>; id: number }[],
}));

// Mock the driver, not the helper: all DB calls are intercepted even through the real router.
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    insert: (table: Parameters<typeof getTableName>[0]) => ({
      values: async (values: Record<string, unknown>) => {
        const id = state.nextId++;
        state.inserts.push({ table: getTableName(table), values: { ...values } });
        state.rows.set(id, { id, ...values });
        return [{ insertId: id }];
      },
    }),
    update: (table: Parameters<typeof getTableName>[0]) => ({
      set: (values: Record<string, unknown>) => ({
        where: async (predicate: Parameters<MySqlDialect["sqlToQuery"]>[0]) => {
          const query = new MySqlDialect().sqlToQuery(predicate);
          expect(query.sql).toBe("`fitting_sessions`.`id` = ?");
          expect(query.params).toHaveLength(1);
          const id = query.params[0] as number;
          state.updates.push({ table: getTableName(table), values: { ...values }, id });
          const row = state.rows.get(id);
          if (row) state.rows.set(id, { ...row, ...values });
        },
      }),
    }),
  }),
}));

import { createFittingSession, updateFittingSession } from "./db";
import { appRouter } from "./routers";

function caller() {
  const ctx: TrpcContext = {
    user: null,
    req: { headers: {}, cookies: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

const base = { style: "FERGIE", fitModel: "Model A", sessionDate: "2026-11-15", season: "W27" };
const existing = {
  id: 21, ...base, notes: "Keep original fitting notes", sampleDate: "2026-11-10",
  sampleType: "Fitting Sample", sampleSize: "37", createdAt: new Date("2026-11-14T00:00:00Z"),
};

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://mock");
  state.rows.clear();
  state.nextId = 1;
  state.inserts = [];
  state.updates = [];
});
afterEach(() => vi.unstubAllEnvs());

for (const access of ["helper", "router"] as const) {
  describe(`fitting session ${access} persistence`, () => {
    const create = async (data: Parameters<typeof createFittingSession>[0]) => access === "helper"
      ? createFittingSession(data)
      : (await caller().fittingSession.create(data)).id;
    const update = async (data: Parameters<typeof updateFittingSession>[0]) => access === "helper"
      ? updateFittingSession(data)
      : caller().fittingSession.update(data);

    it.each([undefined, null, "", "   "])("defaults missing or blank new sample size %j to 7", async sampleSize => {
      const id = await create({ ...base, ...(sampleSize === undefined ? {} : { sampleSize }) });
      expect(state.rows.get(id)).toEqual({ id, ...base, notes: null, sampleDate: null, sampleType: null, sampleSize: "7" });
      expect(state.inserts).toEqual([{ table: "fitting_sessions", values: { ...base, notes: null, sampleDate: null, sampleType: null, sampleSize: "7" } }]);
      expect(state.updates).toEqual([]);
    });

    it.each(["5", "6.5", "7", "8", "9", "9.5", "37", "Custom legacy size", " 37 "])("preserves explicit meaningful new size %j verbatim", async sampleSize => {
      const id = await create({ ...base, sampleSize, notes: "New fitting notes", sampleDate: "2026-11-10", sampleType: "Proto" });
      expect(state.rows.get(id)).toEqual({ id, ...base, sampleSize, notes: "New fitting notes", sampleDate: "2026-11-10", sampleType: "Proto" });
    });

    it.each([undefined, null, "Proto", "Original", "Revised Last", "Fitting Sample"])("defaults all new sample types %j to size 7 without an approval write", async sampleType => {
      state.rows.set(existing.id, { ...existing });
      const id = await create({ ...base, sampleType });
      expect(state.rows.get(id)?.sampleSize).toBe("7");
      expect(state.rows.get(id)?.sampleType).toBe(sampleType ?? null);
      expect(state.rows.get(existing.id)).toEqual(existing);
      expect(state.inserts.map(call => call.table)).toEqual(["fitting_sessions"]);
      expect(state.updates).toEqual([]);
    });

    it("keeps the existing default season for legacy create callers", async () => {
      const { season: _season, ...legacyInput } = base;
      const id = await create(legacyInput);
      expect(state.rows.get(id)).toMatchObject({ season: "SS26", sampleSize: "7" });
    });

    it.each([null, "7", "6.5", "9.5", "8", "37"])("leaves omitted historical sample size %j untouched when editing notes", async sampleSize => {
      state.rows.set(existing.id, { ...existing, sampleSize });
      await update({ id: existing.id, notes: "Changed notes" });
      expect(state.rows.get(existing.id)).toEqual({ ...existing, sampleSize, notes: "Changed notes" });
      expect(state.updates).toEqual([{ table: "fitting_sessions", id: existing.id, values: { notes: "Changed notes" } }]);
    });

    it.each(["5", "6.5", "7", "8", "9", "9.5", "37"])("updates only size to %s, not notes/model/dates/type or another fitting", async sampleSize => {
      state.rows.set(existing.id, { ...existing });
      const other = { ...existing, id: 22, style: "OTHER", sampleSize: "38" };
      state.rows.set(other.id, other);
      await update({ id: existing.id, sampleSize });
      expect(state.rows.get(existing.id)).toEqual({ ...existing, sampleSize });
      expect(state.rows.get(other.id)).toEqual(other);
      expect(state.updates).toEqual([{ table: "fitting_sessions", id: existing.id, values: { sampleSize } }]);
      expect(state.inserts).toEqual([]);
    });

    it("does not apply new-session defaults or perform a write for an id-only update", async () => {
      state.rows.set(existing.id, { ...existing, sampleSize: null });
      await update({ id: existing.id });
      expect(state.rows.get(existing.id)).toEqual({ ...existing, sampleSize: null });
      expect(state.updates).toEqual([]);
    });

    it.each([null, ""])("allows explicit legacy sample-size clearing to %j without changing other fields", async sampleSize => {
      state.rows.set(existing.id, { ...existing });
      await update({ id: existing.id, sampleSize });
      expect(state.rows.get(existing.id)).toEqual({ ...existing, sampleSize });
      expect(state.updates).toEqual([{ table: "fitting_sessions", id: existing.id, values: { sampleSize } }]);
    });

    it("preserves legacy size 37 while updating only explicitly supplied metadata", async () => {
      state.rows.set(existing.id, { ...existing });
      const values = { fitModel: "Model B", sessionDate: "2026-11-16", sampleDate: null, sampleType: "Revised Last", notes: null };
      await update({ id: existing.id, ...values });
      expect(state.rows.get(existing.id)).toEqual({ ...existing, ...values });
      expect(state.updates).toEqual([{ table: "fitting_sessions", id: existing.id, values }]);
    });
  });
}
