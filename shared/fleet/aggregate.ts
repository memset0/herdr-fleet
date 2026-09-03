export interface SessionSummary {
  name: string;
  isPrimary: boolean;
  reachable: boolean;
  agents: number;
  working: number;
  blocked: number;
}

export type FleetAgentStatus =
  | "idle"
  | "working"
  | "blocked"
  | "done"
  | "unknown";

export interface AgentProjection {
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

export interface WorkspaceProjection {
  workspaceId: string;
  number: number;
  label: string;
  focused: boolean;
  activeTabId: string;
  tabCount: number;
  paneCount: number;
}

export interface TabProjection {
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

export interface FleetTransportStatus {
  kind: "local" | "ssh";
  state: "up" | "starting" | "down";
  pid: number | null;
  message: string | null;
}

export interface FleetNodeState {
  id: string;
  name: string;
  publicHost: string;
  labels: string[];
  health: "online" | "herdr-down" | "bridge-down" | "transport-down";
  transport: FleetTransportStatus;
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
  totals: {
    nodes: number;
    online: number;
    agents: number;
    working: number;
    blocked: number;
  };
  nodes: FleetNodeState[];
}
