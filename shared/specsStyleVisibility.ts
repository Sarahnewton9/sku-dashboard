export function shouldIncludeStyleInSpecs(input: {
  isOnNewLast: boolean;
  hasNewColours: boolean;
}): boolean {
  return input.isOnNewLast || input.hasNewColours;
}
