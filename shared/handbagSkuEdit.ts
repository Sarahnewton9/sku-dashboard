export type HandbagSkuEditOutcome = "updated" | "duplicate_cancelled";

/**
 * A handbag SKU rename cannot create a second style + colour row. When the
 * requested target already exists, retain that target and cancel the source.
 */
export function getHandbagSkuEditOutcome(targetAlreadyExists: boolean): HandbagSkuEditOutcome {
  return targetAlreadyExists ? "duplicate_cancelled" : "updated";
}
