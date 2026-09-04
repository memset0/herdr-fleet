import { describe, expect, test } from "bun:test";

import {
  EMPTY_PANE_HISTORY,
  paneForTab,
  panesInTab,
  prunePaneHistory,
  stepBy,
  stepPaneEverywhere,
  stepPaneInTab,
  stepTabInSpace,
  swapPaneHistory,
  tabOrdinalInSpace,
  tabsInSpace,
  visitPane,
  type PaneTarget,
  type TabTarget,
} from "./targets.ts";

function pane(paneId: string, workspaceId: string, tabId: string, host?: string): PaneTarget {
  return host === undefined ? { paneId, workspaceId, tabId } : { paneId, workspaceId, tabId, host };
}

function tab(tabId: string, workspaceId: string, host?: string): TabTarget {
  return host === undefined ? { tabId, workspaceId } : { tabId, workspaceId, host };
}

const TABS = [tab("t1", "w1"), tab("t2", "w1"), tab("t3", "w2"), tab("t1", "w1", "peer")];
const PANES = [
  pane("p1", "w1", "t1"),
  pane("p2", "w1", "t1"),
  pane("p3", "w1", "t2"),
  pane("p9", "w1", "t1", "peer"),
];

describe("tabs stay inside their Space and their machine", () => {
  test("only this Space's tabs are candidates", () => {
    expect(tabsInSpace(TABS, "w1", undefined).map((x) => x.tabId)).toEqual(["t1", "t2"]);
    expect(tabsInSpace(TABS, "w2", undefined).map((x) => x.tabId)).toEqual(["t3"]);
  });

  test("a tab with the same id on another member is a different tab", () => {
    expect(tabsInSpace(TABS, "w1", "peer").map((x) => x.tabId)).toEqual(["t1"]);
  });

  test("cycling wraps inside the Space and never leaves it", () => {
    expect(stepTabInSpace(TABS, { workspaceId: "w1", tabId: "t2" }, 1)?.tabId).toBe("t1");
    expect(stepTabInSpace(TABS, { workspaceId: "w1", tabId: "t1" }, -1)?.tabId).toBe("t2");
    expect(stepTabInSpace(TABS, { workspaceId: "w2", tabId: "t3" }, 1)?.tabId).toBe("t3");
  });

  test("ordinals are one-based within the Space and answer null past its end", () => {
    expect(tabOrdinalInSpace(TABS, { workspaceId: "w1" }, 2)?.tabId).toBe("t2");
    expect(tabOrdinalInSpace(TABS, { workspaceId: "w1" }, 3)).toBeNull();
    expect(tabOrdinalInSpace(TABS, { workspaceId: "w1" }, 0)).toBeNull();
  });
});

describe("panes stay inside their Tab", () => {
  test("only this Tab's panes are candidates", () => {
    expect(panesInTab(PANES, "t1", undefined).map((x) => x.paneId)).toEqual(["p1", "p2"]);
  });

  test("cycling wraps inside the Tab and never crosses to a sibling", () => {
    expect(stepPaneInTab(PANES, { tabId: "t1", paneId: "p2" }, 1)?.paneId).toBe("p1");
    expect(stepPaneInTab(PANES, { tabId: "t1", paneId: "p1" }, -1)?.paneId).toBe("p2");
  });

  test("a one-pane Tab cycles to itself rather than escaping", () => {
    expect(stepPaneInTab(PANES, { tabId: "t2", paneId: "p3" }, 1)?.paneId).toBe("p3");
  });

  test("selecting a Tab opens its first Pane, or the one already displayed", () => {
    expect(paneForTab(PANES, tab("t1", "w1"))?.paneId).toBe("p1");
    expect(paneForTab(PANES, tab("t1", "w1"), "p2")?.paneId).toBe("p2");
    expect(paneForTab([], tab("t1", "w1"))).toBeNull();
  });
});

describe("the hierarchy walk crosses everything", () => {
  const ordered = [pane("p1", "w1", "t1"), pane("p3", "w1", "t2"), pane("p9", "w1", "t1", "peer")];

  test("it steps across Tabs and machines in the order given", () => {
    expect(stepPaneEverywhere(ordered, { paneId: "p3" }, 1)?.paneId).toBe("p9");
    expect(stepPaneEverywhere(ordered, { paneId: "p9", host: "peer" }, 1)?.paneId).toBe("p1");
    expect(stepPaneEverywhere(ordered, { paneId: "p1" }, -1)?.paneId).toBe("p9");
  });

  test("the same pane id on two machines is two rows", () => {
    const both = [pane("p1", "w1", "t1"), pane("p1", "w1", "t1", "peer")];
    expect(stepPaneEverywhere(both, { paneId: "p1" }, 1)?.host).toBe("peer");
    expect(stepPaneEverywhere(both, { paneId: "p1", host: "peer" }, 1)?.host).toBeUndefined();
  });

  test("nowhere to go answers null rather than throwing", () => {
    expect(stepPaneEverywhere([], null, 1)).toBeNull();
    expect(stepBy([], 0, 1)).toBeNull();
  });
});

describe("the last-pane history", () => {
  test("visiting builds the pair and revisiting does not duplicate", () => {
    let history = visitPane(EMPTY_PANE_HISTORY, "a");
    history = visitPane(history, "b");
    expect(history).toEqual({ current: "b", previous: "a" });
    expect(visitPane(history, "b")).toBe(history);
  });

  test("swapping twice returns to where it started", () => {
    const history = visitPane(visitPane(EMPTY_PANE_HISTORY, "a"), "b");
    const once = swapPaneHistory(history);
    expect(once).toEqual({ current: "a", previous: "b" });
    expect(swapPaneHistory(once)).toEqual({ current: "b", previous: "a" });
  });

  test("with nothing to go back to, swapping changes nothing", () => {
    const only = visitPane(EMPTY_PANE_HISTORY, "a");
    expect(swapPaneHistory(only)).toBe(only);
  });

  test("a pane the topology dropped is pruned, and an untouched history is not copied", () => {
    const history = visitPane(visitPane(EMPTY_PANE_HISTORY, "a"), "b");
    expect(prunePaneHistory(history, (key) => key === "a")).toBe(history);
    expect(prunePaneHistory(history, () => false)).toEqual({ current: "b", previous: null });
  });
});
