import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { findSpecColourMapValue } from "../shared/specColourKey";

const state = vi.hoisted(() => ({
  rows: [] as any[], writes: [] as any[], nextId: 100, locks: 0, transactions: 0,
  failInsert: false, failAfterUpdate: false, tail: Promise.resolve() as Promise<unknown>,
}));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => {
  const dialect = new MySqlDialect();
  function matches(row: any, condition: any) {
    const query = dialect.sqlToQuery(condition);
    let offset = 0;
    const terms = Array.from(query.sql.matchAll(/`spec_custom_rows`\.`(\w+)`\s*(=\s*\?|in\s*\(([^)]*)\))/gi));
    return terms.map(term => {
      const size = term[3] ? (term[3].match(/\?/g) ?? []).length : 1;
      const values = query.params.slice(offset, offset + size);
      offset += size;
      return values.includes(row[term[1]]);
    }).every(Boolean);
  }
  const db = {
    transaction: (fn: any) => {
      const run = state.tail.catch(() => undefined).then(async () => {
        state.transactions++;
        const before = structuredClone(state.rows);
        try { return await fn(db); } catch (error) { state.rows = before; throw error; }
      });
      state.tail = run;
      return run;
    },
    select: () => ({ from: () => ({ where: (condition: any) => {
      const read = () => structuredClone(state.rows.filter(row => matches(row, condition)));
      return {
        then: (resolve: any, reject: any) => Promise.resolve(read()).then(resolve, reject),
        for: async (lock: string) => { expect(lock).toBe("update"); state.locks++; return read(); },
      };
    } }) }),
    update: () => ({ set: (value: any) => ({ where: async (condition: any) => {
      state.writes.push({ value, ids: state.rows.filter(row => matches(row, condition)).map(row => row.id) });
      state.rows = state.rows.map(row => matches(row, condition) ? { ...row, ...value } : row);
      if (state.failAfterUpdate) throw new Error("update failed");
    } }) }),
    insert: () => ({ values: async (value: any) => {
      if (state.failInsert) throw new Error("insert failed");
      const id = state.nextId++;
      state.writes.push({ value, ids: [id] });
      state.rows.push({ ...value, id, createdAt: new Date(), updatedAt: new Date() });
      return [{ insertId: id }];
    } }),
    delete: () => { throw new Error("Editing must never delete a custom row"); },
  };
  return db;
} }));

import { renameSpecCustomRowGroup, updateSpecCustomRowValue, upsertCustomRowForColour } from "./db";
const colours = ["LEOPARD PONY/RED NAPPA", "TIGER PONY/PINK METALLIC", "BLACK SPECKLE/MILK CAPRETTO"];
function row(id: number, colour: string, value: string, extra: Record<string, unknown> = {}) {
  return { id, style: "LAUREN", section: "components", title: "Piping", colour, value, sortOrder: 4,
    createdAt: new Date("2026-11-10T01:00:00Z"), updatedAt: new Date("2026-11-10T01:00:00Z"), ...extra };
}
const request = { allRowId: 1, style: "LAUREN", section: "components", title: "Piping", sortOrder: 4,
  targetColour: "VINO LUMIA VELVET", newValue: "VINO PIPING", currentSharedValue: "STALE CLIENT VALUE", allColours: ["VINO LUMIA VELVET"] };
function displayed(colour: string) {
  const cells = new Map<string, any>(state.rows.map(item => [item.colour, item]));
  return (findSpecColourMapValue(cells, colour) ?? cells.get("__all__"))?.value;
}
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://mock-only");
  state.rows = []; state.writes = []; state.nextId = 100; state.locks = 0; state.transactions = 0;
  state.failInsert = false; state.failAfterUpdate = false; state.tail = Promise.resolve();
});

