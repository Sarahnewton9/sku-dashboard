export type SpecCompletionStatus = "not_started" | "in_progress" | "complete";

/**
 * A Specs library entry only belongs in the completion queue when it contains
 * current-season new SKU columns and that new work has not been completed.
 * Carry-over/core-only styles always remain in their category library.
 */
export function isNewSpecStyleAwaitingCompletion(input: {
  newSkus: number;
  specStatus?: SpecCompletionStatus | null;
}): boolean {
  return input.newSkus > 0 && input.specStatus !== "complete";
}

/**
 * Extracts template component keys from either the current (t:key) or legacy
 * (template:key) Specs row-key formats. Deleted rows and custom rows are not
 * required for automatic completion.
 */
export function getSpecTemplateComponentKeys(rowKeys: readonly string[]): string[] {
  return Array.from(new Set(
    rowKeys
      .map((key) => {
        if (key.startsWith("t:")) return key.slice(2);
        if (key.startsWith("template:")) return key.slice("template:".length);
        return null;
      })
      .filter((key): key is string => Boolean(key)),
  ));
}
