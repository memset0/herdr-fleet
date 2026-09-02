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

export type FleetAgentStatus = "idle" | "working" | "blocked" | "done" | "unknown";

interface AgentProjection {
  paneId: string;
  workspaceId: string;
  workspaceLabel: string;
  workspaceNumber: number;
  tabId: string;
  agent: string;
  status: FleetAgentStatus;
  cwd: string;
  focused: boolean;
  paneLabel?: string;
  sessionName?: string;
  tabLabel?: string;
  lastActiveAt?: number;
  lastSeenAt?: number;
}

interface WorkspaceProjection {
  workspaceId: string;
  number: number;
  label: string;
  focused: boolean;
  activeTabId: string;
  tabCount: number;
  paneCount: number;
}

interface TabProjection {
  tabId: string;
  workspaceId: string;
  number: number;
  label: string;
  focused: boolean;
  paneCount: number;
}

export interface FleetAgentCard extends AgentProjection {
  herdrSession: string;
  primarySession: boolean;
  reachable: boolean;
  observedAt: number;
}

interface CollieSnapshot {
  bridge: string;
  sessions: SessionSummary[];
  agents: AgentProjection[];
  shellPanes: AgentProjection[];
  workspaces: WorkspaceProjection[];
  tabs: TabProjection[];
  ts: number;
}

export interface FleetTreePane {
  paneId: string;
  label: string | null;
  agent: string;
  kind: "agent" | "shell";
  status: FleetAgentStatus;
  focused: boolean;
}

export interface FleetTreeTab {
  tabId: string;
  number: number;
  label: string;
  focused: boolean;
  panes: FleetTreePane[];
}

export interface FleetTreeSpace {
  workspaceId: string;
  number: number;
  label: string;
  focused: boolean;
  tabs: FleetTreeTab[];
}

export interface FleetSessionTree {
  herdrSession: string;
  primarySession: boolean;
  reachable: boolean;
  observedAt: number;
  spaces: FleetTreeSpace[];
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
  agentEntries: FleetAgentCard[];
  treeSessions: FleetSessionTree[];
  observedAt: number;
  lastHealthyAt: number | null;
  message: string | null;
}

export interface FleetState {
  generatedAt: number;
  revision: number;
  refresh: {
    baseMs: number;
    maxMs: number;
    minNodeRevisitMs: number;
    delayMs: number;
    nextAt: number;
  };
  totals: { nodes: number; online: number; agents: number; working: number; blocked: number };
  nodes: FleetNodeState[];
}

export interface FleetCollectorRuntime {
  schedule?: (callback: () => void | Promise<void>, delayMs: number) => unknown;
  cancel?: (handle: unknown) => void;
  onCycle?: (state: FleetState) => number | null | void;
  warn?: (message: string) => void;
}

const MIN_NODE_REVISIT_MS = 5_000;
const MAX_REFRESH_MS = 3_600_000;
const AGENT_STATUSES = new Set<FleetAgentStatus>(["idle", "working", "blocked", "done", "unknown"]);
const ROUTE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function validSession(value: unknown): value is SessionSummary {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.name === "string" &&
    session.name.length > 0 &&
    session.name.length <= 128 &&
    !CONTROL_CHARACTER.test(session.name) &&
    typeof session.isPrimary === "boolean" &&
    typeof session.reachable === "boolean" &&
    [session.agents, session.working, session.blocked].every((count) => Number.isSafeInteger(count) && (count as number) >= 0)
  );
}

function requiredString(value: unknown, label: string, max = 4_096): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function displayString(value: unknown, label: string, max = 4_096): string {
  if (typeof value !== "string" || value.length > max) throw new Error(`${label} is invalid`);
  return value;
}

function optionalString(value: unknown, label: string, max = 4_096): string | undefined {
  if (value === undefined) return undefined;
  return displayString(value, label, max);
}

