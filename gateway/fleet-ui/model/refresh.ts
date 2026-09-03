export function fleetRefreshWaitMs(
  nextAt: number,
  generatedAt: number,
  fallbackMs = 5_000,
): number {
  if (
    !Number.isSafeInteger(nextAt) ||
    !Number.isSafeInteger(generatedAt) ||
    nextAt < 0 ||
    generatedAt < 0
  ) {
    return fallbackMs;
  }
  return Math.max(250, nextAt - generatedAt);
}
