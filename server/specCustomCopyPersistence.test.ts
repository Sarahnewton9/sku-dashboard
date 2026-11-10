import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
const state = vi.hoisted(() => ({ existing: [] as any[], updates: [] as any[], inserts: [] as any[], id: 20, transactions: 0, locks: 0, failInsert: false, failAtInsert: 0 }));
vi.mock('drizzle-orm/mysql2', () => ({ drizzle: () => {
  const db = {
    transaction: async (fn: any) => {
      state.transactions++;
      const before = { inserts: [...state.inserts], updates: [...state.updates], id: state.id };
      try { return await fn(db); } catch (error) { Object.assign(state, before); throw error; }
    },
    select: () => ({ from: () => ({ where: () => ({ for: async (lock: string) => {
      expect(lock).toBe('update'); state.locks++;
      return state.existing.map(item => ({ style: 'RAZZLE', section: 'components', title: 'Leather Bow', sortOrder: 2, updatedAt: new Date('2026-11-10T01:00:00Z'), ...item }));
    } }) }) }),
    update: () => ({ set: (value: any) => ({ where: async (condition: any) => { state.updates.push({ value, condition }); } }) }),
    insert: () => ({ values: async (value: any) => {
      if (state.failInsert || (state.failAtInsert && state.inserts.length + 1 === state.failAtInsert)) throw new Error('insert failed');
      state.inserts.push(value); return [{ insertId: state.id++ }];
    } }),
    delete: () => { throw new Error('Copy must never delete a custom row'); },
  }; return db;
} }));
import { bulkCopyCustomRows } from './db';
const dialect = new MySqlDialect();
const row = { section: 'components', title: 'Leather Bow', value: '', sortOrder: 2 };
const input = { targetStyle: 'RAZZLE', targetColours: ['BLACK'], allColours: ['BLACK', 'WHITE'], rows: [row] };
beforeEach(() => { vi.stubEnv('DATABASE_URL', 'mysql://mock-only'); state.existing = []; state.updates = []; state.inserts = []; state.transactions = 0; state.locks = 0; state.id = 20; state.failInsert = false; state.failAtInsert = 0; });
describe('Saved custom spec replacement persistence', () => {
  it('clears an explicit selected custom value and never updates its other-colour sibling', async () => {
    state.existing = [{ id: 10, colour: 'BLACK', value: 'OLD' }, { id: 11, colour: 'WHITE', value: 'KEEP' }];
    const result = await bulkCopyCustomRows(input);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].value).toEqual({ value: '' });
    expect(dialect.sqlToQuery(state.updates[0].condition).params).toEqual(['RAZZLE', 10]);
    expect(result[0].newId).toBe(10);
    expect(state.transactions).toBe(1);
    expect(state.locks).toBe(1);
  });
  it('retains the shared ID and value and writes only a selected-SKU blank override', async () => {
    state.existing = [{ id: 10, colour: '__all__', value: 'KEEP' }];
    const result = await bulkCopyCustomRows(input);
    expect(state.updates).toEqual([]);
    expect(state.inserts).toEqual([expect.objectContaining({ colour: 'BLACK', value: '' })]);
    expect(state.existing).toEqual([{ id: 10, colour: '__all__', value: 'KEEP' }]);
    expect(result[0].newId).toBe(10);
  });
  it('preserves mixed shared and explicit unselected cells while creating a selected override', async () => {
    state.existing = [{ id: 10, colour: '__all__', value: 'OLD SHARED' }, { id: 11, colour: 'WHITE', value: 'LATEST WHITE' }];
    await bulkCopyCustomRows(input);
    expect(state.inserts).toEqual([expect.objectContaining({ colour: 'BLACK', value: '' })]);
    expect(state.updates).toEqual([]);
    expect(state.existing.map(item => item.value)).toEqual(['OLD SHARED', 'LATEST WHITE']);
  });
  it('clears every selected cell without deleting stable IDs or changing shared/historical values', async () => {
    state.existing = [{ id: 10, colour: '__all__', value: 'OLD' }, { id: 11, colour: 'WHITE', value: 'SPECIFIC' }, { id: 12, colour: 'OLD SEASON', value: 'HISTORICAL' }];
    const result = await bulkCopyCustomRows({ ...input, targetColours: input.allColours });
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].value).toEqual({ value: '' });
    expect(dialect.sqlToQuery(state.updates[0].condition).params).toEqual(['RAZZLE', 11]);
    expect(state.inserts).toEqual([expect.objectContaining({ colour: 'BLACK', value: '' })]);
    expect(result[0].newId).toBe(10);
    expect(state.existing[0].value).toBe('OLD');
    expect(state.existing[2].value).toBe('HISTORICAL');
  });
  it('does not invent empty custom groups but copies real source values only to selected columns', async () => {
    expect(await bulkCopyCustomRows(input)).toEqual([]);
    expect(state.inserts).toHaveLength(0);
    await bulkCopyCustomRows({ ...input, rows: [{ ...row, value: 'LATEST' }] });
    expect(state.inserts).toEqual([expect.objectContaining({ colour: 'BLACK', value: 'LATEST' })]);
  });
  it('creates exact per-target rows even when all current columns are selected', async () => {
    const result = await bulkCopyCustomRows({ ...input, targetColours: input.allColours, rows: [{ ...row, value: 'LATEST' }] });
    expect(state.inserts.map(item => item.colour)).toEqual(['BLACK', 'WHITE']);
    expect(state.inserts.every(item => item.value === 'LATEST')).toBe(true);
    expect(result[0].newId).toBe(20);
    expect(state.inserts.some(item => item.colour === '__all__')).toBe(false);
  });
  it('preserves a legacy short key instead of clearing another unselected leather sibling', async () => {
    state.existing = [{ id: 10, colour: 'BLACK', value: 'LEGACY' }, { id: 11, colour: '__all__', value: 'SHARED' }];
    await bulkCopyCustomRows({ ...input, targetColours: [' black  nappa '], allColours: ['BLACK NAPPA'] });
    expect(state.updates).toEqual([]);
    expect(state.inserts).toEqual([expect.objectContaining({ colour: 'BLACK NAPPA', value: '' })]);
  });
  it('updates the newest duplicate exact target only and preserves the stable lowest ID mapping', async () => {
    state.existing = [{ id: 10, colour: 'BLACK', value: 'NEWEST', updatedAt: new Date('2026-11-11T02:00:00Z') }, { id: 11, colour: 'BLACK', value: 'OLDER' }];
    const result = await bulkCopyCustomRows(input);
    expect(state.updates).toHaveLength(1);
    expect(dialect.sqlToQuery(state.updates[0].condition).params).toEqual(['RAZZLE', 10]);
    expect(result[0].newId).toBe(10);
  });
  it('normalizes section/title group identity without creating a duplicate group', async () => {
    state.existing = [{ id: 10, colour: '__all__', value: 'KEEP', section: ' COMPONENTS ', title: ' leather   bow ' }];
    const result = await bulkCopyCustomRows(input);
    expect(state.inserts[0]).toMatchObject({ title: ' leather   bow ', section: ' COMPONENTS ', colour: 'BLACK', value: '' });
    expect(result[0].newId).toBe(10);
  });
  it('rejects failed transactional writes instead of reporting a successful copy', async () => {
    state.failInsert = true;
    await expect(bulkCopyCustomRows({ ...input, rows: [{ ...row, value: 'LATEST' }] })).rejects.toThrow('insert failed');
    expect(state.inserts).toEqual([]);
  });
  it('rolls back earlier selected writes if a later override insert fails', async () => {
    state.existing = [{ id: 10, colour: 'BLACK', value: 'OLD' }, { id: 11, colour: '__all__', value: 'KEEP' }];
    state.failAtInsert = 2;
    await expect(bulkCopyCustomRows({ ...input, targetColours: ['BLACK', 'WHITE', 'PINK'] })).rejects.toThrow('insert failed');
    expect(state.updates).toEqual([]);
    expect(state.inserts).toEqual([]);
    expect(state.existing.map(item => item.value)).toEqual(['OLD', 'KEEP']);
  });
  it('deduplicates normalized targets and performs no writes for an empty selection', async () => {
    await bulkCopyCustomRows({ ...input, targetColours: [], rows: [{ ...row, value: 'LATEST' }] });
    expect(state.inserts).toEqual([]);
    await bulkCopyCustomRows({ ...input, targetColours: ['BLACK', ' black '], rows: [{ ...row, value: 'LATEST' }] });
    expect(state.inserts).toHaveLength(1);
  });
});
