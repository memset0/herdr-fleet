import { migrateLegacyFavorites, paneRosterFrom, pinnedAgents, toRosterEntry, togglePanePin } from "./fleet-roster";
import { __resetPins, currentPins, pinMatcher, setPinned } from "@/lib/pins";
import type { AgentView, ServerSummary } from "@/lib/types";

/**
 * The mapping from Collie's rows into roster entries, and specifically the one fact it resolves
 * rather than copies: the machine's name.
 */

function pane(overrides: Partial<AgentView> = {}): AgentView {
  return {
    paneId: "w1:p1",
    workspaceId: "w1",
    workspaceLabel: "webapp",
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

const PACK: readonly ServerSummary[] = [server("lead", "lodge", true), server("attic", "attic", false)];

describe("naming the machine a pane is on", () => {
  it("resolves the lead's id to the name every other surface shows", () => {
    // THE BUG THIS FIXES: a pane on the lead is tagged `host: "lead"`, and the switcher rendered that
    // id while the navigation rail rendered `lodge`. One machine, two names, on one screen.
    const entry = toRosterEntry(pane({ host: "lead" }), PACK);
    expect(entry.host).toBe("lead");
    expect(entry.hostLabel).toBe("lodge");
  });

  it("keeps the id for identity and the name for the eye", () => {
    // Opening a pane and telling two panes apart are the id's job — it is unique per machine — and
    // the name is never used for either.
    const entry = toRosterEntry(pane({ host: "attic" }), PACK);
    expect(entry.host).toBe("attic");
    expect(entry.hostLabel).toBe("attic");
  });

  it("names nothing when there is only one machine", () => {
    // Naming the only machine on every row says nothing, and it is the same predicate the rails use
    // to decide a host is worth distinguishing at all.
    const solo: readonly ServerSummary[] = [server("lead", "lodge", true)];
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
    expect(roster.entries[0]?.hostLabel).toBe("lodge");
  });
});

describe("mapping time ordering into the shared roster", () => {
  it("carries both timestamps, including zero, and leaves absent values absent", () => {
    expect(toRosterEntry(pane({ lastSeenAt: 0, lastActiveAt: 8 }))).toMatchObject({ lastSeenAt: 0, lastActiveAt: 8 });
    expect(toRosterEntry(pane()).lastSeenAt).toBeUndefined();
    expect(toRosterEntry(pane()).lastActiveAt).toBeUndefined();
  });

  it("sorts each timed bucket by the right clock after removing pins", () => {
    const olderSeen = pane({ paneId: "older-seen", lastSeenAt: 1, lastActiveAt: 90 });
    const newerSeen = pane({ paneId: "newer-seen", lastSeenAt: 9, lastActiveAt: 10 });
    const pinned = pane({ paneId: "pinned", lastSeenAt: 0, lastActiveAt: 0 });
    const olderActive = pane({ paneId: "older-active", lastSeenAt: 90, lastActiveAt: 1 });
    const newerActive = pane({ paneId: "newer-active", lastSeenAt: 10, lastActiveAt: 9 });
    const roster = paneRosterFrom([
      { key: "ready", label: "Ready", dot: "", agents: [olderActive, newerActive] },
      { key: "working", label: "Working", dot: "", agents: [
        pane({ paneId: "working-old", lastSeenAt: 90, lastActiveAt: 1 }),
        pane({ paneId: "working-new", lastSeenAt: 10, lastActiveAt: 9 }),
      ] },
      { key: "recent", label: "Recent", dot: "", agents: [olderSeen, pinned, newerSeen] },
    ], [], undefined, [pinned]);
    expect(roster.sections.map((section) => [section.key, section.entries.map((entry) => entry.paneId)])).toEqual([
      ["pinned", ["pinned"]],
      ["ready", ["newer-active", "older-active"]],
      ["working", ["working-new", "working-old"]],
      ["recent", ["newer-seen", "older-seen"]],
    ]);
  });
});

describe("the star is Collie's pin", () => {
  const LEGACY = "herdr-fleet:agent-favorites:v1";
  beforeEach(() => {
    localStorage.clear();
    __resetPins();
  });

  it("toggles the pane's pin in Collie's own store, both ways", () => {
    const a = pane();
    togglePanePin(a, [a]);
    expect(pinMatcher(currentPins())(a)).toBe(true);
    togglePanePin(a, [a]);
    expect(currentPins()).toHaveLength(0);
  });

  it("lists pinned Agents in Collie's place order, never by status", () => {
    const first = pane({ paneId: "w1:p1", status: "idle" });
    const second = pane({ paneId: "w2:p1", workspaceId: "w2", workspaceLabel: "api", workspaceNumber: 2, status: "blocked" });
    setPinned(second, true, [first, second]);
    setPinned(first, true, [first, second]);
    expect(pinnedAgents([second, first], currentPins()).map((p) => p.paneId)).toEqual(["w1:p1", "w2:p1"]);
    expect(pinnedAgents([first, second], [])).toEqual([]);
  });

  it("puts the pinned panes first in the roster, each listed once", () => {
    const a = pane({ paneId: "w1:p1" });
    const b = pane({ paneId: "w1:p2", status: "working" });
    const roster = paneRosterFrom([{ key: "working", label: "Working", dot: "", agents: [a, b] }], [], undefined, [b]);
    expect(roster.entries.map((e) => e.paneId)).toEqual(["w1:p2", "w1:p1"]);
    expect(roster.sections.map((s) => s.key)).toEqual(["pinned", "working"]);
  });

  it("migrates a stored favourite whose pane is live, drops the rest, and deletes the record once", () => {
    const live = pane({ host: "lead", session: "main", paneId: "w1:p1" });
    localStorage.setItem(
      LEGACY,
      JSON.stringify({ version: 1, favorites: [["lead", "main", "w1:p1", "claude"], ["lead", "main", "w9:p9", "codex"]] }),
    );
    expect(migrateLegacyFavorites([live], localStorage)).toBe(1);
    expect(pinMatcher(currentPins())(live)).toBe(true);
    expect(currentPins()).toHaveLength(1);
    expect(localStorage.getItem(LEGACY)).toBeNull();
    // Once: with the record gone, a second run pins nothing and unpins nothing.
    expect(migrateLegacyFavorites([live], localStorage)).toBe(0);
    expect(currentPins()).toHaveLength(1);
  });

  it("deletes an unreadable record without pinning anything", () => {
    localStorage.setItem(LEGACY, "not json");
    expect(migrateLegacyFavorites([pane()], localStorage)).toBe(0);
    expect(currentPins()).toHaveLength(0);
    expect(localStorage.getItem(LEGACY)).toBeNull();
  });
});