describe("Custom row title-only group editing", () => {
  it("renames all three populated LAUREN cells without changing their values, keys, IDs or order", async () => {
    state.rows = colours.map((colour, index) => row(index + 1, colour, `PIPING ${index + 1}`));
    state.rows.push(row(10, "__all__", "OTHER STYLE", { style: "OTHER" }), row(11, "BLACK", "OTHER SECTION", { section: "heel" }));
    const before = structuredClone(state.rows);
    const result = await renameSpecCustomRowGroup({ id: 2, style: "LAUREN", title: "Leather Piping" });
    expect(result).toHaveLength(3);
    expect(state.rows).toEqual(before.map(item => item.id <= 3 ? { ...item, title: "Leather Piping" } : item));
    expect(state.writes).toEqual([{ value: { title: "Leather Piping" }, ids: [1, 2, 3] }]);
    expect(state.locks).toBe(1);
  });
  it("normalizes section/title case and whitespace for group identity", async () => {
    state.rows = [row(1, "BLACK", "ONE"), row(2, "WHITE", "TWO", { title: "  piping  ", section: " COMPONENTS " })];
    await renameSpecCustomRowGroup({ id: 1, style: "LAUREN", title: "New Piping" });
    expect(state.rows.map(item => item.title)).toEqual(["New Piping", "New Piping"]);
    expect(state.rows.map(item => item.value)).toEqual(["ONE", "TWO"]);
  });
  it("renames only the given unnamed placeholder", async () => {
    state.rows = [row(1, "__all__", "FIRST", { title: "" }), row(2, "__all__", "SECOND", { title: " " })];
    await renameSpecCustomRowGroup({ id: 1, style: "LAUREN", title: "Piping" });
    expect(state.rows.map(item => item.title)).toEqual(["Piping", " "]);
    expect(state.rows.map(item => item.value)).toEqual(["FIRST", "SECOND"]);
  });
  it("rejects collision with a different titled group rather than merging values", async () => {
    state.rows = [row(1, "__all__", "PIPING"), row(2, "__all__", "BINDING", { title: "  leather   binding " })];
    const before = structuredClone(state.rows);
    await expect(renameSpecCustomRowGroup({ id: 1, style: "LAUREN", title: "Leather Binding" })).rejects.toThrow("already exists");
    expect(state.rows).toEqual(before);
    expect(state.writes).toEqual([]);
  });
  it("allows a same-normalized-name rename and an identical title in another section", async () => {
    state.rows = [row(1, "BLACK", "KEEP"), row(2, "BLACK", "HEEL", { title: "Binding", section: "heel" })];
    await renameSpecCustomRowGroup({ id: 1, style: "LAUREN", title: " PIPING " });
    await renameSpecCustomRowGroup({ id: 1, style: "LAUREN", title: "Binding" });
    expect(state.rows.map(item => item.value)).toEqual(["KEEP", "HEEL"]);
  });
  it.each([{ id: 999, style: "LAUREN" }, { id: 1, style: "OTHER" }])("rejects missing or wrong-style anchors: %j", async (data) => {
    state.rows = [row(1, "BLACK", "KEEP")];
    await expect(renameSpecCustomRowGroup({ ...data, title: "New" })).rejects.toThrow("not found");
    expect(state.writes).toEqual([]);
  });
  it("rolls back a failed title update", async () => {
    state.rows = [row(1, "BLACK", "ONE"), row(2, "WHITE", "TWO")];
    const before = structuredClone(state.rows); state.failAfterUpdate = true;
    await expect(renameSpecCustomRowGroup({ id: 1, style: "LAUREN", title: "New" })).rejects.toThrow("update failed");
    expect(state.rows).toEqual(before);
  });
});

describe("Custom row value-only editing", () => {
  it("does not overwrite a newer title, keys, order or sibling values", async () => {
    state.rows = [row(1, "BLACK", "OLD", { title: "Renamed Piping" }), row(2, "WHITE", "KEEP")];
    const before = structuredClone(state.rows);
    const result = await updateSpecCustomRowValue({ id: 1, style: "LAUREN", value: "NEW" });
    expect(result).toEqual({ ...before[0], value: "NEW" });
    expect(state.rows).toEqual([{ ...before[0], value: "NEW" }, before[1]]);
    expect(state.writes).toEqual([{ value: { value: "NEW" }, ids: [1] }]);
  });
  it("persists an intentional blank", async () => {
    state.rows = [row(1, "BLACK", "OLD")];
    expect((await updateSpecCustomRowValue({ id: 1, style: "LAUREN", value: "" })).value).toBe("");
  });
  it.each([{ id: 999, style: "LAUREN" }, { id: 1, style: "OTHER" }])("rejects missing or wrong-style cells: %j", async (data) => {
    state.rows = [row(1, "BLACK", "KEEP")];
    await expect(updateSpecCustomRowValue({ ...data, value: "NEW" })).rejects.toThrow("not found");
    expect(state.writes).toEqual([]);
  });
  it("rolls back a failed cell update", async () => {
    state.rows = [row(1, "BLACK", "KEEP")];
    const before = structuredClone(state.rows); state.failAfterUpdate = true;
    await expect(updateSpecCustomRowValue({ id: 1, style: "LAUREN", value: "NEW" })).rejects.toThrow("update failed");
    expect(state.rows).toEqual(before);
  });
});

