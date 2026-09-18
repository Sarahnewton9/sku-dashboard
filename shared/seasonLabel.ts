/** Presentation labels for the dashboard's internal season keys. */
export function getSeasonDisplayLabel(season: string): string {
  switch (season) {
    case "W27":
      return "Winter 27";
    case "SS26":
      return "Summer 26";
    default:
      return season;
  }
}

/** Safe season wording for export filenames. */
export function getSeasonFileLabel(season: string): string {
  return getSeasonDisplayLabel(season).replace(/\s+/g, "_");
}
