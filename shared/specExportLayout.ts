import { normalizeSpecRowLayout } from "./specRowLayout";

export type RegisteredSpecRowLayout = {
  style: string;
  read: () => string[] | null;
};

/** Resolve export layout only after pending saves and a successful fresh load. */
export async function getLatestSpecExportLayout(options: {
  style: string;
  readLocal: () => RegisteredSpecRowLayout | null;
  loadSaved: () => Promise<string[] | null>;
  waitForSaves: () => Promise<unknown>;
}): Promise<string[] | null> {
  await options.waitForSaves();
  // Even a ready local getter must not mask a failed saved-layout request.
  const saved = await options.loadSaved();
  const local = options.readLocal();
  const matchesStyle = local?.style.trim().toUpperCase() === options.style.trim().toUpperCase();
  const layout = matchesStyle ? local!.read() ?? saved : saved;
  return layout === null ? null : normalizeSpecRowLayout(layout);
}