function optionalTimestamp(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${label} is invalid`);
  return value as number;
}

function routeId(value: unknown, label: string): string {
  const id = requiredString(value, label, 128);
  if (!ROUTE_ID.test(id)) throw new Error(`${label} is invalid`);
  return id;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${label} is invalid`);
  return value as number;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} is invalid`);
  return value;
}

function parseAgent(value: unknown, index: number): AgentProjection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`agents[${index}] is not an object`);
  }
  const agent = value as Record<string, unknown>;
  const status = requiredString(agent.status, `agents[${index}].status`, 16) as FleetAgentStatus;
  if (!AGENT_STATUSES.has(status)) throw new Error(`agents[${index}].status is invalid`);
  if (!Number.isSafeInteger(agent.workspaceNumber) || (agent.workspaceNumber as number) < 0) {
    throw new Error(`agents[${index}].workspaceNumber is invalid`);
  }
  if (typeof agent.focused !== "boolean") throw new Error(`agents[${index}].focused is invalid`);

  const paneLabel = optionalString(agent.paneLabel, `agents[${index}].paneLabel`, 1_024);
  const sessionName = optionalString(agent.sessionName, `agents[${index}].sessionName`, 1_024);
  const tabLabel = optionalString(agent.tabLabel, `agents[${index}].tabLabel`, 1_024);
  const lastActiveAt = optionalTimestamp(agent.lastActiveAt, `agents[${index}].lastActiveAt`);
  const lastSeenAt = optionalTimestamp(agent.lastSeenAt, `agents[${index}].lastSeenAt`);

  const paneId = routeId(agent.paneId, `agents[${index}].paneId`);

  return {
    paneId,
    workspaceId: routeId(agent.workspaceId, `agents[${index}].workspaceId`),
    workspaceLabel: displayString(agent.workspaceLabel, `agents[${index}].workspaceLabel`, 1_024),
    workspaceNumber: agent.workspaceNumber as number,
    tabId: routeId(agent.tabId, `agents[${index}].tabId`),
    agent: requiredString(agent.agent, `agents[${index}].agent`, 128),
    status,
    cwd: displayString(agent.cwd, `agents[${index}].cwd`),
    focused: agent.focused,
    ...(paneLabel !== undefined ? { paneLabel } : {}),
    ...(sessionName !== undefined ? { sessionName } : {}),
    ...(tabLabel !== undefined ? { tabLabel } : {}),
    ...(lastActiveAt !== undefined ? { lastActiveAt } : {}),
    ...(lastSeenAt !== undefined ? { lastSeenAt } : {}),
  };
}

function parseWorkspace(value: unknown, index: number): WorkspaceProjection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`workspaces[${index}] is not an object`);
  }
  const workspace = value as Record<string, unknown>;
  return {
    workspaceId: routeId(workspace.workspaceId, `workspaces[${index}].workspaceId`),
    number: nonNegativeInteger(workspace.number, `workspaces[${index}].number`),
    label: displayString(workspace.label, `workspaces[${index}].label`, 1_024),
    focused: boolean(workspace.focused, `workspaces[${index}].focused`),
    activeTabId: routeId(workspace.activeTabId, `workspaces[${index}].activeTabId`),
    tabCount: nonNegativeInteger(workspace.tabCount, `workspaces[${index}].tabCount`),
    paneCount: nonNegativeInteger(workspace.paneCount, `workspaces[${index}].paneCount`),
  };
}

function parseTab(value: unknown, index: number): TabProjection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`tabs[${index}] is not an object`);
  }
  const tab = value as Record<string, unknown>;
  return {
    tabId: routeId(tab.tabId, `tabs[${index}].tabId`),
    workspaceId: routeId(tab.workspaceId, `tabs[${index}].workspaceId`),
    number: nonNegativeInteger(tab.number, `tabs[${index}].number`),
    label: displayString(tab.label, `tabs[${index}].label`, 1_024),
    focused: boolean(tab.focused, `tabs[${index}].focused`),
    paneCount: nonNegativeInteger(tab.paneCount, `tabs[${index}].paneCount`),
  };
}

function parseSnapshot(value: unknown): CollieSnapshot {
  if (!value || typeof value !== "object") throw new Error("snapshot is not an object");
  const snapshot = value as Record<string, unknown>;
  if (
    typeof snapshot.bridge !== "string" ||
    !Array.isArray(snapshot.sessions) ||
    !snapshot.sessions.every(validSession) ||
    !Array.isArray(snapshot.agents) ||
    !Array.isArray(snapshot.shellPanes) ||
    !Array.isArray(snapshot.workspaces) ||
    !Array.isArray(snapshot.tabs)
  ) {
    throw new Error("snapshot shape is incompatible");
  }
  if (
    snapshot.sessions.length > 256 ||
    snapshot.agents.length + snapshot.shellPanes.length > 4_096 ||
    snapshot.workspaces.length > 1_024 ||
    snapshot.tabs.length > 4_096
  ) {
    throw new Error("snapshot shape exceeds Fleet limits");
  }
  const sessionNames = new Set((snapshot.sessions as SessionSummary[]).map((session) => session.name));
  const primarySessions = (snapshot.sessions as SessionSummary[]).filter((session) => session.isPrimary).length;
  if (sessionNames.size !== snapshot.sessions.length || primarySessions !== 1) {
    throw new Error("snapshot session registry is ambiguous");
  }
  const agents = (snapshot.agents as unknown[]).map(parseAgent);
  const shellPanes = (snapshot.shellPanes as unknown[]).map((pane, index) => parseAgent(pane, agents.length + index));
  const workspaces = (snapshot.workspaces as unknown[]).map(parseWorkspace);
  const tabs = (snapshot.tabs as unknown[]).map(parseTab);
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.workspaceId));
  const tabIds = new Set(tabs.map((tab) => tab.tabId));
  if (workspaceIds.size !== workspaces.length || tabIds.size !== tabs.length) {
    throw new Error("snapshot topology contains duplicate ids");
  }
  if (tabs.some((tab) => !workspaceIds.has(tab.workspaceId))) {
    throw new Error("snapshot tab references an unknown workspace");
  }
  const panes = [...agents, ...shellPanes];
  if (new Set(panes.map((pane) => pane.paneId)).size !== panes.length) {
    throw new Error("snapshot topology contains duplicate pane ids");
  }
  if (panes.some((pane) => !workspaceIds.has(pane.workspaceId) || !tabIds.has(pane.tabId))) {
    throw new Error("snapshot pane references unknown topology");
  }
  return {
    bridge: snapshot.bridge,
    sessions: snapshot.sessions,
    agents,
    shellPanes,
    workspaces,
    tabs,
    ts: Number.isFinite(snapshot.ts) ? (snapshot.ts as number) : Date.now(),
  };
}

function offlineAgents(entries: readonly FleetAgentCard[]): FleetAgentCard[] {
  return entries.map((entry) => ({ ...entry, reachable: false }));
}

function offlineTrees(entries: readonly FleetSessionTree[]): FleetSessionTree[] {
  return entries.map((entry) => ({ ...entry, reachable: false }));
}

function sessionTree(snapshot: CollieSnapshot, session: SessionSummary, observedAt: number): FleetSessionTree {
  const panes = [
    ...snapshot.agents.map((pane) => ({ ...pane, kind: "agent" as const })),
    ...snapshot.shellPanes.map((pane) => ({ ...pane, kind: "shell" as const })),
  ];
  return {
    herdrSession: session.name,
    primarySession: session.isPrimary,
    reachable: true,
    observedAt,
    spaces: [...snapshot.workspaces]
      .sort((left, right) => left.number - right.number || left.workspaceId.localeCompare(right.workspaceId))
      .map((workspace) => ({
        workspaceId: workspace.workspaceId,
        number: workspace.number,
        label: workspace.label,
        focused: workspace.focused,
        tabs: snapshot.tabs
          .filter((tab) => tab.workspaceId === workspace.workspaceId)
          .sort((left, right) => left.number - right.number || left.tabId.localeCompare(right.tabId))
          .map((tab) => ({
            tabId: tab.tabId,
            number: tab.number,
            label: tab.label,
            focused: tab.focused,
            panes: panes
              .filter((pane) => pane.workspaceId === workspace.workspaceId && pane.tabId === tab.tabId)
              .sort((left, right) => left.paneId.localeCompare(right.paneId))
              .map((pane) => ({
                paneId: pane.paneId,
                label: pane.paneLabel ?? pane.sessionName ?? null,
                agent: pane.agent,
                kind: pane.kind,
                status: pane.status,
                focused: pane.focused,
              })),
          })),
      })),
  };
}

function unavailableState(
  node: NodeConfig,
  transport: TransportStatus,
  now: number,
  previous?: FleetNodeState,
  message: string | null = transport.message,
): FleetNodeState {
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
    sessions: (previous?.sessions ?? []).map((session) => ({
      ...session,
      reachable: false,
      agents: 0,
      working: 0,
      blocked: 0,
    })),
    agentEntries: offlineAgents(previous?.agentEntries ?? []),
    treeSessions: offlineTrees(previous?.treeSessions ?? []),
    observedAt: now,
    lastHealthyAt: previous?.lastHealthyAt ?? null,
    message,
  };
}

function initialState(node: NodeConfig, transport: TransportStatus, now: number): FleetNodeState {
  return unavailableState(node, transport, now);
}

function sortAgentEntries(entries: FleetAgentCard[]): FleetAgentCard[] {
  return entries.sort(
    (a, b) =>
      a.herdrSession.localeCompare(b.herdrSession) ||
      a.workspaceNumber - b.workspaceNumber ||
      a.paneId.localeCompare(b.paneId),
  );
}

export class FleetCollector {
  private readonly enabledNodes: NodeConfig[];
  private readonly baseRefreshMs: number;
  private readonly states = new Map<string, FleetNodeState>();
  private readonly lastAttemptAt = new Map<string, number>();
  private inFlight: Promise<void> | null = null;
  private refreshDelayMs: number;
  private nextRefreshAt = 0;
  private manualResetPending = false;
  private revision = 0;
  private visibleSignature: string;
  private readonly schedule: NonNullable<FleetCollectorRuntime["schedule"]>;
  private readonly cancel: NonNullable<FleetCollectorRuntime["cancel"]>;
  private readonly onCycle: FleetCollectorRuntime["onCycle"];
  private readonly warn: NonNullable<FleetCollectorRuntime["warn"]>;
  private backgroundEnabled = false;
  private backgroundTimer: unknown | null = null;

  constructor(
    config: GatewayConfig,
    private readonly transports: TransportRegistry,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
    runtime: FleetCollectorRuntime = {},
  ) {
    this.enabledNodes = config.nodes.filter((candidate) => candidate.enabled);
    this.baseRefreshMs = Math.max(config.pollIntervalMs, MIN_NODE_REVISIT_MS);
    this.refreshDelayMs = this.baseRefreshMs;
    for (const node of this.enabledNodes) {
      this.states.set(node.id, initialState(node, transports.status(node), now()));
    }
    this.visibleSignature = this.signature();
    this.schedule =
      runtime.schedule ??
      ((callback, delayMs) => setTimeout(() => void callback(), delayMs));
    this.cancel = runtime.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.onCycle = runtime.onCycle;
    this.warn = runtime.warn ?? ((message) => console.warn(message));
  }

  startBackgroundRefresh(): void {
    if (this.backgroundEnabled) return;
    this.backgroundEnabled = true;
    this.scheduleBackground(0);
  }

  stopBackgroundRefresh(): void {
    this.backgroundEnabled = false;
    if (this.backgroundTimer === null) return;
    this.cancel(this.backgroundTimer);
    this.backgroundTimer = null;
  }

  private scheduleBackground(delayOverride?: number): void {
    if (!this.backgroundEnabled) return;
    if (this.backgroundTimer !== null) this.cancel(this.backgroundTimer);
    const delayMs = delayOverride ?? Math.max(0, this.nextRefreshAt - this.now());
    this.backgroundTimer = this.schedule(async () => {
      this.backgroundTimer = null;
      try {
        await this.refresh();
      } catch {
        this.warn("[gateway/fleet] background refresh failed");
      }
    }, delayMs);
  }

  private nextNodeEligibility(): number {
    return this.enabledNodes.reduce((latest, node) => {
      const attemptedAt = this.lastAttemptAt.get(node.id);
      return attemptedAt === undefined ? latest : Math.max(latest, attemptedAt + MIN_NODE_REVISIT_MS);
    }, 0);
  }

  private finishLateManualReset(): void {
    if (!this.manualResetPending) return;
    this.manualResetPending = false;
    this.refreshDelayMs = this.baseRefreshMs;
    const now = this.now();
    this.nextRefreshAt = Math.max(now + this.baseRefreshMs, this.nextNodeEligibility());
  }

  async refresh(options: { manual?: boolean } = {}): Promise<void> {
    try {
      await this.refreshOnce(options);
    } finally {
      this.scheduleBackground();
    }
  }

  private async refreshOnce(options: { manual?: boolean }): Promise<void> {
    const manual = options.manual === true;
    if (manual) this.manualResetPending = true;
    if (this.inFlight) {
      await this.inFlight;
      if (manual) this.finishLateManualReset();
      return;
    }

    const now = this.now();
    const nextEligibleAt = this.nextNodeEligibility();
    if (manual) {
      this.refreshDelayMs = this.baseRefreshMs;
      this.nextRefreshAt = Math.max(now, nextEligibleAt);
    } else if (now < this.nextRefreshAt) {
      return;
    }
    if (now < nextEligibleAt) {
      this.nextRefreshAt = nextEligibleAt;
      return;
    }

    const pending = (async () => {
      await Promise.all(this.enabledNodes.map((node) => this.refreshNode(node)));
      const next = this.signature();
      const changed = next !== this.visibleSignature;
      if (changed) {
        this.visibleSignature = next;
        this.revision += 1;
      }
      const reset = this.manualResetPending;
      this.manualResetPending = false;
      this.refreshDelayMs =
        changed || reset
          ? this.baseRefreshMs
          : Math.min(Math.max(this.refreshDelayMs, this.baseRefreshMs) * 2, MAX_REFRESH_MS);
      this.nextRefreshAt = Math.max(this.now() + this.refreshDelayMs, this.nextNodeEligibility());
      if (this.onCycle) {
        try {
          const observerDeadline = this.onCycle(this.snapshot());
          if (typeof observerDeadline === "number" && Number.isFinite(observerDeadline)) {
            const earliestEligibleAt = Math.max(this.now(), this.nextNodeEligibility());
            this.nextRefreshAt = Math.min(this.nextRefreshAt, Math.max(observerDeadline, earliestEligibleAt));
          }
        } catch {
          this.warn("[gateway/fleet] collection observer failed");
        }
      }
    })();
    this.inFlight = pending;
    try {
      await pending;
    } finally {
      if (this.inFlight === pending) this.inFlight = null;
    }
  }

  private cachedSession(previous: FleetNodeState | undefined, name: string): FleetAgentCard[] {
    return offlineAgents(previous?.agentEntries.filter((entry) => entry.herdrSession === name) ?? []);
  }

  private cachedSessionTree(previous: FleetNodeState | undefined, name: string): FleetSessionTree | null {
    const tree = previous?.treeSessions.find((entry) => entry.herdrSession === name);
    return tree ? { ...tree, reachable: false } : null;
  }

  private currentSession(agents: AgentProjection[], session: SessionSummary, observedAt: number): FleetAgentCard[] {
    return agents.map((agent) => ({
      ...agent,
      herdrSession: session.name,
      primarySession: session.isPrimary,
      reachable: true,
      observedAt,
    }));
  }

  private async fetchSnapshot(node: NodeConfig, session?: string): Promise<CollieSnapshot> {
    const url = new URL(`${this.transports.upstream(node)}/api/snapshot`);
    if (session !== undefined) url.searchParams.set("session", session);
    const response = await this.fetcher(url, {
      headers: { Accept: "application/json", Host: node.publicHost },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(`bridge returned HTTP ${response.status}`);
    return parseSnapshot(await response.json());
  }

  private async refreshNode(node: NodeConfig): Promise<void> {
    const now = this.now();
    const transport = this.transports.status(node);
    const previous = this.states.get(node.id);
    if (transport.state !== "up") {
      this.states.set(node.id, unavailableState(node, transport, now, previous));
      return;
    }

    this.lastAttemptAt.set(node.id, now);
    try {
      const snapshot = await this.fetchSnapshot(node);
      const bridgeConnected = snapshot.bridge === "connected";
      const sessionResults = await Promise.all(
        snapshot.sessions.map(async (session): Promise<{
          session: SessionSummary;
          entries: FleetAgentCard[];
          tree: FleetSessionTree | null;
        }> => {
          if (!bridgeConnected || !session.reachable) {
            return {
              session: { ...session, reachable: false },
              entries: this.cachedSession(previous, session.name),
              tree: this.cachedSessionTree(previous, session.name),
            };
          }
          if (session.isPrimary) {
            return {
              session,
              entries: this.currentSession(snapshot.agents, session, now),
              tree: sessionTree(snapshot, session, now),
            };
          }
          try {
            const detail = await this.fetchSnapshot(node, session.name);
            if (detail.bridge !== "connected") throw new Error("named session bridge is disconnected");
            return {
              session,
              entries: this.currentSession(detail.agents, session, now),
              tree: sessionTree(detail, session, now),
            };
          } catch {
            return {
              session: { ...session, reachable: false },
              entries: this.cachedSession(previous, session.name),
              tree: this.cachedSessionTree(previous, session.name),
            };
          }
        }),
      );

      const sessions = sessionResults.map((result) => result.session);
      const agents = snapshot.sessions.reduce((sum, session) => sum + session.agents, 0);
      const working = snapshot.sessions.reduce((sum, session) => sum + session.working, 0);
      const blocked = snapshot.sessions.reduce((sum, session) => sum + session.blocked, 0);
      const online = bridgeConnected && snapshot.sessions.some((session) => session.reachable);
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
        agentEntries: sortAgentEntries(sessionResults.flatMap((result) => result.entries)),
        treeSessions: sessionResults.flatMap((result) => result.tree ? [result.tree] : []),
        observedAt: now,
        lastHealthyAt: online ? now : (previous?.lastHealthyAt ?? null),
        message: online ? null : "Collie is reachable but no Herdr session is connected",
      });
    } catch (error) {
      this.states.set(
        node.id,
        unavailableState(
          node,
          transport,
          now,
          previous,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  private sortedNodes(): FleetNodeState[] {
    return [...this.states.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private signature(): string {
    return JSON.stringify(
      this.sortedNodes().map((node) => ({
        id: node.id,
        name: node.name,
        publicHost: node.publicHost,
        labels: node.labels,
        health: node.health,
        transport: { kind: node.transport.kind, state: node.transport.state, message: node.transport.message },
        bridge: node.bridge,
        agents: node.agents,
        working: node.working,
        blocked: node.blocked,
        sessions: node.sessions,
        agentEntries: node.agentEntries.map(({ observedAt: _observedAt, ...entry }) => entry),
        treeSessions: node.treeSessions.map(({ observedAt: _observedAt, ...tree }) => tree),
        message: node.message,
      })),
    );
  }

  snapshot(): FleetState {
    const nodes = this.sortedNodes();
    return {
      generatedAt: this.now(),
      revision: this.revision,
      refresh: {
        baseMs: this.baseRefreshMs,
        maxMs: MAX_REFRESH_MS,
        minNodeRevisitMs: MIN_NODE_REVISIT_MS,
        delayMs: this.refreshDelayMs,
        nextAt: this.nextRefreshAt,
      },
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
