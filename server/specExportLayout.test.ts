import { describe, expect, it, vi } from "vitest";
import { buildSpecSheetWorkbook } from "@/lib/exportSpecSheet";
import { getLatestSpecExportLayout } from "../shared/specExportLayout";
import { hideSpecRow } from "../shared/specRowLayout";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

describe("latest spec export layout", () => {
  it("waits for a pending save and a fresh load before reading the latest local hide", async () => {
    const save = deferred<unknown>();
    const load = deferred<string[] | null>();
    let localLayout = ["t:upper_1", "t:bow", "t:lining"];
    const localRead = vi.fn(() => localLayout);
    const readLocal = vi.fn(() => ({ style: " casa ", read: localRead }));
    const waitForSaves = vi.fn(() => save.promise);
    const loadSaved = vi.fn(() => load.promise);

    const result = getLatestSpecExportLayout({ style: "CASA", readLocal, loadSaved, waitForSaves });
    expect(waitForSaves).toHaveBeenCalledTimes(1);
    expect(loadSaved).not.toHaveBeenCalled();
    expect(readLocal).not.toHaveBeenCalled();

    save.resolve(undefined);
    await Promise.resolve();
    expect(loadSaved).toHaveBeenCalledTimes(1);
    expect(readLocal).not.toHaveBeenCalled();
    expect(localRead).not.toHaveBeenCalled();

    // A hide made while loading must be read now, not captured at export click.
    localLayout = hideSpecRow(localLayout, "t:bow");
    load.resolve(["t:upper_1", "t:bow", "t:lining"]);
    await expect(result).resolves.toEqual(["t:upper_1", "deleted:t:bow", "t:lining"]);
    expect(localRead).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale Chelsea getter when exporting Casa and uses its fresh saved hide", async () => {
    const chelseaRead = vi.fn(() => ["t:upper_1", "t:bow"]);
    const loadSaved = vi.fn(async () => ["t:upper_1", "t:bow", "deleted:t:bow"]);
    await expect(getLatestSpecExportLayout({
      style: " casa ",
      readLocal: () => ({ style: " CHELSEA ", read: chelseaRead }),
      loadSaved,
      waitForSaves: async () => undefined,
    })).resolves.toEqual(["t:upper_1", "deleted:t:bow"]);
    expect(chelseaRead).not.toHaveBeenCalled();
    expect(loadSaved).toHaveBeenCalledTimes(1);
  });

  it("falls back to the saved layout when the matching getter is not ready", async () => {
    const read = vi.fn(() => null);
    await expect(getLatestSpecExportLayout({
      style: "CASA",
      readLocal: () => ({ style: "casa", read }),
      loadSaved: async () => ["t:upper_1", "deleted:t:bow"],
      waitForSaves: async () => undefined,
    })).resolves.toEqual(["t:upper_1", "deleted:t:bow"]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("uses saved layout when no local getter is registered", async () => {
    await expect(getLatestSpecExportLayout({
      style: "CASA",
      readLocal: () => null,
      loadSaved: async () => ["t:upper_1", "deleted:t:bow"],
      waitForSaves: async () => undefined,
    })).resolves.toEqual(["t:upper_1", "deleted:t:bow"]);
  });

  it.each(["local", "saved"] as const)("treats an empty %s layout as valid, not as missing", async (source) => {
    await expect(getLatestSpecExportLayout({
      style: "CASA",
      readLocal: () => ({ style: "CASA", read: () => source === "local" ? [] : null }),
      loadSaved: async () => source === "saved" ? [] : ["deleted:t:bow"],
      waitForSaves: async () => undefined,
    })).resolves.toEqual([]);
  });

  it.each(["local", "saved"] as const)("normalizes the selected %s layout without mutating it", async (source) => {
    const layout = ["t:bow", "deleted:t:bow", "deleted:t:bow", "deleted:t:upper_1", "t:upper_1"];
    const original = [...layout];
    await expect(getLatestSpecExportLayout({
      style: "CASA",
      readLocal: () => ({ style: "CASA", read: () => source === "local" ? layout : null }),
      loadSaved: async () => source === "saved" ? layout : [],
      waitForSaves: async () => undefined,
    })).resolves.toEqual(["deleted:t:bow", "t:upper_1"]);
    expect(layout).toEqual(original);
  });

  it("preserves null when neither local nor saved layout exists", async () => {
    await expect(getLatestSpecExportLayout({
      style: "CASA",
      readLocal: () => ({ style: "CASA", read: () => null }),
      loadSaved: async () => null,
      waitForSaves: async () => undefined,
    })).resolves.toBeNull();
  });

  it("propagates saved-layout load failure without creating a default workbook, even with ready local data", async () => {
    const failure = new Error("Layout request failed");
    const buildWorkbook = vi.fn(buildSpecSheetWorkbook);
    const localRead = vi.fn(() => ["t:upper_1", "deleted:t:bow"]);
    const readLocal = vi.fn(() => ({ style: "CASA", read: localRead }));
    const exportWorkbook = async () => {
      const rowKeys = await getLatestSpecExportLayout({
        style: "CASA",
        readLocal,
        loadSaved: async () => { throw failure; },
        waitForSaves: async () => undefined,
      });
      return buildWorkbook({
        style: "CASA", last: "CASA", category: "Ballet Flat", colours: ["BLACK"],
        specs: { BLACK: { upper_1: "BLACK", bow: "MATCHING" } }, rowKeys,
      });
    };
    await expect(exportWorkbook()).rejects.toBe(failure);
    expect(readLocal).not.toHaveBeenCalled();
    expect(localRead).not.toHaveBeenCalled();
    expect(buildWorkbook).not.toHaveBeenCalled();
  });

  it("propagates a pending save failure instead of loading or reading fallback layout", async () => {
    const failure = new Error("Save failed");
    const loadSaved = vi.fn(async () => ["t:upper_1"]);
    const readLocal = vi.fn(() => null);
    await expect(getLatestSpecExportLayout({
      style: "CASA", readLocal, loadSaved,
      waitForSaves: async () => { throw failure; },
    })).rejects.toBe(failure);
    expect(loadSaved).not.toHaveBeenCalled();
    expect(readLocal).not.toHaveBeenCalled();
  });
});
