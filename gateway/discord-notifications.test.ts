import { describe, expect, test } from "bun:test";

import type { DiscordNotificationConfig } from "./config.ts";
import {
  buildFleetDiscordAlert,
  buildFleetPaneUrl,
  fleetAgentDisplayName,
  fleetDiscordAvatar,
  fleetDiscordUsername,
  FLEET_DISCORD_CONFIRMATION_MS,
  FleetDiscordNotifier,
  PINGME_COMMAND_TIMEOUT_MS,
  PingmeCommandFailure,
  PingmeDiscordSender,
  pingmeArguments,
  runPingmeCommand,
  type FleetDiscordAlert,
  type FleetDiscordSender,
  type PingmeCommandRunner,
} from "./discord-notifications.ts";
import type { FleetAgentCard, FleetAgentStatus, FleetNodeState, FleetState } from "./fleet.ts";
import type { FleetHistoryReader } from "./history.ts";

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
    paneLabel: "Agent pane",
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
  options: Partial<{
    generatedAt: number;
    health: FleetNodeState["health"];
    sessionReachable: boolean;
    sessionPresent: boolean;
  }> = {},
): FleetState {
  const generatedAt = options.generatedAt ?? 100;
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
    generatedAt,
    revision: 1,
    refresh: {
      baseMs: 5_000,
      maxMs: 3_600_000,
      minNodeRevisitMs: 5_000,
      delayMs: 5_000,
      nextAt: generatedAt + 5_000,
    },
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
        observedAt: generatedAt,
        lastHealthyAt: health === "online" ? generatedAt : 50,
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

class RecordingHistoryReader implements FleetHistoryReader {
  readonly calls: Array<{ nodeId: string; paneId: string; session: string }> = [];

  constructor(
    private readonly read: (nodeId: string, agent: FleetAgentCard) => Promise<string | null>,
  ) {}

  async latestAssistantReply(nodeId: string, agent: FleetAgentCard): Promise<string | null> {
    this.calls.push({ nodeId, paneId: agent.paneId, session: agent.herdrSession });
    return this.read(nodeId, agent);
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
    expect(url).toBe(
      "https://fleet.example.com/?instance=cluster-a&space=w0&tab=w0%3At0&pane=w0%3Ap7&session=batch+demo",
    );

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
      username: "Example project · Main · Release",
    });
    expect(alert.message).not.toContain("Agent completed");
    expect(alert.message).not.toContain("Host:");
    expect(alert.message).not.toContain(agent.cwd);
  });

  test("puts one normalized bounded Agent reply before the canonical link", () => {
    const agent = card("w0:p7", "done");
    const alert = buildFleetDiscordAlert(
      "fleet.example.com",
      { id: "cluster-a", name: "Cluster A" },
      agent,
      `  \u001b[32mFinished.\u001b[0m\r\nAll checks passed.\u0000  `,
    );

    expect(alert.agentReply).toBe("Finished.\nAll checks passed.");
    expect(alert.message).toBe(
      `Finished.\nAll checks passed.\n[Open Pane in Fleet](${alert.paneUrl})`,
    );
    expect(pingmeArguments(enabledConfig, alert)).toContain(
      "agent_reply=Finished.\nAll checks passed.",
    );
  });

  test("uses conventional Agent display names and preserves bounded unknown names", () => {
    expect(fleetAgentDisplayName("codex")).toBe("Codex");
    expect(fleetAgentDisplayName("CLAUDE")).toBe("Claude Code");
    expect(fleetAgentDisplayName("opencode")).toBe("OpenCode");
    expect(fleetAgentDisplayName("pi")).toBe("Pi");
    expect(fleetAgentDisplayName("  custom\nagent  ")).toBe("custom agent");
  });

  test("uses readable Space, Tab, and Pane names as the bounded Discord username", () => {
    expect(fleetDiscordUsername(card("w0:p1", "done"))).toBe(
      "Example project · Main · Agent pane",
    );
    expect(
      fleetDiscordUsername(
        card("w0:p1", "done", {
          workspaceLabel: "w0",
          tabLabel: "w0:t0",
          paneLabel: "w0:p1",
        }),
      ),
    ).toBe("Codex");
    expect(
      fleetDiscordUsername(
        card("w0:p1", "done", { paneLabel: undefined, sessionName: undefined }),
      ),
    ).toBe("Example project · Main · Codex");
    expect(
      Array.from(
        fleetDiscordUsername(
          card("w0:p1", "done", {
            workspaceLabel: "Project ".repeat(20),
            tabLabel: "Long tab",
            paneLabel: "Long pane",
          }),
        ),
      ),
    ).toHaveLength(80);
  });

  test("maps actionable states onto configured status avatar profiles", () => {
    expect(fleetDiscordAvatar("done")).toBe("success");
    expect(fleetDiscordAvatar("blocked")).toBe("needs-input");
  });

  test("uses the default template unless an opaque custom selector is configured", () => {
    const alert = buildFleetDiscordAlert(
      "fleet.example.com",
      { id: "cluster-a", name: "Cluster A" },
      card("w0:p1", "blocked"),
    );
    const defaults = pingmeArguments(enabledConfig, alert);
    expect(defaults).not.toContain("--template");
    expect(defaults.slice(0, 5)).toEqual(["send", "--channel", "test", "--avatar", "needs-input"]);
    expect(defaults.slice(5, 7)).toEqual(["--username", "Example project · Main · Agent pane"]);
    expect(defaults.slice(7, 9)).toEqual(["--host", "Cluster A"]);
    expect(defaults).toContain("status=blocked");
    expect(defaults).toContain("host=Cluster A");
    expect(defaults).toContain("host_id=cluster-a");
    expect(defaults).toContain(`pane_url=${alert.paneUrl}`);
    expect(defaults.at(-2)).toBe("--");
    expect(defaults.at(-1)).toBe(alert.message);
    expect(alert.message).toBe(`[Open Pane in Fleet](${alert.paneUrl})`);

    const template = "/opt/example/templates/fleet alert.md";
    const custom = pingmeArguments({ ...enabledConfig, template }, alert);
    expect(custom.slice(custom.indexOf("--template"), custom.indexOf("--template") + 2)).toEqual(["--template", template]);
    expect(custom.slice(custom.indexOf("--host"), custom.indexOf("--host") + 2)).toEqual(["--host", "Cluster A"]);
    expect(custom.slice(custom.indexOf("--username"), custom.indexOf("--username") + 2)).toEqual([
      "--username",
      "Example project · Main · Agent pane",
    ]);
  });

  test("falls back to the bounded inventory id for runtime Host metadata", () => {
    const alert = buildFleetDiscordAlert(
      "fleet.example.com",
      { id: "cluster-a", name: " \n " },
      card("w0:p1", "done"),
    );

    expect(alert.host).toBe("cluster-a");
    expect(pingmeArguments(enabledConfig, alert).slice(7, 9)).toEqual(["--host", "cluster-a"]);
  });

  test("maps Agent, readable Space, and readable Tab into default-template footer metadata", async () => {
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
    expect(calls[0]?.args).toContain("--host");
    expect(calls[0]?.args).toContain("Cluster A");
    expect(calls[0]?.env).toMatchObject({
      PATH: "/synthetic/bin",
      PINGME_AGENT_NAME: "Codex",
      PINGME_PROJECT_NAME: "Example project",
      PINGME_SESSION_NAME: "Main",
      PINGME_SESSION_ID: "",
      CLAUDE_CODE_SESSION_ID: "",
      CODEX_THREAD_ID: "",
    });
    expect(calls[0]?.args).toContain("success");
  });

  test("uses generic Space metadata and omits an internal-id-only Tab title", async () => {
    const calls: Array<{ args: readonly string[]; env: NodeJS.ProcessEnv }> = [];
    const run: PingmeCommandRunner = async (_executable, args, env) => {
      calls.push({ args, env });
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
      PINGME_PROJECT_NAME: "Fleet",
      PINGME_SESSION_NAME: "",
    });
    expect(calls[0]?.args).toContain("needs-input");
    expect(alert.message).toBe(`[Open Pane in Fleet](${alert.paneUrl})`);
    expect(alert.message).not.toContain("needs you");
    expect(alert.message).not.toContain("Main");
  });

  test("bounds missing-executable and timeout failures without exposing child output", async () => {
    expect(PINGME_COMMAND_TIMEOUT_MS).toBe(120_000);

    try {
      await runPingmeCommand("/synthetic/missing/pingme", [], {}, 100);
      throw new Error("missing executable unexpectedly succeeded");
    } catch (error) {
      expect(error).toBeInstanceOf(PingmeCommandFailure);
      expect((error as PingmeCommandFailure).kind).toBe("unavailable");
      expect((error as Error).message).toBe("pingme executable is unavailable");
    }

    try {
      await runPingmeCommand(process.execPath, ["-e", "await Bun.sleep(1000)"], process.env, 10);
      throw new Error("timed command unexpectedly succeeded");
    } catch (error) {
      expect(error).toBeInstanceOf(PingmeCommandFailure);
      expect((error as PingmeCommandFailure).kind).toBe("timeout");
      expect((error as Error).message).toBe("pingme timed out");
    }

    try {
      await runPingmeCommand(process.execPath, ["-e", "process.exit(7)"], process.env, 100);
      throw new Error("failed command unexpectedly succeeded");
    } catch (error) {
      expect(error).toBeInstanceOf(PingmeCommandFailure);
      expect((error as PingmeCommandFailure).kind).toBe("exit");
      expect((error as Error).message).toContain("(7)");
    }
  });
});

