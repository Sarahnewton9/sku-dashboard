export type SpecImageSampleSession = {
  sampleDate?: string | null;
  sampleType?: string | null;
};

/**
 * The fitting API returns sessions oldest-first. Use the most recent session
 * that actually carries sample information so a style reference image retains
 * useful sample context without showing an empty overlay.
 */
export function getSpecImageSampleOverlay(
  sessions: SpecImageSampleSession[],
): { sampleDate: string | null; sampleType: string | null } | null {
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const session = sessions[index];
    const sampleDate = session?.sampleDate?.trim() || null;
    const sampleType = session?.sampleType?.trim() || null;
    if (sampleDate || sampleType) return { sampleDate, sampleType };
  }
  return null;
}
