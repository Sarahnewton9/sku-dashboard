import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const state = vi.hoisted(() => ({ queues: {} as Record<string, any[][]>, writes: [] as any[], transactions: 0, fail: false }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => {
  const name = (table: any) => table[Symbol.for("drizzle:Name")];
  const db: any = {
    transaction: async (fn: any) => { state.transactions++; const saved = [...state.writes]; try { return await fn(db); } catch (error) { state.writes = saved; throw error; } },
    select: () => ({ from: (table: any) => ({ where: (condition: any) => {
      const rows = state.queues[name(table)]?.shift() ?? [];
      return { then: (resolve: any) => Promise.resolve(rows).then(resolve), for: async () => rows, limit: async () => rows };
    } }) }),
    update: (table: any) => ({ set: (value: any) => ({ where: async (condition: any) => { state.writes.push({ table: name(table), value, condition, kind: "update" }); } }) }),
    insert: (table: any) => ({ values: async (value: any) => { if (state.fail) throw new Error("write failed"); state.writes.push({ table: name(table), value, kind: "insert" }); } }),
    delete: (table: any) => ({ where: async (condition: any) => { state.writes.push({ table: name(table), condition, kind: "delete" }); } }),
  }; return db;
} }));
import { updateCustomSku, upsertSkuMeta } from "./db";
import { selectStaticIdentity } from "./skuIdentityPreservation";
import { snapshotSkuIdentitySpecs } from "../shared/skuIdentitySpecPreservation";
const dialect = new MySqlDialect();
const previous = { style: "TEST", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" };
const next = { ...previous, colour: "IVORY" };
const current = { ...previous, id: 1, season: "SS26" };
const spec = (id: number, colour: string, component: string, value: string | null, updatedAt = id) => ({ id, colour, component, value, updatedAt });
const custom = (id: number, colour: string, value: string | null, updatedAt = id) => ({ id, colour, value, updatedAt, title: "Bow", section: "components", sortOrder: 4 });
beforeEach(() => { vi.stubEnv("DATABASE_URL", "mysql://mock-only"); state.queues = {}; state.writes = []; state.transactions = 0; state.fail = false; });
function setupCustom(rows: any[] = [current]) { state.queues.custom_skus = [[current], rows]; state.queues.sku_meta = [[]]; }

describe("identity-only saved specification snapshot", () => {
  it("uses exact then raw fallback and latest timestamp/id; explicit blank/null wins", () => {
    const result = snapshotSkuIdentitySpecs({ previous, next, specRows: [spec(1, "ECRU", "lining", "LEGACY"), spec(2, "ECRU SNAKE/ROYAL SUEDE", "lining", "older", 5), spec(3, "ECRU SNAKE/ROYAL SUEDE", "lining", null, 8), spec(4, "ECRU SNAKE/ROYAL SUEDE", "lining", "", 8), spec(5, "ECRU", "optional", "keep")], customRows: [custom(1, "__all__", "shared"), custom(2, "ECRU", "legacy"), custom(3, "ECRU SNAKE/ROYAL SUEDE", null)] });
    expect(result.components).toEqual([{ component: "lining", value: "" }, { component: "optional", value: "keep" }]);
    expect(result.customCells[0]).toMatchObject({ representativeId: 1, value: null, sortOrder: 4 });
  });
  it("changes only Upper1 equal to previous default, preserving custom text", () => {
    const snapshot = (value: string | null) => snapshotSkuIdentitySpecs({ previous, next, specRows: [spec(1, "ECRU", "upper_1", value)], customRows: [] });
    expect(snapshot("ECRU SNAKE/ROYAL SUEDE").components[0].value).toBe("IVORY SNAKE/ROYAL SUEDE");
    expect(snapshot("hand finished custom upper").components[0].value).toBe("hand finished custom upper");
    expect(snapshot(null).components[0].value).toBeNull();
  });
  it("does not invent defaults from another SKU or unsaved groups", () => {
    const result = snapshotSkuIdentitySpecs({ previous, next, specRows: [spec(1, "BLACK", "lining", "other")], customRows: [custom(1, "BLACK", "other")] });
    expect(result.components).toEqual([]); expect(result.customCells).toEqual([]);
  });
});

describe("transactional physical identity correction", () => {
  it("preserves omitted Upper2, shared/history/group IDs and unselected mirror siblings", async () => {
    setupCustom([current, { ...current, id: 2, season: "W27", colour: " ecru ", colour2: " royal " }, { ...current, id: 3, season: "W27", colour2: null, leather2: null }, { ...current, id: 4, season: "W27", colour2: "LIPSTICK" }]);
    state.queues.style_specs = [[spec(1, "ECRU", "lining", "legacy"), spec(2, "ECRU SNAKE/ROYAL SUEDE", "upper_1", "ECRU SNAKE/ROYAL SUEDE")]];
    state.queues.spec_custom_rows = [[custom(10, "__all__", "shared"), custom(11, "BLACK", "sibling")]];
    await updateCustomSku(1, "IVORY", "SNAKE");
    const skuWrites = state.writes.filter(row => row.table === "custom_skus");
    expect(skuWrites.map(row => dialect.sqlToQuery(row.condition).params)).toEqual([[1], [2]]);
    expect(skuWrites.every(row => !("colour2" in row.value) && !("leather2" in row.value))).toBe(true);
    expect(state.writes.filter(row => row.table === "style_specs").map(row => row.value)).toEqual([expect.objectContaining({ colour: "IVORY SNAKE/ROYAL SUEDE", component: "lining", value: "legacy" }), expect.objectContaining({ component: "upper_1", value: "IVORY SNAKE/ROYAL SUEDE" })]);
    expect(state.writes.filter(row => row.table === "spec_custom_rows")).toEqual([expect.objectContaining({ kind: "insert", value: expect.objectContaining({ colour: "IVORY SNAKE/ROYAL SUEDE", value: "shared", sortOrder: 4 }) })]);
    expect(state.writes.some(row => row.kind === "delete")).toBe(false); expect(state.transactions).toBe(1);
  });
  it("rejects active target collision before any writes", async () => {
    setupCustom([current, { ...next, id: 5, season: "SS26" }]);
    await expect(updateCustomSku(1, "IVORY", "SNAKE")).rejects.toThrow("already exists"); expect(state.writes).toEqual([]);
  });
  it("rejects mirror target collision before changing source", async () => {
    setupCustom([current, { ...current, id: 2, season: "W27" }, { ...next, id: 5, season: "W27" }]);
    await expect(updateCustomSku(1, "IVORY", "SNAKE")).rejects.toThrow("already exists"); expect(state.writes).toEqual([]);
  });
  it("rekeys purchases without touching quantities or locked sessions in one transaction", async () => {
    setupCustom(); state.queues.buy_session_items = [[{ ...previous, id: 8, sessionId: 7, auQty: 2, usaQty: 3, nycQty: 4, laQty: 5, qty: 14 }], []]; state.queues.buy_sessions = [[{ id: 7, isLocked: true }]];
    await updateCustomSku(1, "IVORY", "SNAKE");
    expect(state.writes.filter(row => row.table === "buy_session_items")).toEqual([expect.objectContaining({ value: next, kind: "update" })]); expect(state.transactions).toBe(1);
  });
  it("rolls back identity and buys if materialization fails", async () => {
    setupCustom(); state.queues.style_specs = [[spec(1, "ECRU", "lining", "saved")]]; state.fail = true;
    await expect(updateCustomSku(1, "IVORY", "SNAKE")).rejects.toThrow("write failed"); expect(state.writes).toEqual([]);
  });
  it("allows explicit Upper2 clearing but not omission", async () => {
    setupCustom(); await updateCustomSku(1, "IVORY", "SNAKE", "", ""); expect(state.writes.find(row => row.table === "custom_skus").value).toMatchObject({ colour2: null, leather2: null });
  });
  it("static correction derives source secondary from raw data and writes just selected metadata ID", async () => {
    state.queues.sku_meta = [[{ ...previous, id: 6, colourOverride: "CREAM" }]];
    state.queues.style_specs = [[spec(1, "CREAM SNAKE/ROYAL SUEDE", "lining", null)]];
    await upsertSkuMeta({ style: "TEST", colour: "ECRU", leather: "SNAKE", colourOverride: "IVORY", sourceColour2: "ROYAL", sourceLeather2: "SUEDE" });
    expect(state.writes.find(row => row.table === "style_specs").value).toMatchObject({ colour: "IVORY SNAKE/ROYAL SUEDE", value: null });
    expect(dialect.sqlToQuery(state.writes.find(row => row.table === "sku_meta").condition).params).toEqual([6]); expect(state.transactions).toBe(1);
  });
  it("static ambiguous source rejects instead of updating Upper2 siblings", async () => {
    state.queues.sku_meta = [[{ ...previous, id: 6 }, { ...previous, colour2: "LIPSTICK", id: 7 }]];
    await expect(upsertSkuMeta({ style: "TEST", colour: "ECRU", leather: "SNAKE", colourOverride: "IVORY" })).rejects.toThrow("Ambiguous"); expect(state.writes).toEqual([]);
  });
  it("selects exact original Upper2 independent of requested next upper", () => {
    const library: any = { meta: [{ ...previous, id: 6 }, { ...previous, colour2: "LIPSTICK", id: 7 }], raw: [], custom: [] };
    expect(selectStaticIdentity(library, { ...previous, colour2: "BLACK", sourceColour2: "ROYAL", sourceLeather2: "SUEDE" }).metadata?.id).toBe(6);
  });
  it("derives original physical source from raw data when no metadata override exists", () => {
    const library: any = { meta: [], raw: [previous], custom: [] };
    expect(selectStaticIdentity(library, { style: "TEST", colour: "ECRU", leather: "SNAKE", sourceColour2: "ROYAL", sourceLeather2: "SUEDE" }).previous).toEqual(previous);
  });
  it("overrides only latest exact target cells, never the source or other season history", async () => {
    setupCustom();
    state.queues.style_specs = [[spec(1, "ECRU", "lining", null), spec(2, "IVORY SNAKE/ROYAL SUEDE", "lining", "historical", 5), spec(3, "IVORY SNAKE/ROYAL SUEDE", "lining", "latest", 9)]];
    state.queues.spec_custom_rows = [[custom(10, "__all__", "shared"), custom(11, "IVORY SNAKE/ROYAL SUEDE", "history", 5), custom(12, "IVORY SNAKE/ROYAL SUEDE", "latest", 9)]];
    await updateCustomSku(1, "IVORY", "SNAKE");
    const cells = state.writes.filter(row => row.table === "style_specs" || row.table === "spec_custom_rows");
    expect(cells.map(row => dialect.sqlToQuery(row.condition).params)).toEqual([["TEST", 3], ["TEST", 12]]);
    expect(cells.map(row => row.value.value)).toEqual([null, "shared"]);
  });
});
