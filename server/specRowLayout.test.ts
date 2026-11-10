import { describe, expect, it, vi } from 'vitest';
import { createSpecRowSaveQueue, getOrderedSpecRowKeys, groupSpecCustomRows, getCustomSpecRowAliases, hideSpecRow, mergeSpecRowOrder, normalizeSpecRowLayout, replaceSpecRowKey, restoreSpecRow } from '../shared/specRowLayout';

describe('Specs row layout and deletion', () => {
  const available = ['t:upper_1', 't:lining', 't:bow', 'c:10'];
  it('deletes a populated template not present in a previously saved order', () => {
    const saved = hideSpecRow(['t:upper_1', 't:lining'], 't:bow');
    expect(saved).toContain('deleted:t:bow');
    expect(getOrderedSpecRowKeys(available, saved)).not.toContain('t:bow');
  });
  it('does not restore a deleted row after dragging, Save order or reload', () => {
    const saved = hideSpecRow(available, 't:lining');
    const dragged = mergeSpecRowOrder(['t:upper_1', 'c:10', 't:bow'], saved);
    expect(dragged).toContain('deleted:t:lining');
    expect(getOrderedSpecRowKeys(available, JSON.parse(JSON.stringify(dragged)))).toEqual(['t:upper_1', 'c:10', 't:bow']);
    expect(getOrderedSpecRowKeys(available, restoreSpecRow(dragged, 't:lining'))).toContain('t:lining');
  });
  it('keeps deletion markers when an added row gets a real ID or a shared row is split', () => {
    expect(replaceSpecRowKey(['t:upper_1', 'deleted:c:-10'], 'c:-10', 'c:11')).toEqual(['t:upper_1', 'deleted:c:11']);
    expect(getOrderedSpecRowKeys(['t:upper_1', 'c:11'], ['deleted:c:10'].map(k => k.replace('c:10', 'c:11')))).toEqual(['t:upper_1']);
  });
  it('uses the lowest ID regardless of sortOrder and honours any group member deletion', () => {
    const groups = groupSpecCustomRows([
      { id: 10, colour: '__all__', title: 'Leather Bow', section: 'components', sortOrder: 5 },
      { id: 12, colour: 'BLACK', title: 'LEATHER BOW', section: 'components', sortOrder: 0 },
      { id: 14, colour: 'BLACK', title: 'Leather Bow', section: 'packaging', sortOrder: 0 },
    ]);
    expect(groups).toHaveLength(2);
    const aliases = getCustomSpecRowAliases(groups);
    expect(aliases.get('c:12')).toBe('c:10');
    expect(getOrderedSpecRowKeys(['t:upper_1', 'c:10', 'c:14'], ['c:10', 'deleted:c:12'], aliases)).toEqual(['t:upper_1', 'c:14']);
  });
  it('handles duplicate active/deleted keys deterministically and protects Upper 1', () => {
    expect(normalizeSpecRowLayout(['t:lining', 'deleted:t:lining', 'deleted:t:lining', 'deleted:t:upper_1'])).toEqual(['deleted:t:lining', 't:upper_1']);
    expect(hideSpecRow(available, 't:upper_1')).toEqual(available);
  });
  it('honours legacy template/custom hide markers in both the editor and export', () => {
    const aliases = new Map([['c:12', 'c:10']]);
    const saved = ['template:upper_1', 't:bow', 'deleted:template:bow', 'custom:10', 'deleted:custom:12'];
    expect(normalizeSpecRowLayout(saved, aliases)).toEqual(['t:upper_1', 'deleted:t:bow', 'deleted:c:10']);
    expect(getOrderedSpecRowKeys(available, saved, aliases)).toEqual(['t:upper_1', 't:lining']);
    expect(normalizeSpecRowLayout(['deleted:template:upper_1'])).toEqual(['t:upper_1']);
  });
  it('leaves unnamed custom rows independently editable', () => {
    expect(groupSpecCustomRows([10, 11].map(id => ({ id, section: 'components', colour: '__all__', title: '', sortOrder: 0 })))).toHaveLength(2);
  });
});

describe('Specs layout save queue', () => {
  it('serializes mutations for one style but allows other styles to save independently', async () => {
    const queue = createSpecRowSaveQueue();
    let release!: () => void;
    const blocked = new Promise<void>(r => { release = r; });
    const writes: string[] = [];
    const first = queue('ESSA', async () => { writes.push('drag'); await blocked; writes.push('drag saved'); });
    const second = queue('essa', async () => { writes.push('delete saved'); });
    await queue('ROXIE', async () => { writes.push('other style saved'); });
    expect(writes).toEqual(['drag', 'other style saved']);
    release(); await Promise.all([first, second]);
    expect(writes).toEqual(['drag', 'other style saved', 'drag saved', 'delete saved']);
  });
  it('continues after failure without replaying the failed mutation', async () => {
    const queue = createSpecRowSaveQueue();
    const failed = vi.fn(async () => { throw new Error('offline'); });
    const first = queue('ESSA', failed);
    const second = queue('ESSA', async () => 'latest layout saved');
    await expect(first).rejects.toThrow('offline');
    await expect(second).resolves.toBe('latest layout saved');
    expect(failed).toHaveBeenCalledTimes(1);
  });
});
