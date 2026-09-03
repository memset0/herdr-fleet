interface FleetAgentTriageInput {
  reachable: boolean;
  status: string;
  lastActiveAt?: number;
  lastSeenAt?: number;
}

export function fleetAgentBucket(
  agent: FleetAgentTriageInput,
): "needs" | "ready" | "working" | "recent" {
  if (agent.status === "blocked") return "needs";
  if (
    agent.status === "done" &&
    (agent.lastActiveAt ?? 0) > (agent.lastSeenAt ?? 0)
  )
    return "ready";
  if (agent.status === "working") return "working";
  return "recent";
}

export function fleetHeaderAgentCount(
  agents: readonly FleetAgentTriageInput[],
): number {
  return agents.filter((agent) => fleetAgentBucket(agent) !== "recent").length;
}

export function fleetAttentionResetEligible(
  agent: FleetAgentTriageInput,
): boolean {
  if (!agent.reachable) return false;
  const bucket = fleetAgentBucket(agent);
  return bucket === "ready" || bucket === "needs";
}

export const FLEET_AGENT_FAVORITES_MAX = 256;

export interface FleetAgentFavoriteIdentity {
  nodeId: string;
  herdrSession: string;
  paneId: string;
  agent: string;
}

function validFavoritePart(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export function fleetAgentFavoriteKey(
  identity: FleetAgentFavoriteIdentity,
): string | null {
  const parts = [
    identity.nodeId,
    identity.herdrSession,
    identity.paneId,
    identity.agent,
  ];
  return parts.every(validFavoritePart) ? JSON.stringify(parts) : null;
}

function validFavoriteKey(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 600) return false;
  try {
    const parts: unknown = JSON.parse(value);
    return (
      Array.isArray(parts) &&
      parts.length === 4 &&
      parts.every(validFavoritePart)
    );
  } catch {
    return false;
  }
}

export function fleetAgentFavoritePreference(
  serialized: string | null,
): Set<string> {
  if (!serialized) return new Set();
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object") return new Set();
    const record = value as Record<string, unknown>;
    if (
      record.version !== 1 ||
      !Array.isArray(record.keys) ||
      record.keys.length > FLEET_AGENT_FAVORITES_MAX
    ) {
      return new Set();
    }
    const keys = record.keys;
    if (!keys.every(validFavoriteKey) || new Set(keys).size !== keys.length)
      return new Set();
    return new Set(keys);
  } catch {
    return new Set();
  }
}

export function fleetAgentFavoriteCompare(
  leftKey: string,
  rightKey: string,
  favorites: ReadonlySet<string>,
): number {
  return Number(favorites.has(rightKey)) - Number(favorites.has(leftKey));
}
