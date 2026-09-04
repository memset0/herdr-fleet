import { describe, expect, test } from "bun:test";

import {
  deriveNavigationTree,
  hostCollapseId,
  hostOpenId,
  MAX_NAVIGATION_PANES,
  spaceDisclosureId,
  tabDisclosureId,
  type NavigationHostInput,
  type NavigationTree,
} from "./model";

/**
 * The single-host call this suite was written against, now one member of a pack of one.
 *
 * Every assertion below is unchanged: that is the proof that a solo install renders exactly as it
 * did, keys, disclosure identities and order included.
 */
function singleHost(input: NavigationHostInput & { selectedPaneId?: string }): NavigationTree {
  const { selectedPaneId, ...host } = input;
  return deriveNavigationTree({ hosts: [host], selectedPaneId });
}

const HOST = { hostId: "", hostLabel: "This host" };

describe("native navigation hierarchy", () => {
  test("puts every Space under one Host row that is open until it is closed", () => {
    const tree = singleHost({
      hostId: "peer-a",
      hostLabel: "peer-a",
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [],
      agents: [],
      shellPanes: [],
    });

    expect(tree.rows).toHaveLength(1);
    expect(tree.rows[0]).toMatchObject({
      label: "peer-a",
      // A Host row is a MACHINE, and it carries the id the component looks its tint and its health
      // up with — the reading that replaced the disclosure arrow in that column.
      icon: "host",
      hostId: "peer-a",
      disclosureId: hostCollapseId("peer-a"),
      disclosureInverted: true,
    });
    expect(tree.rows[0]?.target).toBeUndefined();
    expect(tree.rows[0]?.children.map((row) => row.label)).toEqual(["One"]);
  });

  test("preserves Space, Tab, Agent, and shell order while selecting ancestry", () => {
    const tree = singleHost({
      ...HOST,
      workspaces: [
        { workspaceId: "w2", label: "Two" },
        { workspaceId: "w1", label: "One" },
      ],
      tabs: [
        { workspaceId: "w2", tabId: "t2", label: "Second" },
        { workspaceId: "w2", tabId: "t1", label: "First" },
      ],
      agents: [
        { workspaceId: "w2", tabId: "t2", paneId: "p2", label: "Claude", agent: "claude" },
        { workspaceId: "w2", tabId: "t1", paneId: "p1", label: "Codex", agent: "codex" },
      ],
      shellPanes: [
        {
          workspaceId: "w2",
          tabId: "t2",
          paneId: "p3",
          label: "Shell",
          agent: "shell",
          kind: "shell",
        },
      ],
      selectedPaneId: "p3",
    });

    const rows = tree.rows[0]?.children ?? [];
    expect(rows.map((row) => row.label)).toEqual(["Two", "One"]);
    // Two tabs survive, so the Tab level stays; `t2` groups two Panes and `t1` groups one, which
    // means the second Tab is replaced by its own Pane.
    // `t1` holds one Pane, so its row is the elided one and takes the Tab's name.
    expect(rows[0]?.children.map((row) => row.label)).toEqual(["Second", "First"]);
    expect(rows[0]?.children[0]?.children.map((row) => row.label)).toEqual(["Claude", "Shell"]);
    // A Pane inside a Tab that SURVIVES keeps its own display label: there the terminal title is
    // what tells two siblings apart.
    expect(tree.selection).toEqual({
      paneId: "p3",
      ancestors: [spaceDisclosureId("w2"), tabDisclosureId("w2", "t2")],
    });
  });

  test("elides a lone Tab, keeps the Pane's icon, and names the row for the operator", () => {
    // No Pane here was named by a person, so the Tab's name is the only name in the branch —
    // `label` is a terminal title, which every sibling on this herd would repeat.
    const unnamed = singleHost({
      ...HOST,
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [{ workspaceId: "w1", tabId: "t1", label: "Rename the tree" }],
      agents: [
        { workspaceId: "w1", tabId: "t1", paneId: "p1", label: "root@host:~/repo", agent: "claude" },
      ],
      shellPanes: [],
      selectedPaneId: "p1",
    });

    const space = unnamed.rows[0]?.children[0];
    expect(space?.icon).toBe("none");
    expect(space?.disclosureId).toBe(spaceDisclosureId("w1"));
    expect(space?.children).toHaveLength(1);
    expect(space?.children[0]).toMatchObject({
      label: "Rename the tree",
      icon: "agent",
      agent: "claude",
      target: { kind: "pane", paneId: "p1" },
      selected: true,
    });
    expect(space?.children[0]?.disclosureId).toBeUndefined();
    expect(unnamed.selection?.ancestors).toEqual([spaceDisclosureId("w1")]);

    // The operator named the Pane, so their name wins over the Tab's.
    const named = singleHost({
      ...HOST,
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [{ workspaceId: "w1", tabId: "t1", label: "Rename the tree" }],
      agents: [
        {
          workspaceId: "w1",
          tabId: "t1",
          paneId: "p1",
          label: "root@host:~/repo",
          ownLabel: "guard work",
          agent: "claude",
        },
      ],
      shellPanes: [],
    });
    expect(named.rows[0]?.children[0]?.children[0]?.label).toBe("guard work");

    // …and a multiplexer's own ordinal is not a name, so the Tab's still wins.
    const numbered = singleHost({
      ...HOST,
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [{ workspaceId: "w1", tabId: "t1", label: "Rename the tree" }],
      agents: [
        {
          workspaceId: "w1",
          tabId: "t1",
          paneId: "p1",
          label: "root@host:~/repo",
          ownLabel: "1",
          agent: "claude",
        },
      ],
      shellPanes: [],
    });
    expect(numbered.rows[0]?.children[0]?.children[0]?.label).toBe("Rename the tree");
  });

  test("keeps a group row and its folder only where more than one child survives", () => {
    const tree = singleHost({
      ...HOST,
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [
        { workspaceId: "w1", tabId: "t1", label: "Pair" },
        { workspaceId: "w1", tabId: "t2", label: "Single" },
      ],
      agents: [
        { workspaceId: "w1", tabId: "t1", paneId: "p1", label: "A", agent: "claude" },
        { workspaceId: "w1", tabId: "t1", paneId: "p2", label: "B", agent: "codex" },
        { workspaceId: "w1", tabId: "t2", paneId: "p3", label: "C", agent: "claude" },
      ],
      shellPanes: [],
    });

    const children = tree.rows[0]?.children[0]?.children ?? [];
    expect(children[0]).toMatchObject({
      label: "Pair",
      icon: "group",
      disclosureId: tabDisclosureId("w1", "t1"),
    });
    expect(children[0]?.target).toBeUndefined();
    // `t2` holds one Pane and nobody named it, so its row takes the Tab's name.
    expect(children[1]).toMatchObject({ label: "Single", icon: "agent" });
    expect(children.filter((row) => row.icon === "group")).toHaveLength(1);
    expect(tree.rows[0]?.children[0]?.icon).toBe("none");
  });

  test("drops orphaned, invalid and empty rows and leaves an empty Space openable", () => {
    const tree = singleHost({
      ...HOST,
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [
        { workspaceId: "missing", tabId: "t0", label: "Orphan" },
        { workspaceId: "w1", tabId: "t1", label: "First" },
      ],
      agents: [
        { workspaceId: "w1", tabId: "missing", paneId: "p0", label: "Orphan", agent: "claude" },
        { workspaceId: "w1", tabId: "t1", paneId: "", label: "Invalid", agent: "claude" },
      ],
      shellPanes: [],
    });

    const space = tree.rows[0]?.children[0];
    expect(tree.rows[0]?.children).toHaveLength(1);
    expect(space?.children).toEqual([]);
    expect(space?.disclosureId).toBeUndefined();
    expect(space?.target).toEqual({ kind: "space", workspaceId: "w1" });
  });

  test("bounds Pane derivation", () => {
    const agents = Array.from({ length: MAX_NAVIGATION_PANES + 4 }, (_, index) => ({
      workspaceId: "w1",
      tabId: "t1",
      paneId: `p${index}`,
      label: `Pane ${index}`,
      agent: "claude",
    }));
    const tree = singleHost({
      ...HOST,
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [{ workspaceId: "w1", tabId: "t1", label: "First" }],
      agents,
      shellPanes: [],
    });
    expect(tree.rows[0]?.children[0]?.children).toHaveLength(MAX_NAVIGATION_PANES);
  });

  test("a pack draws one collapsible Host row per member, in the order the caller fixed", () => {
    const paneOn = (host: string) => ({
      workspaceId: "w1",
      tabId: "t1",
      paneId: `p-${host}`,
      label: `work on ${host}`,
      agent: "claude",
    });
    const tree = deriveNavigationTree({
      hosts: [
        {
          hostId: "lead",
          hostLabel: "north",
          workspaces: [{ workspaceId: "w1", label: "Project" }],
          tabs: [{ workspaceId: "w1", tabId: "t1", label: "Main" }],
          agents: [paneOn("lead")],
          shellPanes: [],
        },
        {
          hostId: "peer-a",
          hostLabel: "attic",
          workspaces: [{ workspaceId: "w1", label: "Project" }],
          tabs: [{ workspaceId: "w1", tabId: "t1", label: "Main" }],
          agents: [paneOn("peer-a")],
          shellPanes: [],
        },
      ],
    });

    expect(tree.rows).toHaveLength(2);
    expect(tree.rows.map((row) => row.label)).toEqual(["north", "attic"]);
    // Each member collapses on its own.
    expect(tree.rows[0]?.disclosureId).toBe(hostCollapseId("lead"));
    expect(tree.rows[1]?.disclosureId).toBe(hostCollapseId("peer-a"));

    // Two members legitimately number their spaces the same way, so neither the keys nor the
    // disclosure identities may collide across them.
    const spaces = tree.rows.map((row) => row.children[0]);
    expect(spaces[0]?.key).not.toBe(spaces[1]?.key);
    expect(spaces[0]?.disclosureId).toBe(spaceDisclosureId("w1", "lead"));
    expect(spaces[1]?.disclosureId).toBe(spaceDisclosureId("w1", "peer-a"));

    // And a row carries the member it belongs to, so activating it opens that member.
    const paneRows = tree.rows.map((row) => row.children[0]?.children[0]);
    expect(paneRows[0]?.target).toEqual({ kind: "pane", paneId: "p-lead", host: "lead" });
    expect(paneRows[1]?.target).toEqual({ kind: "pane", paneId: "p-peer-a", host: "peer-a" });
  });

  test("the per-kind ceilings are spent across the whole pack, not refilled per member", () => {
    const panes = (host: string, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        workspaceId: "w1",
        tabId: "t1",
        paneId: `${host}-p${index}`,
        label: `pane ${index}`,
        agent: "claude",
      }));
    const member = (hostId: string) => ({
      hostId,
      hostLabel: hostId,
      workspaces: [{ workspaceId: "w1", label: "Project" }],
      tabs: [{ workspaceId: "w1", tabId: "t1", label: "Main" }],
      agents: panes(hostId, MAX_NAVIGATION_PANES),
      shellPanes: [],
    });
    const tree = deriveNavigationTree({ hosts: [member("a"), member("b")] });
    const drawn = tree.rows
      .flatMap((row) => row.children)
      .flatMap((space) => space.children)
      .filter((row) => row.target?.kind === "pane").length;
    expect(drawn).toBe(MAX_NAVIGATION_PANES);
  });
  test("a member that is not answering closes by default and still opens by hand", () => {
    const member = (hostId: string, degraded?: boolean) => ({
      hostId,
      hostLabel: hostId,
      degraded,
      workspaces: [{ workspaceId: "w1", label: "Project" }],
      tabs: [{ workspaceId: "w1", tabId: "t1", label: "Main" }],
      agents: [
        { workspaceId: "w1", tabId: "t1", paneId: `${hostId}-p`, label: "work", agent: "claude" },
      ],
      shellPanes: [],
    });
    const tree = deriveNavigationTree({ hosts: [member("up"), member("down", true)] });

    // The answering member keeps the sense it always had: present in the set means CLOSED.
    expect(tree.rows[0]?.disclosureId).toBe(hostCollapseId("up"));
    expect(tree.rows[0]?.disclosureInverted).toBe(true);

    // The refused one takes the opposite sense, which is what makes "closed by default, opened by
    // hand" expressible without either default inheriting the other's stored answer.
    expect(tree.rows[1]?.disclosureId).toBe(hostOpenId("down"));
    expect(tree.rows[1]?.disclosureInverted).toBeUndefined();

    // Its rows are still there — they are the snapshot's last-good content, not an error.
    expect(tree.rows[1]?.children).toHaveLength(1);
  });
});
