import { describe, expect, test } from "bun:test";

import type { DiscordNotificationConfig } from "./config.ts";
import {
  buildFleetDiscordAlert,
  buildFleetPaneUrl,
  fleetAgentDisplayName,
  FleetDiscordNotifier,
  PingmeDiscordSender,
  pingmeArguments,
  runPingmeCommand,
  type FleetDiscordAlert,
  type FleetDiscordSender,
  type PingmeCommandRunner,
} from "./discord-notifications.ts";
import type { FleetAgentCard, FleetAgentStatus, FleetNodeState, FleetState } from "./fleet.ts";

const enabledConfig: Extract<DiscordNotificationConfig, { enabled: true }> = {
  enabled: true,
  executable: "/opt/example/bin/pingme",
  channel: "test",
};

function card(
  paneId: string,
  status: FleetAgentStatus,
  extra: Partial<FleetAgentCard> = {},
): FleetAgentCard {
  return {
    paneId,
    workspaceId: "w0",
    workspaceLabel: "Example project",
    workspaceNumber: 0,
    tabId: "w0:t0",
    tabLabel: "Main",
    agent: "codex",
    status,
    cwd: "/srv/example-project",
    focused: false,
    herdrSession: "default",
    primarySession: true,
    reachable: true,
    observedAt: 100,
    lastActiveAt: 90,
    lastSeenAt: 80,
    ...extra,
  };
}

function fleet(
  cards: FleetAgentCard[],
  options: Partial<{ health: FleetNodeState["health"]; sessionReachable: boolean; sessionPresent: boolean }> = {},
): FleetState {
  const health = options.health ?? "online";
  const sessions = options.sessionPresent === false
    ? []
    : [
        {
          name: "default",
          isPrimary: true,
          reachable: options.sessionReachable ?? true,
          agents: cards.length,
          working: cards.filter((entry) => entry.status === "working").length,
          blocked: cards.filter((entry) => entry.status === "blocked").length,
        },
      ];
  return {
    generatedAt: 100,
    revision: 1,
    refresh: { baseMs: 5_000, maxMs: 3_600_000, minNodeRevisitMs: 5_000, delayMs: 5_000, nextAt: 5_100 },
    totals: { nodes: 1, online: health === "online" ? 1 : 0, agents: cards.length, working: 0, blocked: 0 },
    nodes: [
      {
        id: "cluster-a",
        name: "Cluster A",
        publicHost: "cluster-a.example.com",
        labels: ["remote"],
        health,
        transport: { kind: "ssh", state: health === "transport-down" ? "down" : "up", pid: 123, message: null },
        bridge: health === "online" ? "connected" : null,
        agents: cards.length,
        working: cards.filter((entry) => entry.status === "working").length,
        blocked: cards.filter((entry) => entry.status === "blocked").length,
        sessions,
        agentEntries: cards,
        observedAt: 100,
        lastHealthyAt: health === "online" ? 100 : 50,
        message: null,
      },
    ],
  };
}

class RecordingSender implements FleetDiscordSender {
  readonly alerts: FleetDiscordAlert[] = [];

  constructor(private readonly failure?: Error) {}

  async send(alert: FleetDiscordAlert): Promise<void> {
    this.alerts.push(alert);
    if (this.failure) throw this.failure;
  }
}

