import { execFile } from "node:child_process";

import type { DiscordNotificationConfig } from "./config.ts";
import type { FleetAgentCard, FleetAgentStatus, FleetNodeState, FleetState } from "./fleet.ts";
import { normalizeFleetAgentReply, type FleetHistoryReader } from "./history.ts";

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
  username: string;
  agentReply?: string;
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
  history?: FleetHistoryReader;
}

export const PINGME_COMMAND_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_PENDING = 128;
const MAX_COMMAND_OUTPUT_BYTES = 64 * 1_024;
export const FLEET_DISCORD_CONFIRMATION_MS = 10_000;
const MAX_DISCORD_USERNAME_CHARS = 80;
const AGENT_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  pi: "Pi",
};

function displayLine(value: string, fallback: string, max = 240): string {
  const line = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() || fallback;
  const characters = Array.from(line);
  return characters.length <= max ? line : `${characters.slice(0, Math.max(0, max - 1)).join("")}…`;
}

export function fleetAgentDisplayName(value: string): string {
  const agent = displayLine(value, "Agent");
  return AGENT_DISPLAY_NAMES[agent.toLowerCase()] ?? agent;
}

function optionalDisplayName(value: string | undefined, internalId: string): string | null {
  if (value === undefined) return null;
  const line = displayLine(value, "");
  return line === "" || line === internalId ? null : line;
}

