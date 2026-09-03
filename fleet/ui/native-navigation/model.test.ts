import { describe, expect, test } from "bun:test";

import {
  deriveNavigationTree,
  MAX_NAVIGATION_PANES,
  spaceDisclosureId,
  tabDisclosureId,
} from "./model";

describe("native navigation hierarchy", () => {
  test("preserves Space, Tab, Agent, and shell order while selecting ancestry", () => {
    const tree = deriveNavigationTree({
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

    expect(tree.spaces.map((space) => space.workspaceId)).toEqual(["w2", "w1"]);
    expect(tree.spaces[0]?.tabs.map((tab) => tab.tabId)).toEqual(["t2", "t1"]);
    expect(tree.spaces[0]?.tabs[0]?.panes.map((pane) => pane.paneId)).toEqual(["p2", "p3"]);
    expect(tree.selection).toEqual({
      paneId: "p3",
      spaceDisclosureId: spaceDisclosureId("w2"),
      tabDisclosureId: tabDisclosureId("w2", "t2"),
    });
  });

  test("drops orphaned and invalid rows without inventing a Host level", () => {
    const tree = deriveNavigationTree({
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [
        { workspaceId: "missing", tabId: "t0", label: "Orphan" },
        { workspaceId: "w1", tabId: "t1", label: "First" },
      ],
      agents: [
        {
          workspaceId: "w1",
          tabId: "missing",
          paneId: "p0",
          label: "Orphan",
          agent: "claude",
        },
        {
          workspaceId: "w1",
          tabId: "t1",
          paneId: "",
          label: "Invalid",
          agent: "claude",
        },
      ],
      shellPanes: [],
    });

    expect(tree.spaces).toHaveLength(1);
    expect(tree.spaces[0]?.tabs).toHaveLength(1);
    expect(tree.spaces[0]?.tabs[0]?.panes).toEqual([]);
    expect(Object.keys(tree.spaces[0] ?? {})).not.toContain("hosts");
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
      workspaces: [{ workspaceId: "w1", label: "One" }],
      tabs: [{ workspaceId: "w1", tabId: "t1", label: "First" }],
      agents,
      shellPanes: [],
    });
    expect(tree.spaces[0]?.tabs[0]?.panes).toHaveLength(MAX_NAVIGATION_PANES);
  });
});