describe("Fleet Discord message adapter", () => {
  test("builds a canonical named-session Pane link with a link-only message", () => {
    const agent = card("w0:p7", "done", {
      herdrSession: "batch demo",
      primarySession: false,
      paneLabel: "Release",
    });
    const url = buildFleetPaneUrl("fleet.example.com", "cluster-a", agent);
    expect(url).toBe("https://fleet.example.com/?instance=cluster-a&pane=w0%3Ap7&session=batch+demo");

    const alert = buildFleetDiscordAlert("fleet.example.com", { id: "cluster-a", name: "Cluster A" }, agent);
    expect(alert.message).toBe(`[Open Pane in Fleet](${url})`);
    expect(alert).toMatchObject({
      agent: "codex",
      status: "done",
      statusLabel: "completed",
      host: "Cluster A",
      workspace: "Example project",
      tab: "Main",
      pane: "Release",
      session: "batch demo",
    });
    expect(alert.message).not.toContain("Agent completed");
    expect(alert.message).not.toContain("Host:");
    expect(alert.message).not.toContain(agent.cwd);
  });

  test("uses conventional Agent display names and preserves bounded unknown names", () => {
    expect(fleetAgentDisplayName("codex")).toBe("Codex");
    expect(fleetAgentDisplayName("CLAUDE")).toBe("Claude Code");
    expect(fleetAgentDisplayName("opencode")).toBe("OpenCode");
    expect(fleetAgentDisplayName("pi")).toBe("Pi");
    expect(fleetAgentDisplayName("  custom\nagent  ")).toBe("custom agent");
  });

  test("uses the default template unless an opaque custom selector is configured", () => {
    const alert = buildFleetDiscordAlert(
      "fleet.example.com",
      { id: "cluster-a", name: "Cluster A" },
      card("w0:p1", "blocked"),
    );
    const defaults = pingmeArguments(enabledConfig, alert);
    expect(defaults).not.toContain("--template");
    expect(defaults.slice(0, 3)).toEqual(["send", "--channel", "test"]);
    expect(defaults).toContain("status=blocked");
    expect(defaults).toContain(`pane_url=${alert.paneUrl}`);
    expect(defaults.at(-2)).toBe("--");
    expect(defaults.at(-1)).toBe(alert.message);
    expect(alert.message).toBe(`[Open Pane in Fleet](${alert.paneUrl})`);

    const template = "/opt/example/templates/fleet alert.md";
    const custom = pingmeArguments({ ...enabledConfig, template }, alert);
    expect(custom.slice(custom.indexOf("--template"), custom.indexOf("--template") + 2)).toEqual(["--template", template]);
  });

  test("invokes the configured executable directly with Fleet runtime metadata", async () => {
    const calls: Array<{ executable: string; args: readonly string[]; env: NodeJS.ProcessEnv }> = [];
    const run: PingmeCommandRunner = async (executable, args, env) => {
      calls.push({ executable, args, env });
      return { stdout: "{}" };
    };
    const sender = new PingmeDiscordSender(enabledConfig, run, { PATH: "/synthetic/bin" });
    const alert = buildFleetDiscordAlert(
      "fleet.example.com",
      { id: "cluster-a", name: "Cluster A" },
      card("w0:p1", "done"),
    );

    await sender.send(alert);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.executable).toBe("/opt/example/bin/pingme");
    expect(calls[0]?.args).toEqual(pingmeArguments(enabledConfig, alert));
    expect(calls[0]?.env).toMatchObject({
      PATH: "/synthetic/bin",
      PINGME_AGENT_NAME: "Codex",
      PINGME_PROJECT_NAME: "Example project",
      PINGME_SESSION_NAME: "Main",
    });
  });

  test("uses workspace and Tab ids when display labels are absent", async () => {
    const calls: Array<{ env: NodeJS.ProcessEnv }> = [];
    const run: PingmeCommandRunner = async (_executable, _args, env) => {
      calls.push({ env });
      return { stdout: "{}" };
    };
    const sender = new PingmeDiscordSender(enabledConfig, run, {});
    const alert = buildFleetDiscordAlert(
      "fleet.example.com",
      { id: "cluster-a", name: "Cluster A" },
      card("w0:p1", "blocked", { agent: "custom-agent", workspaceLabel: " \n ", tabLabel: undefined }),
    );

    await sender.send(alert);

    expect(calls[0]?.env).toMatchObject({
      PINGME_AGENT_NAME: "custom-agent",
      PINGME_PROJECT_NAME: "w0",
      PINGME_SESSION_NAME: "w0:t0",
    });
    expect(alert.message).toBe(`[Open Pane in Fleet](${alert.paneUrl})`);
    expect(alert.message).not.toContain("needs you");
  });

  test("bounds missing-executable and timeout failures without exposing child output", async () => {
    await expect(
      runPingmeCommand("/synthetic/missing/pingme", [], {}, 100),
    ).rejects.toThrow("executable is unavailable");
    await expect(
      runPingmeCommand(process.execPath, ["-e", "await Bun.sleep(1000)"], process.env, 10),
    ).rejects.toThrow("timed out");
  });
});

describe("Fleet Discord transition ledger", () => {
  test("silently baselines, then emits done, same-state activity, and Needs You once each", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")]));
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 200, observedAt: 200 })]));
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 200, observedAt: 300 })]));
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 400, observedAt: 400 })]));
    notifier.observe(fleet([card("w0:p1", "blocked", { lastActiveAt: 500, observedAt: 500 })]));
    await notifier.flush();

    expect(sender.alerts.map((alert) => [alert.status, alert.observedAt])).toEqual([
      ["done", 200],
      ["done", 400],
      ["blocked", 500],
    ]);
    expect(sender.alerts.at(-1)?.message).toBe(
      `[Open Pane in Fleet](${sender.alerts.at(-1)?.paneUrl})`,
    );
  });

  test("ignores offline projections and compares recovery with the last successful fetch", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")]));
    notifier.observe(
      fleet([card("w0:p1", "blocked", { reachable: false, observedAt: 100 })], {
        health: "transport-down",
        sessionReachable: false,
      }),
    );
    notifier.observe(fleet([card("w0:p1", "blocked", { observedAt: 300, lastActiveAt: 300 })]));
    await notifier.flush();

    expect(sender.alerts).toHaveLength(1);
    expect(sender.alerts[0]?.status).toBe("blocked");
  });

  test("prunes authoritative removals and silently re-baselines removed or identity-replaced Panes", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")]));
    notifier.observe(fleet([]));
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 300 })]));
    notifier.observe(fleet([card("w0:p1", "blocked", { agent: "claude", lastActiveAt: 400 })]));
    await notifier.flush();

    expect(sender.alerts).toEqual([]);
  });

  test("does not retry failed events and bounds simultaneous delivery", async () => {
    const warnings: string[] = [];
    const sender = new RecordingSender(new Error("synthetic failure"));
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender, {
      maxPending: 1,
      warn: (message) => warnings.push(message),
    });
    notifier.observe(fleet([card("w0:p1", "working"), card("w0:p2", "working")]));
    notifier.observe(
      fleet([
        card("w0:p1", "done", { lastActiveAt: 200 }),
        card("w0:p2", "blocked", { lastActiveAt: 200 }),
      ]),
    );
    notifier.observe(
      fleet([
        card("w0:p1", "done", { lastActiveAt: 200 }),
        card("w0:p2", "blocked", { lastActiveAt: 200 }),
      ]),
    );
    await notifier.flush();

    expect(sender.alerts).toHaveLength(1);
    expect(warnings.filter((message) => message.includes("queue is full"))).toHaveLength(1);
    expect(warnings.filter((message) => message.includes("could not deliver"))).toHaveLength(1);
  });

  test("preserves state for an unavailable session but prunes a session removed by a healthy node", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")]));
    notifier.observe(fleet([card("w0:p1", "working", { reachable: false })], { sessionReachable: false }));
    notifier.observe(fleet([], { sessionPresent: false }));
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 400 })]));
    await notifier.flush();

    expect(sender.alerts).toEqual([]);
  });
});
