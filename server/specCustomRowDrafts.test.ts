import { describe, expect, it, vi } from 'vitest';
import { createSpecCustomRowIdentityTracker } from '../shared/specCustomRowDrafts';
import { createSpecRowSaveQueue } from '../shared/specRowLayout';

describe('new Specs component draft identity', () => {
  it('waits for the real row ID before saving a name or cell value', async () => {
    const tracker = createSpecCustomRowIdentityTracker();
    const temp = tracker.create();
    const persist = vi.fn();
    const edit = tracker.resolveId(temp).then(persist);
    await Promise.resolve();
    expect(persist).not.toHaveBeenCalled();
    tracker.saved(temp, 123);
    await edit;
    expect(persist).toHaveBeenCalledWith(123);
    await expect(tracker.resolveId(temp)).resolves.toBe(123);
  });
  it('does not mix two rapidly added row placeholders', async () => {
    const tracker = createSpecCustomRowIdentityTracker();
    const one = tracker.create(), two = tracker.create();
    expect(one).not.toBe(two);
    tracker.saved(two, 20); tracker.saved(one, 10);
    await expect(Promise.all([tracker.resolveId(one), tracker.resolveId(two)])).resolves.toEqual([10, 20]);
  });
  it('never silently discards queued typing when row creation fails', async () => {
    const tracker = createSpecCustomRowIdentityTracker();
    const temp = tracker.create();
    const pending = tracker.resolveId(temp);
    tracker.failed(temp, new Error('row was not added'));
    await expect(pending).rejects.toThrow('row was not added');
    await expect(tracker.resolveId(-10)).rejects.toThrow('not been saved');
  });
  it('preserves ordinary saved IDs and rejects invalid creation results', async () => {
    const tracker = createSpecCustomRowIdentityTracker();
    await expect(tracker.resolveId(44)).resolves.toBe(44);
    expect(() => tracker.saved(tracker.create(), -4)).toThrow('Invalid saved component ID');
  });
  it('serializes title and colour saves behind the same pending component ID', async () => {
    const tracker = createSpecCustomRowIdentityTracker(), queue = createSpecRowSaveQueue();
    const temp = tracker.create(), writes: string[] = [];
    const rename = queue('LAUREN', async () => { writes.push(`rename:${await tracker.resolveId(temp)}`); });
    const colour = queue('LAUREN', async () => { writes.push(`colour:${await tracker.resolveId(temp)}`); });
    await Promise.resolve();
    expect(writes).toEqual([]);
    tracker.saved(temp, 99);
    await Promise.all([rename, colour]);
    expect(writes).toEqual(['rename:99', 'colour:99']);
  });
});
