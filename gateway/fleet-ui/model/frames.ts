export const FLEET_IFRAME_CACHE_QUIET_MS = 30 * 60 * 1_000;

export interface FleetIframeCacheEntry {
  id: string;
  lastVisitedAt: number;
}

export function fleetIframeEvictionCandidate(
  entries: readonly FleetIframeCacheEntry[],
  selectedId: string | null,
): string | null {
  const candidate = entries
    .filter((entry) => entry.id !== selectedId)
    .sort(
      (left, right) =>
        left.lastVisitedAt - right.lastVisitedAt ||
        left.id.localeCompare(right.id),
    )[0];
  return candidate?.id ?? null;
}

export function fleetIframeCacheQuietExpired(
  now: number,
  lastVisitedAt: number,
): boolean {
  return (
    Number.isFinite(now) &&
    Number.isFinite(lastVisitedAt) &&
    now - lastVisitedAt >= FLEET_IFRAME_CACHE_QUIET_MS
  );
}

export function fleetIframeCachePreference(
  serialized: string | null,
  configured: number,
): number {
  const fallback =
    Number.isSafeInteger(configured) && configured >= 1 && configured <= 10
      ? configured
      : 1;
  if (!serialized) return fallback;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object") return fallback;
    const record = value as Record<string, unknown>;
    return record.version === 1 &&
      Number.isSafeInteger(record.size) &&
      Number(record.size) >= 1 &&
      Number(record.size) <= 10
      ? Number(record.size)
      : fallback;
  } catch {
    return fallback;
  }
}

export interface FleetFrameActivityInput {
  selected: boolean;
  frameHidden: boolean;
  documentHidden: boolean;
  desktop: boolean;
  treeOpen: boolean;
  agentMenuHidden: boolean;
}

export function fleetFrameActivityActive(
  input: FleetFrameActivityInput,
): boolean {
  return (
    input.selected &&
    !input.frameHidden &&
    !input.documentHidden &&
    (input.desktop || (!input.treeOpen && input.agentMenuHidden))
  );
}
