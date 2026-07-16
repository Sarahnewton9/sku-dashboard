export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Canonical list of all known lasts — single source of truth used by LastApprovalTab and StylesTab
// SS26 new lasts (the lasts that were new in SS26)
export const ALL_LASTS = [
  "BILLIE",
  "DAZIE",
  "EMBER",
  "ENVY",
  "FINCH",
  "HARLEY",
  "JAYDE",
  "LUCY",
  "MATISSE",
  "MISTY",
  "PIXIE",
  "ROXIE",
  "SALLY",
  "SIA",
  "TIANA",
  "TILDA",
  "VIVA",
  "OASIS",
] as const;

// Season-specific new lasts: W27 starts with no new lasts (to be added as the season develops)
export const SEASON_LASTS: Record<string, readonly string[]> = {
  SS26: ALL_LASTS,
  W27: [] as const,
};

// Helper: get the new lasts for a given season
export function getNewLastsForSeason(season: string): readonly string[] {
  return SEASON_LASTS[season] ?? [];
}
