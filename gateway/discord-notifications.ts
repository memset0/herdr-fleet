import { execFile } from "node:child_process";

import type { DiscordNotificationConfig } from "./config.ts";
import type { FleetAgentCard, FleetAgentStatus, FleetNodeState, FleetState } from "./fleet.ts";

type EnabledDiscordNotifications = Extract<DiscordNotificationConfig, { enabled: true }>;

export interface FleetDiscordAlert {
  agent: string;
  status: Extract<FleetAgentStatus, "blocked" | "done">;
  statusLabel: "completed" | "needs you";
  host: string;
  hostId: string;
  workspace: string;
  workspaceId: string;
  tab: string;
  tabId: string;
  pane: string;
  paneId: string;
  session: string;
  observedAt: number;
  paneUrl: string;
  message: string;
}

export interface PingmeCommandResult {
  stdout: string;
}

export type PingmeCommandRunner = (
  executable: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
) => Promise<PingmeCommandResult>;

export interface FleetDiscordSender {
  send(alert: FleetDiscordAlert): Promise<void>;
}

interface LastObservation {
  nodeId: string;
  sourceKey: string;
  identity: string;
  actionable: ActionableGroup | null;
}

type ActionableGroup = "ready" | "needs-you";

interface NotificationCandidate {
  identity: string;
  group: ActionableGroup;
  dueAt: number;
}

interface NotifierOptions {
  maxPending?: number;
  warn?: (message: string) => void;
}

const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_PENDING = 128;
const MAX_COMMAND_OUTPUT_BYTES = 64 * 1_024;
export const FLEET_DISCORD_CONFIRMATION_MS = 10_000;
const FLEET_RUNTIME_SESSION_NAME = "Fleet";
const AGENT_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  pi: "Pi",
};

function displayLine(value: string, fallback: string, max = 240): string {
  const line = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() || fallback;
  return line.length <= max ? line : `${line.slice(0, Math.max(0, max - 1))}…`;
}

export function fleetAgentDisplayName(value: string): string {
  const agent = displayLine(value, "Agent");
  return AGENT_DISPLAY_NAMES[agent.toLowerCase()] ?? agent;
}

function sourceKey(nodeId: string, session: string): string {
  return JSON.stringify([nodeId, session]);
}

function cardKey(nodeId: string, agent: FleetAgentCard): string {
  return JSON.stringify([nodeId, agent.herdrSession, agent.paneId]);
}

function cardIdentity(agent: FleetAgentCard): string {
  return JSON.stringify([agent.agent, agent.workspaceId, agent.tabId]);
}

function isAttentionStatus(status: FleetAgentStatus): status is FleetDiscordAlert["status"] {
  return status === "blocked" || status === "done";
}

function actionableGroup(agent: FleetAgentCard): ActionableGroup | null {
  if (agent.status === "blocked") return "needs-you";
  if (agent.status === "done" && (agent.lastActiveAt ?? 0) > (agent.lastSeenAt ?? 0)) return "ready";
  return null;
}

export function fleetDiscordAvatar(status: FleetDiscordAlert["status"]): "success" | "needs-input" {
  return status === "done" ? "success" : "needs-input";
}

function commandFailure(error: { code?: string | number; killed?: boolean; signal?: string | null }): Error {
  if (error.killed || error.signal === "SIGTERM") return new Error("pingme timed out");
  if (error.code === "ENOENT") return new Error("pingme executable is unavailable");
  return new Error(`pingme exited unsuccessfully${error.code === undefined ? "" : ` (${String(error.code)})`}`);
}

export function runPingmeCommand(
  executable: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
): Promise<PingmeCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      [...args],
      {
        encoding: "utf8",
        env,
        maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
        timeout: timeoutMs,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          reject(commandFailure(error));
          return;
        }
        resolve({ stdout });
      },
    );
  });
}

export function buildFleetPaneUrl(fleetHost: string, nodeId: string, agent: FleetAgentCard): string {
  const url = new URL(`https://${fleetHost}/`);
  url.searchParams.set("instance", nodeId);
  url.searchParams.set("pane", agent.paneId);
  if (!agent.primarySession) url.searchParams.set("session", agent.herdrSession);
  return url.toString();
}

export function buildFleetDiscordAlert(
  fleetHost: string,
  node: Pick<FleetNodeState, "id" | "name">,
  agent: FleetAgentCard,
): FleetDiscordAlert {
  if (!isAttentionStatus(agent.status)) throw new Error("Fleet Discord alerts require blocked or done status");
  const statusLabel = agent.status === "blocked" ? "needs you" : "completed";
  const workspace = displayLine(agent.workspaceLabel, agent.workspaceId);
  const tab = displayLine(agent.tabLabel ?? "", agent.tabId);
  const pane = displayLine(agent.paneLabel ?? agent.sessionName ?? "", agent.paneId);
  const session = displayLine(agent.herdrSession, "default");
  const paneUrl = buildFleetPaneUrl(fleetHost, node.id, agent);

  return {
    agent: displayLine(agent.agent, "agent"),
    status: agent.status,
    statusLabel,
    host: displayLine(node.name, node.id),
    hostId: node.id,
    workspace,
    workspaceId: agent.workspaceId,
    tab,
    tabId: agent.tabId,
    pane,
    paneId: agent.paneId,
    session,
    observedAt: agent.observedAt,
    paneUrl,
    message: `[Open Pane in Fleet](${paneUrl})`,
  };
}