describe("Fleet Discord transition ledger", () => {
  test("reads History once only after ten-second confirmation and then sends reply plus link", async () => {
    const sender = new RecordingSender();
    const history = new RecordingHistoryReader(async () => "The requested change is complete.");
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender, { history });

    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    notifier.observe(
      fleet([card("w0:p1", "done", { lastActiveAt: 100, observedAt: 100 })], { generatedAt: 100 }),
    );
    notifier.observe(
      fleet([card("w0:p1", "done", { lastActiveAt: 100, observedAt: 10_099 })], { generatedAt: 10_099 }),
    );
    expect(history.calls).toEqual([]);
    expect(sender.alerts).toEqual([]);

    notifier.observe(
      fleet([card("w0:p1", "done", { lastActiveAt: 100, observedAt: 10_100 })], { generatedAt: 10_100 }),
    );
    await notifier.flush();

    expect(history.calls).toEqual([{ nodeId: "cluster-a", paneId: "w0:p1", session: "default" }]);
    expect(sender.alerts).toHaveLength(1);
    expect(sender.alerts[0]?.message).toBe(
      `The requested change is complete.\n[Open Pane in Fleet](${sender.alerts[0]?.paneUrl})`,
    );

    notifier.observe(
      fleet([card("w0:p1", "done", { lastActiveAt: 900, observedAt: 20_000 })], { generatedAt: 20_000 }),
    );
    await notifier.flush();
    expect(history.calls).toHaveLength(1);
    expect(sender.alerts).toHaveLength(1);
  });

  test("does not read History when an actionable candidate is handled before confirmation", async () => {
    const sender = new RecordingSender();
    const history = new RecordingHistoryReader(async () => "must not be read");
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender, { history });

    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    notifier.observe(fleet([card("w0:p1", "blocked")], { generatedAt: 100 }));
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 5_000 }));
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 10_100 }));
    await notifier.flush();

    expect(history.calls).toEqual([]);
    expect(sender.alerts).toEqual([]);
  });

  test("keeps the exact link-only body when History is unavailable", async () => {
    const sender = new RecordingSender();
    const history = new RecordingHistoryReader(async () => null);
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender, { history });

    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    notifier.observe(fleet([card("w0:p1", "blocked")], { generatedAt: 100 }));
    notifier.observe(fleet([card("w0:p1", "blocked")], { generatedAt: 10_100 }));
    await notifier.flush();

    expect(history.calls).toHaveLength(1);
    expect(sender.alerts[0]?.agentReply).toBeUndefined();
    expect(sender.alerts[0]?.message).toBe(
      `[Open Pane in Fleet](${sender.alerts[0]?.paneUrl})`,
    );
  });

  test("History failure is not retried or exposed and still delivers the link-only alert", async () => {
    const warnings: string[] = [];
    const sender = new RecordingSender();
    const history = new RecordingHistoryReader(async () => {
      throw new Error("private transcript fragment");
    });
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender, {
      history,
      warn: (message) => warnings.push(message),
    });

    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 100 })], { generatedAt: 100 }));
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 100 })], { generatedAt: 10_100 }));
    await notifier.flush();

    expect(history.calls).toHaveLength(1);
    expect(sender.alerts).toHaveLength(1);
    expect(sender.alerts[0]?.message).toBe(`[Open Pane in Fleet](${sender.alerts[0]?.paneUrl})`);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("using link-only alert");
    expect(warnings[0]).not.toContain("private transcript fragment");
  });

  test("serializes History resolution and delivery for simultaneous confirmations", async () => {
    let active = 0;
    let maxActive = 0;
    const sender = new RecordingSender();
    const history = new RecordingHistoryReader(async (_nodeId, agent) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Bun.sleep(1);
      active -= 1;
      return `Reply for ${agent.paneId}`;
    });
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender, { history });
    const baseline = [card("w0:p1", "working"), card("w0:p2", "working")];
    const actionable = [
      card("w0:p1", "done", { lastActiveAt: 100 }),
      card("w0:p2", "blocked", { lastActiveAt: 100 }),
    ];

    notifier.observe(fleet(baseline, { generatedAt: 0 }));
    notifier.observe(fleet(actionable, { generatedAt: 100 }));
    notifier.observe(fleet(actionable, { generatedAt: 10_100 }));
    await notifier.flush();

    expect(history.calls).toHaveLength(2);
    expect(sender.alerts).toHaveLength(2);
    expect(maxActive).toBe(1);
  });

  test("silently baselines and confirms each actionable group only after ten seconds", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    expect(notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }))).toBeNull();
    expect(
      notifier.observe(
        fleet([card("w0:p1", "done", { lastActiveAt: 200, observedAt: 200 })], { generatedAt: 200 }),
      ),
    ).toBe(200 + FLEET_DISCORD_CONFIRMATION_MS);
    expect(
      notifier.observe(
        fleet([card("w0:p1", "done", { lastActiveAt: 400, observedAt: 10_199 })], { generatedAt: 10_199 }),
      ),
    ).toBe(10_200);
    expect(sender.alerts).toEqual([]);
    expect(
      notifier.observe(
        fleet([card("w0:p1", "done", { lastActiveAt: 400, observedAt: 10_200 })], { generatedAt: 10_200 }),
      ),
    ).toBeNull();
    notifier.observe(
      fleet([card("w0:p1", "done", { lastActiveAt: 800, observedAt: 11_000 })], { generatedAt: 11_000 }),
    );
    expect(
      notifier.observe(
        fleet([card("w0:p1", "blocked", { lastActiveAt: 12_000, observedAt: 12_000 })], { generatedAt: 12_000 }),
      ),
    ).toBe(22_000);
    notifier.observe(
      fleet([card("w0:p1", "blocked", { lastActiveAt: 12_000, observedAt: 22_000 })], { generatedAt: 22_000 }),
    );
    await notifier.flush();

    expect(sender.alerts.map((alert) => [alert.status, alert.observedAt])).toEqual([
      ["done", 10_200],
      ["blocked", 22_000],
    ]);
    expect(sender.alerts.at(-1)?.message).toBe(
      `[Open Pane in Fleet](${sender.alerts.at(-1)?.paneUrl})`,
    );
  });

  test("keeps Ready through Recent and confirms at the original deadline", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    expect(
      notifier.observe(
        fleet([card("w0:p1", "done", { lastActiveAt: 100, lastSeenAt: 10 })], { generatedAt: 100 }),
      ),
    ).toBe(10_100);
    expect(
      notifier.observe(
        fleet([card("w0:p1", "done", { lastActiveAt: 100, lastSeenAt: 500 })], { generatedAt: 5_000 }),
      ),
    ).toBe(10_100);
    notifier.observe(
      fleet(
        [card("w0:p1", "done", { lastActiveAt: 100, lastSeenAt: 500, observedAt: 10_100 })],
        { generatedAt: 10_100 },
      ),
    );
    notifier.observe(
      fleet([card("w0:p1", "done", { lastActiveAt: 100, lastSeenAt: 500 })], { generatedAt: 20_000 }),
    );
    await notifier.flush();

    expect(sender.alerts.map((alert) => [alert.status, alert.observedAt])).toEqual([["done", 10_100]]);
  });

  test("keeps Needs You through idle and unknown states", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    expect(notifier.observe(fleet([card("w0:p1", "blocked")], { generatedAt: 100 }))).toBe(10_100);
    expect(notifier.observe(fleet([card("w0:p1", "idle")], { generatedAt: 5_000 }))).toBe(10_100);
    notifier.observe(
      fleet([card("w0:p1", "unknown", { observedAt: 10_100 })], { generatedAt: 10_100 }),
    );
    await notifier.flush();

    expect(sender.alerts.map((alert) => [alert.status, alert.observedAt])).toEqual([["blocked", 10_100]]);
  });

  test("updates the retained attention group without resetting its deadline", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    expect(
      notifier.observe(
        fleet([card("w0:p1", "done", { lastActiveAt: 100, lastSeenAt: 10 })], { generatedAt: 100 }),
      ),
    ).toBe(10_100);
    expect(notifier.observe(fleet([card("w0:p1", "blocked")], { generatedAt: 5_000 }))).toBe(10_100);
    notifier.observe(
      fleet([card("w0:p1", "done", { lastActiveAt: 100, lastSeenAt: 500 })], { generatedAt: 10_100 }),
    );
    await notifier.flush();

    expect(sender.alerts.map((alert) => alert.status)).toEqual(["blocked"]);
    expect(fleetDiscordAvatar(sender.alerts[0]!.status)).toBe("needs-input");
  });

  test("cancels Needs You when work resumes before confirmation", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    expect(notifier.observe(fleet([card("w0:p1", "blocked")], { generatedAt: 100 }))).toBe(10_100);
    expect(notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 5_000 }))).toBeNull();
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 10_100 }));
    await notifier.flush();
    expect(sender.alerts).toEqual([]);
  });

  test("suspends a candidate offline without pinning refresh and confirms it on recovery", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    expect(notifier.observe(fleet([card("w0:p1", "blocked")], { generatedAt: 100 }))).toBe(10_100);
    expect(notifier.observe(
      fleet([card("w0:p1", "blocked", { reachable: false, observedAt: 100 })], {
        generatedAt: 5_000,
        health: "transport-down",
        sessionReachable: false,
      }),
    )).toBeNull();
    expect(notifier.observe(
      fleet([card("w0:p1", "blocked", { reachable: false, observedAt: 100 })], {
        generatedAt: 20_000,
        health: "transport-down",
        sessionReachable: false,
      }),
    )).toBeNull();
    notifier.observe(
      fleet([card("w0:p1", "idle", { observedAt: 30_000, lastActiveAt: 20_000 })], {
        generatedAt: 30_000,
      }),
    );
    await notifier.flush();

    expect(sender.alerts.map((alert) => [alert.status, alert.observedAt])).toEqual([["blocked", 30_000]]);
    notifier.observe(fleet([card("w0:p1", "idle")], { generatedAt: 40_000 }));
    await notifier.flush();
    expect(sender.alerts).toHaveLength(1);
  });

  test("keeps the original remaining deadline when a candidate recovers before it is due", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    expect(notifier.observe(fleet([card("w0:p1", "done")], { generatedAt: 100 }))).toBe(10_100);
    expect(notifier.observe(
      fleet([card("w0:p1", "done", { reachable: false })], {
        generatedAt: 5_000,
        sessionReachable: false,
      }),
    )).toBeNull();
    expect(notifier.observe(fleet([card("w0:p1", "done")], { generatedAt: 6_000 }))).toBe(10_100);
    notifier.observe(fleet([card("w0:p1", "done", { observedAt: 10_100 })], { generatedAt: 10_100 }));
    await notifier.flush();
    expect(sender.alerts).toHaveLength(1);
  });

  test("cancels a suspended candidate when recovery authoritatively resumes work", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    notifier.observe(fleet([card("w0:p1", "blocked")], { generatedAt: 100 }));
    notifier.observe(
      fleet([card("w0:p1", "blocked", { reachable: false })], {
        generatedAt: 5_000,
        sessionReachable: false,
      }),
    );
    expect(notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 20_000 }))).toBeNull();
    await notifier.flush();
    expect(sender.alerts).toEqual([]);
  });

  test("does not duplicate an already delivered episode across repeated offline recovery", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    notifier.observe(fleet([card("w0:p1", "done")], { generatedAt: 100 }));
    notifier.observe(fleet([card("w0:p1", "done")], { generatedAt: 10_100 }));
    await notifier.flush();
    expect(sender.alerts).toHaveLength(1);

    for (const generatedAt of [20_000, 30_000]) {
      expect(notifier.observe(
        fleet([card("w0:p1", "done", { reachable: false })], {
          generatedAt,
          health: "transport-down",
          sessionReachable: false,
        }),
      )).toBeNull();
    }
    expect(notifier.observe(fleet([card("w0:p1", "done")], { generatedAt: 40_000 }))).toBeNull();
    await notifier.flush();
    expect(sender.alerts).toHaveLength(1);
  });

  test("prunes candidates and silently re-baselines removed or identity-replaced Panes", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 100 })], { generatedAt: 100 }));
    expect(notifier.observe(fleet([], { generatedAt: 5_000 }))).toBeNull();
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 300 })], { generatedAt: 20_000 }));
    notifier.observe(
      fleet([card("w0:p1", "blocked", { agent: "claude", lastActiveAt: 400 })], { generatedAt: 30_000 }),
    );
    notifier.observe(
      fleet([card("w0:p1", "blocked", { agent: "claude", lastActiveAt: 400 })], { generatedAt: 50_000 }),
    );
    await notifier.flush();

    expect(sender.alerts).toEqual([]);
  });

  test("returns the earliest candidate deadline and never resets it for newer same-group activity", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working"), card("w0:p2", "working")], { generatedAt: 0 }));
    expect(
      notifier.observe(
        fleet(
          [card("w0:p1", "done", { lastActiveAt: 100 }), card("w0:p2", "working")],
          { generatedAt: 100 },
        ),
      ),
    ).toBe(10_100);
    expect(
      notifier.observe(
        fleet(
          [card("w0:p1", "done", { lastActiveAt: 500 }), card("w0:p2", "blocked")],
          { generatedAt: 200 },
        ),
      ),
    ).toBe(10_100);
    expect(
      notifier.observe(
        fleet(
          [card("w0:p1", "done", { lastActiveAt: 500 }), card("w0:p2", "blocked")],
          { generatedAt: 10_100 },
        ),
      ),
    ).toBe(10_200);
    notifier.observe(
      fleet(
        [card("w0:p1", "done", { lastActiveAt: 900 }), card("w0:p2", "blocked")],
        { generatedAt: 10_200 },
      ),
    );
    await notifier.flush();
    expect(sender.alerts.map((alert) => alert.paneId)).toEqual(["w0:p1", "w0:p2"]);
  });

  test("does not retry failed events and bounds simultaneous delivery", async () => {
    const warnings: string[] = [];
    const sender = new RecordingSender(new Error("synthetic failure"));
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender, {
      maxPending: 1,
      warn: (message) => warnings.push(message),
    });
    notifier.observe(fleet([card("w0:p1", "working"), card("w0:p2", "working")], { generatedAt: 0 }));
    notifier.observe(
      fleet([
        card("w0:p1", "done", { lastActiveAt: 200 }),
        card("w0:p2", "blocked", { lastActiveAt: 200 }),
      ], { generatedAt: 100 }),
    );
    notifier.observe(
      fleet([
        card("w0:p1", "done", { lastActiveAt: 200 }),
        card("w0:p2", "blocked", { lastActiveAt: 200 }),
      ], { generatedAt: 10_100 }),
    );
    await notifier.flush();

    expect(sender.alerts).toHaveLength(1);
    expect(warnings.filter((message) => message.includes("queue is full"))).toHaveLength(1);
    expect(warnings.filter((message) => message.includes("could not deliver"))).toHaveLength(1);
    expect(warnings.join("\n")).not.toContain("synthetic failure");
  });

  test("logs only the closed pingme failure classification", async () => {
    const warnings: string[] = [];
    const sender = new RecordingSender(new PingmeCommandFailure("timeout"));
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender, {
      warn: (message) => warnings.push(message),
    });
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    notifier.observe(fleet([card("w0:p1", "done")], { generatedAt: 100 }));
    notifier.observe(fleet([card("w0:p1", "done")], { generatedAt: 10_100 }));
    await notifier.flush();

    expect(warnings).toEqual([
      "[gateway/discord] could not deliver cluster-a/w0:p1 (pingme timed out); event will not be retried",
    ]);
  });

  test("preserves state for an unavailable session but prunes a session removed by a healthy node", async () => {
    const sender = new RecordingSender();
    const notifier = new FleetDiscordNotifier("fleet.example.com", sender);
    notifier.observe(fleet([card("w0:p1", "working")], { generatedAt: 0 }));
    notifier.observe(
      fleet([card("w0:p1", "working", { reachable: false })], {
        generatedAt: 100,
        sessionReachable: false,
      }),
    );
    notifier.observe(fleet([], { generatedAt: 200, sessionPresent: false }));
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 400 })], { generatedAt: 300 }));
    notifier.observe(fleet([card("w0:p1", "done", { lastActiveAt: 400 })], { generatedAt: 20_000 }));
    await notifier.flush();

    expect(sender.alerts).toEqual([]);
  });
});
