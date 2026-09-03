import { describe, expect, test } from "bun:test";

import {
  deriveNavigationTree,
  MAX_NAVIGATION_PANES,
  spaceDisclosureId,
  tabDisclosureId,
} from "./model";

const HOST = { hostId: "", hostLabel: "This host" };

describe("native navigation hierarchy", () => {
  test("puts every Space under exactly one Host heading", () => {
    const tree = deriveNavigationTree({
      hostId: "peer-a",
      hostLabel: "peer-a",
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [],
      agents: [],
      shellPanes: [],
    });

    expect(tree.hosts).toHaveLength(1);
    expect(tree.hosts[0]?.label).toBe("peer-a");
    expect(tree.hosts[0]?.rows.map((row) => row.label)).toEqual(["One"]);
  });

  test("preserves Space, Tab, Agent, and shell order while selecting ancestry", () => {
    const tree = deriveNavigationTree({
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

    const rows = tree.hosts[0]?.rows ?? [];
    expect(rows.map((row) => row.label)).toEqual(["Two", "One"]);
    // Two tabs survive, so the Tab level stays; `t2` groups two Panes and `t1` groups one, which
    // means the second Tab is replaced by its own Pane.
    expect(rows[0]?.children.map((row) => row.label)).toEqual(["Second", "Codex"]);
    expect(rows[0]?.children[0]?.children.map((row) => row.label)).toEqual(["Claude", "Shell"]);
    expect(tree.selection).toEqual({
      paneId: "p3",
      ancestors: [spaceDisclosureId("w2"), tabDisclosureId("w2", "t2")],
    });
  });

  test("elides a lone Tab and lets the Pane's own name and icon win", () => {
    const tree = deriveNavigationTree({
      ...HOST,
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [{ workspaceId: "w1", tabId: "t1", label: "Tab name nobody chose" }],
      agents: [
        { workspaceId: "w1", tabId: "t1", paneId: "p1", label: "Claude", agent: "claude" },
      ],
      shellPanes: [],
      selectedPaneId: "p1",
    });

    const space = tree.hosts[0]?.rows[0];
    expect(space?.icon).toBe("none");
    expect(space?.disclosureId).toBe(spaceDisclosureId("w1"));
    expect(space?.children).toHaveLength(1);
    expect(space?.children[0]).toMatchObject({
      label: "Claude",
      icon: "agent",
      agent: "claude",
      target: { kind: "pane", paneId: "p1" },
      selected: true,
    });
    expect(space?.children[0]?.disclosureId).toBeUndefined();
    expect(tree.selection?.ancestors).toEqual([spaceDisclosureId("w1")]);
  });

  test("keeps a group row and its folder only where more than one child survives", () => {
    const tree = deriveNavigationTree({
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

    const children = tree.hosts[0]?.rows[0]?.children ?? [];
    expect(children[0]).toMatchObject({
      label: "Pair",
      icon: "group",
      disclosureId: tabDisclosureId("w1", "t1"),
    });
    expect(children[0]?.target).toBeUndefined();
    expect(children[1]).toMatchObject({ label: "C", icon: "agent" });
    expect(children.filter((row) => row.icon === "group")).toHaveLength(1);
    expect(tree.hosts[0]?.rows[0]?.icon).toBe("none");
  });

  test("drops orphaned, invalid and empty rows and leaves an empty Space openable", () => {
    const tree = deriveNavigationTree({
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

    const space = tree.hosts[0]?.rows[0];
    expect(tree.hosts[0]?.rows).toHaveLength(1);
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
    const tree = deriveNavigationTree({
      ...HOST,
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [{ workspaceId: "w1", tabId: "t1", label: "First" }],
      agents,
      shellPanes: [],
    });
    expect(tree.hosts[0]?.rows[0]?.children).toHaveLength(MAX_NAVIGATION_PANES);
  });
});