export function fleetDiscordUsername(agent: FleetAgentCard): string {
  const levels = [
    optionalDisplayName(agent.workspaceLabel, agent.workspaceId),
    optionalDisplayName(agent.tabLabel, agent.tabId),
    optionalDisplayName(agent.paneLabel, agent.paneId)
      ?? optionalDisplayName(agent.sessionName, agent.paneId)
      ?? fleetAgentDisplayName(agent.agent),
  ].filter((value): value is string => value !== null);
  return displayLine(levels.join(" · "), "Fleet", MAX_DISCORD_USERNAME_CHARS);
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

function notificationStatus(group: ActionableGroup): FleetDiscordAlert["status"] {
  return group === "ready" ? "done" : "blocked";
}

export function fleetDiscordAvatar(status: FleetDiscordAlert["status"]): "success" | "needs-input" {
  return status === "done" ? "success" : "needs-input";
}

export type PingmeCommandFailureKind = "timeout" | "unavailable" | "exit";

export class PingmeCommandFailure extends Error {
  constructor(readonly kind: PingmeCommandFailureKind, exitCode?: string | number) {
    super(
      kind === "timeout"
        ? "pingme timed out"
        : kind === "unavailable"
          ? "pingme executable is unavailable"
          : `pingme exited unsuccessfully${exitCode === undefined ? "" : ` (${String(exitCode)})`}`,
    );
    this.name = "PingmeCommandFailure";
  }
}

function commandFailure(
  error: { code?: string | number; killed?: boolean; signal?: string | null },
): PingmeCommandFailure {
  if (error.killed || error.signal === "SIGTERM") {
    return new PingmeCommandFailure("timeout");
  }
  if (error.code === "ENOENT") {
    return new PingmeCommandFailure("unavailable");
  }
  return new PingmeCommandFailure("exit", error.code);
}

export function runPingmeCommand(
  executable: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  timeoutMs = PINGME_COMMAND_TIMEOUT_MS,
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
  url.searchParams.set("space", agent.workspaceId);
  url.searchParams.set("tab", agent.tabId);
  url.searchParams.set("pane", agent.paneId);
  if (!agent.primarySession) url.searchParams.set("session", agent.herdrSession);
  return url.toString();
}

export function buildFleetDiscordAlert(
  fleetHost: string,
  node: Pick<FleetNodeState, "id" | "name">,
  agent: FleetAgentCard,
  agentReply?: string | null,
): FleetDiscordAlert {
  if (!isAttentionStatus(agent.status)) throw new Error("Fleet Discord alerts require blocked or done status");
  const statusLabel = agent.status === "blocked" ? "needs you" : "completed";
  const workspace = displayLine(agent.workspaceLabel, agent.workspaceId);
  const tab = displayLine(agent.tabLabel ?? "", agent.tabId);
  const pane = displayLine(agent.paneLabel ?? agent.sessionName ?? "", agent.paneId);
  const session = displayLine(agent.herdrSession, "default");
  const paneUrl = buildFleetPaneUrl(fleetHost, node.id, agent);
  const reply = agentReply === undefined || agentReply === null
    ? null
    : normalizeFleetAgentReply(agentReply);
  const link = `[Open Pane in Fleet](${paneUrl})`;

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
    username: fleetDiscordUsername(agent),
    ...(reply !== null ? { agentReply: reply } : {}),
    message: reply === null ? link : `${reply}\n${link}`,
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
    ["agent_reply", alert.agentReply ?? ""],
  ];
  const args = [
    "send",
    "--channel",
    config.channel,
    "--avatar",
    fleetDiscordAvatar(alert.status),
    "--username",
    alert.username,
  ];
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
      PINGME_PROJECT_NAME: optionalDisplayName(alert.workspace, alert.workspaceId) ?? "Fleet",
      PINGME_SESSION_NAME: optionalDisplayName(alert.tab, alert.tabId) ?? "",
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
  private readonly history: FleetHistoryReader | null;
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;

  constructor(
    private readonly fleetHost: string,
    private readonly sender: FleetDiscordSender,
    options: NotifierOptions = {},
  ) {
    this.maxPending = options.maxPending ?? DEFAULT_MAX_PENDING;
    this.warn = options.warn ?? ((message) => console.warn(message));
    this.history = options.history ?? null;
  }

  observe(state: FleetState): number | null {
    const authoritativeNodes = new Set<string>();
    const knownSources = new Set<string>();
    const authoritativeSources = new Set<string>();
    const currentCards = new Set<string>();
    const reachableCards = new Set<string>();

    for (const node of state.nodes) {
      if (node.health === "online") authoritativeNodes.add(node.id);
      for (const session of node.sessions) {
        const source = sourceKey(node.id, session.name);
        knownSources.add(source);
        if (session.reachable) authoritativeSources.add(source);
      }
      for (const agent of node.agentEntries) {
        const key = cardKey(node.id, agent);
        if (!agent.reachable) continue;
        const source = sourceKey(node.id, agent.herdrSession);
        const identity = cardIdentity(agent);
        const previous = this.observations.get(key);
        const currentActionable = actionableGroup(agent);
        currentCards.add(key);
        reachableCards.add(key);
        authoritativeSources.add(source);

        if (!previous || previous.identity !== identity) {
          this.candidates.delete(key);
        } else if (agent.status === "working") {
          this.candidates.delete(key);
        } else {
          const candidate = this.candidates.get(key);
          if (candidate && candidate.identity !== identity) {
            this.candidates.delete(key);
          } else if (candidate) {
            if (currentActionable !== null) candidate.group = currentActionable;
            if (state.generatedAt >= candidate.dueAt) {
              this.candidates.delete(key);
              this.enqueue(node, agent, candidate.group);
            }
          } else if (currentActionable !== null && currentActionable !== previous.actionable) {
            this.candidates.set(key, {
              identity,
              group: currentActionable,
              dueAt: state.generatedAt + FLEET_DISCORD_CONFIRMATION_MS,
            });
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
    for (const [key, candidate] of this.candidates) {
      if (!reachableCards.has(key)) continue;
      if (earliest === null || candidate.dueAt < earliest) earliest = candidate.dueAt;
    }
    return earliest;
  }

  async flush(): Promise<void> {
    await this.queue;
  }

  private enqueue(node: FleetNodeState, agent: FleetAgentCard, group: ActionableGroup): void {
    if (this.pending >= this.maxPending) {
      this.warn(`[gateway/discord] alert queue is full; dropped ${node.id}/${agent.paneId}`);
      return;
    }
    const alertAgent: FleetAgentCard = { ...agent, status: notificationStatus(group) };
    this.pending += 1;
    this.queue = this.queue
      .then(async () => {
        let reply: string | null = null;
        if (this.history !== null) {
          try {
            reply = await this.history.latestAssistantReply(node.id, agent);
          } catch {
            // Never include the thrown message: a future adapter could accidentally put transcript
            // content in it. Node/Pane identity is enough to diagnose the link-only fallback.
            this.warn(`[gateway/discord] could not read History for ${node.id}/${agent.paneId}; using link-only alert`);
          }
        }
        await this.sender.send(buildFleetDiscordAlert(this.fleetHost, node, alertAgent, reply));
      })
      .catch((error: unknown) => {
        // The composed message is an argv value; keep it out of diagnostics even if an injected
        // sender returns an unsafe error string.
        const reason = error instanceof PingmeCommandFailure
          ? ` (${error.kind === "timeout" ? "pingme timed out" : error.kind === "unavailable" ? "pingme unavailable" : "pingme exited"})`
          : "";
        this.warn(
          `[gateway/discord] could not deliver ${node.id}/${agent.paneId}${reason}; event will not be retried`,
        );
      })
      .finally(() => {
        this.pending -= 1;
      });
  }
}
