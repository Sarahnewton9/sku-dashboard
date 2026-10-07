export type FittingSessionMirrorSource = {
  id: number;
  sessionDate: string;
  sampleDate?: string | null;
  sampleType?: string | null;
  sampleSize?: string | null;
};

export type NewFittingSessionDefaults = {
  sessionDate: string;
  sampleDate: string | null;
  sampleType: string | null;
  sampleSize: string | null;
  copiedFromSessionId: number | null;
};

/** Returns the Australia/Sydney business date in the dashboard's YYYY-MM-DD format. */
export function getSydneyBusinessDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

/**
 * Copies only the shared sample details from the newest session for the same
 * style on the same fitting day. The fit model, notes and images intentionally
 * remain unique to the new fitting.
 */
export function getSameDayFittingDefaults(
  sessions: FittingSessionMirrorSource[],
  sessionDate: string,
): NewFittingSessionDefaults {
  const source = sessions
    .filter((session) => session.sessionDate === sessionDate)
    .sort((a, b) => b.id - a.id)[0];

  if (!source) {
    return {
      sessionDate,
      sampleDate: null,
      sampleType: null,
      sampleSize: null,
      copiedFromSessionId: null,
    };
  }

  return {
    sessionDate,
    sampleDate: source.sampleDate ?? null,
    sampleType: source.sampleType ?? null,
    sampleSize: source.sampleType === "Fitting Sample" ? source.sampleSize ?? null : null,
    copiedFromSessionId: source.id,
  };
}
