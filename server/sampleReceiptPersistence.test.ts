import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const state = vi.hoisted(() => ({
  existing: undefined as any,
  selectQueue: [] as any[],
  selectWhere: undefined as any,
  updateWhere: undefined as any,
  updateSet: undefined as any,
  inserted: undefined as any,
}));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => ({
  select: () => ({ from: () => ({ where: (condition: any) => {
    state.selectWhere = condition;
    return { limit: async () => state.selectQueue.length ? state.selectQueue.shift() : state.existing ? [state.existing] : [] };
  } }) }),
  update: () => ({ set: (values: any) => {
    state.updateSet = values;
    return { where: async (condition: any) => { state.updateWhere = condition; } };
  } }),
  insert: () => ({ values: async (values: any) => { state.inserted = values; } }),
}) }));
vi.mock("../shared/buySkuRename", async (importOriginal) => ({
  ...await importOriginal<object>(), getStaticSkuBuyRename: vi.fn(() => null),
}));
import { upsertSkuMeta } from "./db";
import { getStaticSkuBuyRename } from "../shared/buySkuRename";
const dialect = new MySqlDialect();
const single = { style: "ROBYN", colour: "ECRU", leather: "SNAKE" };

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://mock");
  state.existing = { id: 1, ...single };
  state.selectQueue = [];
  state.selectWhere = state.updateWhere = state.updateSet = state.inserted = undefined;
  vi.clearAllMocks();
});

describe("physical-SKU sample receipt persistence", () => {
  it("updates every duplicate single-upper row using NULL/blank-normalised identity, not primary alone", async () => {
    await upsertSkuMeta({ ...single, sampleStatus: "received" });
    const query = dialect.sqlToQuery(state.updateWhere);
    expect(query.sql).toContain("COALESCE");
    expect(query.sql).toContain("colour2");
    expect(query.sql).toContain("leather2");
    expect(query.params).toEqual(["ROBYN", "ECRU", "SNAKE", "", ""]);
    expect(state.updateSet.sampleStatus).toBe("received");
  });

  it("resets every exact Upper 2 duplicate without targeting sibling constructions", async () => {
    await upsertSkuMeta({ ...single, colour2: "ROYAL", leather2: "SUEDE", sampleStatus: "waiting" });
    const query = dialect.sqlToQuery(state.updateWhere);
    expect(query.params).toEqual(["ROBYN", "ECRU", "SNAKE", "ROYAL", "SUEDE"]);
    expect(query.sql).not.toMatch(/`id`/);
    expect(state.updateSet.sampleStatus).toBe("waiting");
  });

  it("treats receipt Upper 2 as identity, never as a Buy Session colour edit", async () => {
    state.existing = undefined;
    await upsertSkuMeta({ ...single, colour2: "LIPSTICK", leather2: "SUEDE", sampleStatus: "received" });
    expect(state.inserted).toMatchObject({ colour2: "LIPSTICK", leather2: "SUEDE", sampleStatus: "received" });
    expect(getStaticSkuBuyRename).not.toHaveBeenCalled();
  });

  it("preserves legacy non-receipt details when creating an exact Upper 2 record", async () => {
    state.selectQueue = [[], [{ ...single, isSize11: true, costPrice: 45, rrpOverride: 249.95,
      orderQty: 2, fittingNotes: "Existing fit note", sampleStatus: "waiting" }]];
    await upsertSkuMeta({ ...single, colour2: "ROYAL", leather2: "SUEDE", sampleStatus: "received" });
    expect(state.inserted).toMatchObject({ isSize11: true, costPrice: 45, rrpOverride: 249.95,
      orderQty: 2, fittingNotes: "Existing fit note", sampleStatus: "received" });
  });

  it("retains the colour-edit re-key path for non-receipt updates", async () => {
    await upsertSkuMeta({ ...single, colourOverride: "PETAL", leatherOverride: "NAPPA" });
    expect(getStaticSkuBuyRename).toHaveBeenCalled();
  });
});
