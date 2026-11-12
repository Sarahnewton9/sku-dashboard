export const LAST_APPROVAL_SIZE_FIELDS = [
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
  { label: "5.5", field: "size55Approved", firstFitting: false },
  { label: "6", field: "size6Approved", firstFitting: false },
  { label: "9", field: "size9Approved", firstFitting: false },
] as const;

// Keep older-season checks tied to their real stored sizes, not renamed as a
// newly requested size. In particular, a 6.5 approval must never approve 5.5/6.
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
