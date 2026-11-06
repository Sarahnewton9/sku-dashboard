type ReceiptSave = {
  setPending: (pending: boolean) => void;
  prepare: () => Promise<() => void>;
  save: () => Promise<unknown>;
  reconcile: () => Promise<unknown>;
  onError: (error: unknown) => void;
};

/** Roll back only this receipt, then read the server's actual state. A response
 * can be lost after a successful write, so never retry the mutation automatically. */
export async function saveSampleReceipt(options: ReceiptSave): Promise<boolean> {
  let rollback: (() => void) | undefined;
  options.setPending(true);
  try {
    rollback = await options.prepare();
    await options.save();
    return true;
  } catch (error) {
    rollback?.();
    options.onError(error);
    return false;
  } finally {
    // Refetching can also fail or stall when the API is unavailable. It must
    // not leave the Rcvd control spinning or create an unhandled rejection.
    options.setPending(false);
    void Promise.resolve().then(() => options.reconcile()).catch(() => {});
  }
}
