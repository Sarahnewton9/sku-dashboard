/** Keep edits made while Add row is in flight attached to the actual saved row. */
export function createSpecCustomRowIdentityTracker() {
  let nextTempId = -Date.now();
  const pending = new Map<number, {
    promise: Promise<number>;
    resolve: (id: number) => void;
    reject: (error: Error) => void;
  }>();
  return {
    create(): number {
      const tempId = nextTempId--;
      let resolve!: (id: number) => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<number>((yes, no) => { resolve = yes; reject = no; });
      // The add can fail even when no edit was queued; avoid an unhandled rejection.
      void promise.catch(() => undefined);
      pending.set(tempId, { promise, resolve, reject });
      return tempId;
    },
    saved(tempId: number, realId: number) {
      if (!Number.isSafeInteger(realId) || realId <= 0) throw new Error('Invalid saved component ID');
      pending.get(tempId)?.resolve(realId);
    },
    failed(tempId: number, error: Error) { pending.get(tempId)?.reject(error); },
    async resolveId(id: number): Promise<number> {
      if (id > 0) return id;
      const row = pending.get(id);
      if (!row) throw new Error('This new component has not been saved. Please add it again.');
      return row.promise;
    },
  };
}