export function pingmeArguments(config: EnabledDiscordNotifications, alert: FleetDiscordAlert): string[] {
  const variables: ReadonlyArray<readonly [string, string]> = [
    ["agent", alert.agent],
    ["status", alert.status],
    ["status_label", alert.statusLabel],
    ["host", alert.host],
    ["host_id", alert.hostId],
    ["workspace", alert.workspace],
    ["workspace_id", alert.workspaceId],
    ["tab", alert.tab],
    ["tab_id", alert.tabId],
    ["pane", alert.pane],
    ["pane_id", alert.paneId],
    ["session", alert.session],
    ["observed_at", String(alert.observedAt)],
    ["pane_url", alert.paneUrl],
  ];
  const args = ["send", "--channel", config.channel, "--avatar", fleetDiscordAvatar(alert.status)];
  if (config.template) args.push("--template", config.template);
  for (const [key, value] of variables) args.push("--var", `${key}=${value}`);
  args.push("--", alert.message);
  return args;
}

export class PingmeDiscordSender implements FleetDiscordSender {
  constructor(
    private readonly config: EnabledDiscordNotifications,
    private readonly run: PingmeCommandRunner = runPingmeCommand,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async send(alert: FleetDiscordAlert): Promise<void> {
    await this.run(this.config.executable, pingmeArguments(this.config, alert), {
      ...this.env,
      PINGME_AGENT_NAME: fleetAgentDisplayName(alert.agent),
      PINGME_PROJECT_NAME: alert.workspace,
      PINGME_SESSION_NAME: FLEET_RUNTIME_SESSION_NAME,
      PINGME_SESSION_ID: "",
      CLAUDE_CODE_SESSION_ID: "",
      CODEX_THREAD_ID: "",
    });
  }
}

export class FleetDiscordNotifier {
  private readonly observations = new Map<string, LastObservation>();
  private readonly candidates = new Map<string, NotificationCandidate>();
  private readonly maxPending: number;
  private readonly warn: (message: string) => void;
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;

  constructor(
    private readonly fleetHost: string,
    private readonly sender: FleetDiscordSender,
    options: NotifierOptions = {},
  ) {
    this.maxPending = options.maxPending ?? DEFAULT_MAX_PENDING;
    this.warn = options.warn ?? ((message) => console.warn(message));
  }

  observe(state: FleetState): number | null {
    const authoritativeNodes = new Set<string>();
    const knownSources = new Set<string>();
    const authoritativeSources = new Set<string>();
    const currentCards = new Set<string>();

    for (const node of state.nodes) {
      if (node.health === "online") authoritativeNodes.add(node.id);
      for (const session of node.sessions) {
        const source = sourceKey(node.id, session.name);
        knownSources.add(source);
        if (session.reachable) authoritativeSources.add(source);
      }
      for (const agent of node.agentEntries) {
        const key = cardKey(node.id, agent);
        if (!agent.reachable) {
          this.candidates.delete(key);
          continue;
        }
        const source = sourceKey(node.id, agent.herdrSession);
        const identity = cardIdentity(agent);
        const previous = this.observations.get(key);
        const currentActionable = actionableGroup(agent);
        currentCards.add(key);
        authoritativeSources.add(source);

        if (!previous || previous.identity !== identity) {
          this.candidates.delete(key);
        } else if (currentActionable !== previous.actionable) {
          this.candidates.delete(key);
          if (currentActionable !== null) {
            this.candidates.set(key, {
              identity,
              group: currentActionable,
              dueAt: state.generatedAt + FLEET_DISCORD_CONFIRMATION_MS,
            });
          }
        } else {
          const candidate = this.candidates.get(key);
          if (
            candidate &&
            (currentActionable === null || candidate.identity !== identity || candidate.group !== currentActionable)
          ) {
            this.candidates.delete(key);
          } else if (candidate && state.generatedAt >= candidate.dueAt) {
            this.candidates.delete(key);
            this.enqueue(buildFleetDiscordAlert(this.fleetHost, node, agent));
          }
        }
        this.observations.set(key, {
          nodeId: node.id,
          sourceKey: source,
          identity,
          actionable: currentActionable,
        });
      }
    }

    for (const [key, previous] of this.observations) {
      const sourceRemoved = authoritativeNodes.has(previous.nodeId) && !knownSources.has(previous.sourceKey);
      const cardRemoved = authoritativeSources.has(previous.sourceKey) && !currentCards.has(key);
      if (sourceRemoved || cardRemoved) {
        this.observations.delete(key);
        this.candidates.delete(key);
      }
    }

    let earliest: number | null = null;
    for (const candidate of this.candidates.values()) {
      if (earliest === null || candidate.dueAt < earliest) earliest = candidate.dueAt;
    }
    return earliest;
  }

  async flush(): Promise<void> {
    await this.queue;
  }

  private enqueue(alert: FleetDiscordAlert): void {
    if (this.pending >= this.maxPending) {
      this.warn(`[gateway/discord] alert queue is full; dropped ${alert.hostId}/${alert.paneId}`);
      return;
    }
    this.pending += 1;
    this.queue = this.queue
      .then(() => this.sender.send(alert))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "unknown delivery failure";
        this.warn(`[gateway/discord] could not deliver ${alert.hostId}/${alert.paneId}: ${displayLine(message, "failure", 160)}`);
      })
      .finally(() => {
        this.pending -= 1;
      });
  }
}
