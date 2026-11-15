export const LAST_APPROVAL_SIZE_FIELDS = [
  "size5Approved",
  "size55Approved",
  "size6Approved",
  "size65Approved",
  "size7Approved",
  "size9Approved",
  "size95Approved",
] as const;

export type LastApprovalSizeField = (typeof LAST_APPROVAL_SIZE_FIELDS)[number];
export type LastApprovalSizeFlags = Partial<Record<LastApprovalSizeField, boolean>>;

const W27_SIZE_CHECKS = [
  { label: "7", field: "size7Approved", firstFitting: true },
  { label: "5", field: "size5Approved", firstFitting: false },
  { label: "6.5", field: "size65Approved", firstFitting: false },
  { label: "9", field: "size9Approved", firstFitting: false },
] as const;

// All approvals stay tied to their real stored sizes. Retain discontinued 5.5,
// 6 and 9.5 fields as history; they must not silently approve a different size.
const LEGACY_SIZE_CHECKS = [
  { label: "6.5", field: "size65Approved", firstFitting: false },
  { label: "7", field: "size7Approved", firstFitting: false },
  { label: "9.5", field: "size95Approved", firstFitting: false },
] as const;

export function getLastApprovalSizeChecks(season: string, flags: LastApprovalSizeFlags = {}) {
  const checks = season.trim().toUpperCase() === "W27" ? W27_SIZE_CHECKS : LEGACY_SIZE_CHECKS;
  return checks.map((check) => ({ ...check, checked: flags[check.field] === true }));
}

export function getLastApprovalSizeProgress(season: string, flags: LastApprovalSizeFlags = {}) {
  const checks = getLastApprovalSizeChecks(season, flags);
  const approved = checks.filter((check) => check.checked).length;
  const total = checks.length;
  return { approved, total, percent: Math.round((approved / total) * 100), complete: approved === total };
}

export const DEFAULT_FITTING_SIZE = "7";

/** Use the actual approval sizes, with 7 as the default for every new session. */
export function getFittingSizeOptions(season: string, currentValue?: string | null): string[] {
  const configured: string[] = getLastApprovalSizeChecks(season).map((check) => check.label);
  const options = [DEFAULT_FITTING_SIZE, ...configured.filter((size) => size !== DEFAULT_FITTING_SIZE)];
  // A historical free-text size such as 37 stays selectable while editing that
  // session, rather than being changed just because another field is saved.
  if (currentValue?.trim() && !options.includes(currentValue)) options.push(currentValue);
  return options;
}

export function getNewFittingSize(value?: string | null): string {
  return value?.trim() ? value : DEFAULT_FITTING_SIZE;
}
