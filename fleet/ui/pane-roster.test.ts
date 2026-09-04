import { describe, expect, test } from "bun:test";

import {
  agentSections,
  derivePaneRoster,
  rosterEntryKey,
  rosterOrdinal,
  stepRoster,
  type RosterEntry,
} from "./pane-roster.ts";

function agent(paneId: string, extra: Partial<RosterEntry> = {}): RosterEntry {
  return { paneId, kind: "agent", label: paneId, favorite: false, ...extra };
}

function shell(paneId: string, lastSeenAt: number, favorite = false): RosterEntry {
  return { paneId, kind: "shell", label: paneId, favorite, lastSeenAt };
}

describe("deriving the roster", () => {
  test("sections keep triage's order and empty ones are dropped", () => {
    const roster = derivePaneRoster({
      triaged: [
        { key: "needs", entries: [agent("a")] },
        { key: "ready", entries: [] },
        { key: "working", entries: [agent("b")] },
        { key: "recent", entries: [] },
      ],
      shellPanes: [],
    });
    expect(roster.sections.map((section) => section.key)).toEqual(["needs", "working"]);
  });

  test("the shell section comes last and only when there are shell Panes", () => {
    const withoutShell = derivePaneRoster({
      triaged: [{ key: "needs", entries: [agent("a")] }],
      shellPanes: [],
    });
    expect(withoutShell.sections.map((s) => s.key)).toEqual(["needs"]);

    const withShell = derivePaneRoster({
      triaged: [{ key: "needs", entries: [agent("a")] }],
      shellPanes: [shell("s1", 10)],
    });
    expect(withShell.sections.map((s) => s.key)).toEqual(["needs", "shell"]);
  });

  test("favourites come first inside every section, including shell", () => {
    const roster = derivePaneRoster({
      triaged: [
        { key: "needs", entries: [agent("a"), agent("b", { favorite: true }), agent("c")] },
      ],
      shellPanes: [shell("s1", 30), shell("s2", 20, true), shell("s3", 10)],
    });
    expect(roster.sections[0]?.entries.map((e) => e.paneId)).toEqual(["b", "a", "c"]);
    expect(roster.sections[1]?.entries.map((e) => e.paneId)).toEqual(["s2", "s1", "s3"]);
  });

  test("the non-favourite half keeps the order it arrived in", () => {
    const roster = derivePaneRoster({
      triaged: [{ key: "recent", entries: [agent("x"), agent("y"), agent("z")] }],
      shellPanes: [],
    });
    expect(roster.entries.map((e) => e.paneId)).toEqual(["x", "y", "z"]);
  });

  test("shell Panes order by last seen, most recent first", () => {
    const roster = derivePaneRoster({
      triaged: [],
      shellPanes: [shell("old", 1), shell("new", 9), shell("mid", 5)],
    });
    expect(roster.entries.map((e) => e.paneId)).toEqual(["new", "mid", "old"]);
  });

  test("the flattening is exactly the sections, concatenated", () => {
    const roster = derivePaneRoster({
      triaged: [
        { key: "needs", entries: [agent("a")] },
        { key: "working", entries: [agent("b"), agent("c")] },
      ],
      shellPanes: [shell("s", 1)],
    });
    expect(roster.entries).toEqual(roster.sections.flatMap((section) => [...section.entries]));
    expect(roster.entries.map((e) => e.paneId)).toEqual(["a", "b", "c", "s"]);
  });

  test("the Agent surface is the roster without its shell section", () => {
    const roster = derivePaneRoster({
      triaged: [{ key: "needs", entries: [agent("a")] }],
      shellPanes: [shell("s", 1)],
    });
    expect(agentSections(roster).map((s) => s.key)).toEqual(["needs"]);
  });
});

describe("identity and stepping", () => {
  test("a key separates host, session and pane unambiguously", () => {
    expect(rosterEntryKey({ host: "a", session: "b", paneId: "p1" })).not.toBe(
      rosterEntryKey({ host: "a b", paneId: "p1" }),
    );
    expect(rosterEntryKey({ paneId: "p1" })).toBe(rosterEntryKey({ host: "", session: "", paneId: "p1" }));
  });

  test("stepping wraps in both directions", () => {
    const first = agent("a");
    const last = agent("c");
    const entries = [first, agent("b"), last];
    expect(stepRoster(entries, rosterEntryKey(last), 1)?.paneId).toBe("a");
    expect(stepRoster(entries, rosterEntryKey(first), -1)?.paneId).toBe("c");
    expect(stepRoster(entries, rosterEntryKey(first), 1)?.paneId).toBe("b");
  });

  test("stepping from somewhere the roster does not list enters from the matching end", () => {
    const entries = [agent("a"), agent("b")];
    expect(stepRoster(entries, "nowhere", 1)?.paneId).toBe("a");
    expect(stepRoster(entries, "nowhere", -1)?.paneId).toBe("b");
    expect(stepRoster(entries, null, 1)?.paneId).toBe("a");
  });

  test("an empty roster has nowhere to step to", () => {
    expect(stepRoster([], null, 1)).toBeNull();
  });

  test("ordinals are one-based and answer null past the end", () => {
    const entries = [agent("a"), agent("b")];
    expect(rosterOrdinal(entries, 1)?.paneId).toBe("a");
    expect(rosterOrdinal(entries, 2)?.paneId).toBe("b");
    expect(rosterOrdinal(entries, 3)).toBeNull();
    expect(rosterOrdinal(entries, 0)).toBeNull();
    expect(rosterOrdinal(entries, 1.5)).toBeNull();
  });
});
