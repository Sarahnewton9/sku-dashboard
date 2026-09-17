export function shouldIncludeStyleInSpecs(input: {
  isOnNewLast: boolean;
  hasNewColours: boolean;
}): boolean {
  return input.isOnNewLast || input.hasNewColours;
}

export function selectSpecColourColumns(input: {
  activeColours: readonly string[];
  newColours: readonly string[];
}): string[] {
  return input.newColours.length > 0 ? [...input.newColours] : [...input.activeColours];
}
