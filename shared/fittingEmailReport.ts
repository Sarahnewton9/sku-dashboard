export type FittingEmailImage = {
  imageUrl: string;
};

export type FittingEmailSession = {
  id: number;
  sessionDate: string;
  fitModel?: string | null;
  notes?: string | null;
  sampleDate?: string | null;
  sampleType?: string | null;
  sampleSize?: string | null;
  images: FittingEmailImage[];
};

function compareNewestFirst(left: FittingEmailSession, right: FittingEmailSession): number {
  const byDate = String(right.sessionDate ?? "").localeCompare(String(left.sessionDate ?? ""));
  return byDate || right.id - left.id;
}

/**
 * Per-style factory updates normally show the latest fitting day. All models
 * assessed that day remain together; earlier sessions stay available behind an
 * explicit choice so old notes do not drown out the current instruction.
 */
export function selectFittingEmailSessions(
  sessions: readonly FittingEmailSession[],
  includeFullHistory: boolean,
): FittingEmailSession[] {
  const ordered = [...sessions].sort(compareNewestFirst);
  if (includeFullHistory || ordered.length <= 1) return ordered;
  const latestDate = ordered[0].sessionDate;
  return ordered.filter((session) => session.sessionDate === latestDate);
}

export function countFittingEmailImages(sessions: readonly FittingEmailSession[]): number {
  return sessions.reduce((count, session) => count + (session.images?.length ?? 0), 0);
}
