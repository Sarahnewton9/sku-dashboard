import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
const state = vi.hoisted(() => ({ existing: [] as any[], updates: [] as any[], inserts: [] as any[], id: 20, transactions: 0, failInsert: false }));
vi.mock('drizzle-orm/mysql2', () => ({ drizzle: () => {
  const db = {
    transaction: async (fn: any) => { state.transactions++; return fn(db); },
    select: () => ({ from: () => ({ where: async () => state.existing }) }),
    update: () => ({ set: (value: any) => ({ where: async (condition: any) => { state.updates.push({ value, condition }); } }) }),
    insert: () => ({ values: async (value: any) => { if (state.failInsert) throw new Error('insert failed'); state.inserts.push(value); return [{ insertId: state.id++ }]; } }),
  }; return db;
} }));
import { bulkCopyCustomRows } from './db';
const dialect = new MySqlDialect();
const row = { section: 'components', title: 'Leather Bow', value: '', sortOrder: 2 };
const input = { targetStyle: 'RAZZLE', targetColours: ['BLACK'], allColours: ['BLACK', 'WHITE'], rows: [row] };
beforeEach(() => { vi.stubEnv('DATABASE_URL', 'mysql://mock'); state.existing = []; state.updates = []; state.inserts = []; state.transactions = 0; state.id = 20; state.failInsert = false; });
describe('Saved custom spec replacement persistence', () => {
  it('clears an explicit selected custom value and never updates its other-colour sibling', async () => {
    state.existing = [{ id: 10, colour: 'BLACK', value: 'OLD' }, { id: 11, colour: 'WHITE', value: 'KEEP' }];
    const result = await bulkCopyCustomRows(input);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].value).toEqual({ value: '' });
    expect(dialect.sqlToQuery(state.updates[0].condition).params).toEqual([10]);
    expect(result[0].newId).toBe(10);
    expect(state.transactions).toBe(1);
  });
  it('keeps the shared ID during a selected-SKU split and preserves the unselected value', async () => {
    state.existing = [{ id: 10, colour: '__all__', value: 'KEEP' }];
    const result = await bulkCopyCustomRows(input);
    expect(state.updates[0].value).toEqual({ colour: 'BLACK', value: '' });
    expect(state.inserts).toEqual([expect.objectContaining({ colour: 'WHITE', value: 'KEEP' })]);
    expect(result[0].newId).toBe(10);
  });
  it('preserves a mixed shared and explicit unselected cell during splitting', async () => {
    state.existing = [{ id: 10, colour: '__all__', value: 'OLD SHARED' }, { id: 11, colour: 'WHITE', value: 'LATEST WHITE' }];
    await bulkCopyCustomRows(input);
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([expect.objectContaining({ value: { colour: 'BLACK', value: '' } })]);
  });
  it('clears every cell when all target columns are selected without deleting stable row IDs', async () => {
    state.existing = [{ id: 10, colour: '__all__', value: 'OLD' }, { id: 11, colour: 'WHITE', value: 'SPECIFIC' }];
    await bulkCopyCustomRows({ ...input, targetColours: input.allColours });
    expect(state.updates[0].value).toEqual({ value: '' });
    expect(dialect.sqlToQuery(state.updates[0].condition).params).toEqual(['RAZZLE', 'components', 'Leather Bow']);
    expect(state.inserts).toHaveLength(0);
  });
  it('does not invent empty custom groups but copies real source values only to selected columns', async () => {
    expect(await bulkCopyCustomRows(input)).toEqual([]);
    expect(state.inserts).toHaveLength(0);
    await bulkCopyCustomRows({ ...input, rows: [{ ...row, value: 'LATEST' }] });
    expect(state.inserts).toEqual([expect.objectContaining({ colour: 'BLACK', value: 'LATEST' })]);
  });
  it('rejects failed transactional writes instead of reporting a successful copy', async () => {
    state.failInsert = true;
    await expect(bulkCopyCustomRows({ ...input, rows: [{ ...row, value: 'LATEST' }] })).rejects.toThrow('insert failed');
  });
});