describe("Exact per-colour overrides retain persisted fallback", () => {
  it("keeps shared plus all first-three and historical values when adding a new-colour override", async () => {
    state.rows = [row(1, "__all__", "PERSISTED SHARED"), ...colours.map((colour, index) => row(index + 2, colour, `PIPING ${index + 1}`)), row(9, "HISTORICAL", "OLD SEASON")];
    const before = structuredClone(state.rows);
    const result = await upsertCustomRowForColour(request);
    expect(state.rows.slice(0, before.length)).toEqual(before);
    expect(state.rows.at(-1)).toMatchObject({ colour: request.targetColour, value: "VINO PIPING", title: "Piping", sortOrder: 4 });
    expect(result).toMatchObject({ newRepId: 1, wasExploded: false });
    expect(displayed("UNSEEN HISTORICAL COLOUR")).toBe("PERSISTED SHARED");
    expect(state.rows.some(item => item.value === request.currentSharedValue)).toBe(false);
  });
  it("uses persisted anchor title/section/order when input metadata is stale after a rename", async () => {
    state.rows = [row(1, "__all__", "KEEP", { title: "Renamed Piping", section: "upper", sortOrder: 7 })];
    await upsertCustomRowForColour(request);
    expect(state.rows.at(-1)).toMatchObject({ title: "Renamed Piping", section: "upper", sortOrder: 7 });
    expect(state.rows[0].value).toBe("KEEP");
  });
  it("accepts a specific representative even if __all__ has a higher ID", async () => {
    state.rows = [row(1, "BLACK", "BLACK PIPING"), row(2, "__all__", "SHARED")];
    const before = structuredClone(state.rows);
    await upsertCustomRowForColour(request);
    expect(state.rows.slice(0, 2)).toEqual(before);
  });
  it("saves a full-label blank override without reviving or erasing raw/shared fallback", async () => {
    state.rows = [row(1, "__all__", "SHARED"), row(2, "BLACK", "RAW")];
    await upsertCustomRowForColour({ ...request, targetColour: " black nappa ", newValue: "" });
    expect(displayed("BLACK NAPPA")).toBe("");
    expect(displayed("BLACK SUEDE")).toBe("RAW");
    expect(state.rows[0].value).toBe("SHARED");
    expect(state.rows[1].value).toBe("RAW");
  });
  it("chooses the newest duplicate exact target by timestamp, not first or highest ID", async () => {
    state.rows = [row(1, "__all__", "SHARED"), row(2, request.targetColour, "LATEST", { updatedAt: new Date("2026-11-11T02:00:00Z") }), row(3, request.targetColour, "OLDER")];
    await upsertCustomRowForColour(request);
    expect(state.rows.map(item => item.value)).toEqual(["SHARED", "VINO PIPING", "OLDER"]);
    expect(state.writes[0].ids).toEqual([2]);
  });
  it("breaks equal duplicate timestamps by highest ID", async () => {
    state.rows = [row(1, "__all__", "SHARED"), row(2, request.targetColour, "OLD"), row(3, request.targetColour, "LAST")];
    await upsertCustomRowForColour(request);
    expect(state.writes[0].ids).toEqual([3]);
  });
  it.each([{ allRowId: 999, style: "LAUREN" }, { allRowId: 1, style: "OTHER" }])("rejects missing or wrong-style anchors: %j", async (data) => {
    state.rows = [row(1, "__all__", "KEEP")];
    await expect(upsertCustomRowForColour({ ...request, ...data })).rejects.toThrow("not found");
    expect(state.writes).toEqual([]);
  });
  it.each(["__all__", "", "  "])("rejects non-exact target %j", async (targetColour) => {
    state.rows = [row(1, "__all__", "KEEP")];
    await expect(upsertCustomRowForColour({ ...request, targetColour })).rejects.toThrow("exact target");
    expect(state.writes).toEqual([]);
  });
  it("rolls back insert failure without deleting saved shared information", async () => {
    state.rows = [row(1, "__all__", "KEEP")]; const before = structuredClone(state.rows); state.failInsert = true;
    await expect(upsertCustomRowForColour(request)).rejects.toThrow("insert failed");
    expect(state.rows).toEqual(before);
  });
  it("rolls back exact-target update failure", async () => {
    state.rows = [row(1, "__all__", "SHARED"), row(2, request.targetColour, "KEEP")];
    const before = structuredClone(state.rows); state.failAfterUpdate = true;
    await expect(upsertCustomRowForColour(request)).rejects.toThrow("update failed");
    expect(state.rows).toEqual(before);
  });
  it("serializes overlapping edits under the transaction lock without duplicate overrides", async () => {
    state.rows = [row(1, "__all__", "SHARED")];
    await Promise.all([upsertCustomRowForColour(request), upsertCustomRowForColour({ ...request, newValue: "LATEST" })]);
    expect(state.rows.filter(item => item.colour === request.targetColour)).toHaveLength(1);
    expect(state.rows[0].value).toBe("SHARED");
    expect(state.rows[1].value).toBe("LATEST");
    expect(state.locks).toBe(2);
  });
});

describe('New component naming before exact colour overrides', () => {
  it('rejects unnamed per-colour writes without inserting disconnected rows', async () => {
    state.rows = [row(1, '__all__', 'KEEP', { title: '' })];
    const before = structuredClone(state.rows);
    await expect(upsertCustomRowForColour(request)).rejects.toThrow('Name this component');
    expect(state.rows).toEqual(before);
    expect(state.writes).toEqual([]);
  });
  it('uses the saved name even when a fast cell callback still carries an empty name', async () => {
    state.rows = [row(1, '__all__', 'KEEP', { title: '' })];
    await renameSpecCustomRowGroup({ id: 1, style: 'LAUREN', title: 'Piping' });
    await upsertCustomRowForColour({ ...request, title: '', currentSharedValue: '' });
    expect(state.rows).toHaveLength(2);
    expect(state.rows.every(item => item.title === 'Piping')).toBe(true);
    expect(state.rows.find(item => item.colour === '__all__')?.value).toBe('KEEP');
    expect(state.rows.find(item => item.colour === request.targetColour)?.value).toBe('VINO PIPING');
  });
});
