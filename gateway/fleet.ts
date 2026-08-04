import type { GatewayConfig, NodeConfig } from "./config.ts";
import type { TransportRegistry, TransportStatus } from "./transports.ts";

export interface SessionSummary {
  name: string;
  isPrimary: boolean;
  reachable: boolean;
  agents: number;
  working: number;
  blocked: number;
}

interface CollieSnapshot {
  bridge: string;
  sessions: SessionSummary[];
  ts: number;
}

export interface FleetNodeState {
  id: string;
  name: string;
  publicHost: string;
  labels: string[];
  health: "online" | "herdr-down" | "bridge-down" | "transport-down";
  transport: TransportStatus;
  bridge: string | null;
  agents: number;
  working: number;
  blocked: number;
  sessions: SessionSummary[];
  observedAt: number;
  lastHealthyAt: number | null;
  message: string | null;
}

export interface FleetState {
  generatedAt: number;
  totals: { nodes: number; online: number; agents: number; working: number; blocked: number };
  nodes: FleetNodeState[];
}

function validSession(value: unknown): value is SessionSummary {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.name === "string" &&
    typeof session.isPrimary === "boolean" &&
    typeof session.reachable === "boolean" &&
    [session.agents, session.working, session.blocked].every((count) => Number.isSafeInteger(count) && (count as number) >= 0)
  );
}

function parseSnapshot(value: unknown): CollieSnapshot {
  if (!value || typeof value !== "object") throw new Error("snapshot is not an object");
  const snapshot = value as Record<string, unknown>;
  if (typeof snapshot.bridge !== "string" || !Array.isArray(snapshot.sessions) || !snapshot.sessions.every(validSession)) {
    throw new Error("snapshot shape is incompatible");
  }
  return {
    bridge: snapshot.bridge,
    sessions: snapshot.sessions,
    ts: Number.isFinite(snapshot.ts) ? (snapshot.ts as number) : Date.now(),
  };
}

function emptyState(node: NodeConfig, transport: TransportStatus, now: number): FleetNodeState {
  return {
    id: node.id,
    name: node.name,
    publicHost: node.publicHost,
    labels: node.labels,
    health: transport.state === "up" ? "bridge-down" : "transport-down",
    transport,
    bridge: null,
    agents: 0,
    working: 0,
    blocked: 0,
    sessions: [],
    observedAt: now,
    lastHealthyAt: null,
    message: transport.message,
  };
}

export class FleetCollector {
  private readonly states = new Map<string, FleetNodeState>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: GatewayConfig,
    private readonly transports: TransportRegistry,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    for (const node of config.nodes.filter((candidate) => candidate.enabled)) {
      this.states.set(node.id, emptyState(node, transports.status(node), now()));
    }
  }

  async start(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.config.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async refresh(): Promise<void> {
    await Promise.all(this.config.nodes.filter((node) => node.enabled).map((node) => this.refreshNode(node)));
  }

  private async refreshNode(node: NodeConfig): Promise<void> {
    const now = this.now();
    const transport = this.transports.status(node);
    const previous = this.states.get(node.id);
    if (transport.state !== "up") {
      this.states.set(node.id, { ...emptyState(node, transport, now), lastHealthyAt: previous?.lastHealthyAt ?? null });
      return;
    }
    try {
      const response = await this.fetcher(`${this.transports.upstream(node)}/api/snapshot`, {
        headers: { Accept: "application/json", Host: node.publicHost },
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) throw new Error(`bridge returned HTTP ${response.status}`);
      const snapshot = parseSnapshot(await response.json());
      const sessions = snapshot.sessions;
      const agents = sessions.reduce((sum, session) => sum + session.agents, 0);
      const working = sessions.reduce((sum, session) => sum + session.working, 0);
      const blocked = sessions.reduce((sum, session) => sum + session.blocked, 0);
      const online = snapshot.bridge === "connected" && sessions.some((session) => session.reachable);
      this.states.set(node.id, {
        id: node.id,
        name: node.name,
        publicHost: node.publicHost,
        labels: node.labels,
        health: online ? "online" : "herdr-down",
        transport,
        bridge: snapshot.bridge,
        agents,
        working,
        blocked,
        sessions,
        observedAt: now,
        lastHealthyAt: online ? now : (previous?.lastHealthyAt ?? null),
        message: online ? null : "Collie is reachable but no Herdr session is connected",
      });
    } catch (error) {
      this.states.set(node.id, {
        ...emptyState(node, transport, now),
        lastHealthyAt: previous?.lastHealthyAt ?? null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  snapshot(): FleetState {
    const nodes = [...this.states.values()].sort((a, b) => a.name.localeCompare(b.name));
    return {
      generatedAt: this.now(),
      totals: {
        nodes: nodes.length,
        online: nodes.filter((node) => node.health === "online").length,
        agents: nodes.reduce((sum, node) => sum + node.agents, 0),
        working: nodes.reduce((sum, node) => sum + node.working, 0),
        blocked: nodes.reduce((sum, node) => sum + node.blocked, 0),
      },
      nodes,
    };
  }
}
