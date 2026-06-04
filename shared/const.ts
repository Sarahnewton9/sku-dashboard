export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// Canonical list of all known lasts — single source of truth used by LastApprovalTab and StylesTab
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
