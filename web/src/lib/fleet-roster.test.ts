import { toRosterEntry, paneRosterFrom } from "./fleet-roster";
import type { AgentView, ServerSummary } from "@/lib/types";

/**
 * The mapping from Collie's rows into roster entries, and specifically the one fact it resolves
 * rather than copies: the machine's name.
 */

function pane(overrides: Partial<AgentView> = {}): AgentView {
  return {
    paneId: "w1:p1",
    workspaceId: "w1",
    workspaceLabel: "mem.conf",
    workspaceNumber: 1,
    tabId: "w1:t1",
    agent: "claude",
    status: "idle",
    cwd: "/tmp",
    focused: false,
    ...overrides,
  };
}

/** The shape the live snapshot actually has: the lead's id is `lead` and its name is the machine. */
function server(id: string, name: string, isLead: boolean): ServerSummary {
  return { id, name, isLead, reachable: true, protocol: "ok", lastSeenAt: 0 };
}

const PACK: readonly ServerSummary[] = [server("lead", "vultr", true), server("nvl72", "nvl72", false)];

describe("naming the machine a pane is on", () => {
  it("resolves the lead's id to the name every other surface shows", () => {
    // THE BUG THIS FIXES: a pane on the lead is tagged `host: "lead"`, and the switcher rendered that
    // id while the navigation rail rendered `vultr`. One machine, two names, on one screen.
    const entry = toRosterEntry(pane({ host: "lead" }), PACK);
    expect(entry.host).toBe("lead");
    expect(entry.hostLabel).toBe("vultr");
  });

  it("keeps the id for identity and the name for the eye", () => {
    // Opening a pane and telling two panes apart are the id's job — it is unique per machine — and
    // the name is never used for either.
    const entry = toRosterEntry(pane({ host: "nvl72" }), PACK);
    expect(entry.host).toBe("nvl72");
    expect(entry.hostLabel).toBe("nvl72");
  });

  it("names nothing when there is only one machine", () => {
    // Naming the only machine on every row says nothing, and it is the same predicate the rails use
    // to decide a host is worth distinguishing at all.
    const solo: readonly ServerSummary[] = [server("lead", "vultr", true)];
    expect(toRosterEntry(pane({ host: "lead" }), solo).hostLabel).toBeUndefined();
    expect(toRosterEntry(pane({ host: "lead" })).hostLabel).toBeUndefined();
  });

  it("renders a machine the snapshot no longer lists as itself", () => {
    // A departed member must read as itself rather than be silently relabelled or dropped.
    expect(toRosterEntry(pane({ host: "gone" }), PACK).hostLabel).toBe("gone");
  });

  it("carries the name through the roster the switcher actually reads", () => {
    const roster = paneRosterFrom(
      [{ key: "needs", label: "Needs you", dot: "", agents: [pane({ host: "lead" })] }],
      [],
      PACK,
    );
    expect(roster.entries[0]?.hostLabel).toBe("vultr");
  });
});
