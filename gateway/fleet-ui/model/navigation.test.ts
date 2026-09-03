import { describe, expect, test } from "bun:test";

import {
  fleetCloseAffectsRoute,
  fleetCurrentAgentMatch,
  fleetDesktopTerminalUrl,
  fleetShortcutCycleIndex,
  fleetTreeTabMode,
} from "./navigation.ts";

describe("Fleet navigation model", () => {
  test("constructs only bounded same-origin terminal URLs", () => {
    expect(
      fleetDesktopTerminalUrl(
        true,
        "https://fleet.example.com",
        "local",
        "w1:p1",
        "batch-a",
      ),
    ).toBe(
      "https://fleet.example.com/ttyd/local/?pane=w1%3Ap1&session=batch-a",
    );
    expect(
      fleetDesktopTerminalUrl(false, "https://fleet.example.com", "local"),
    ).toBeNull();
    expect(
      fleetDesktopTerminalUrl(true, "http://fleet.example.com", "local"),
    ).toBeNull();
    expect(
      fleetDesktopTerminalUrl(
        true,
        "https://operator:secret@fleet.example.com",
        "local",
      ),
    ).toBeNull();
    expect(
      fleetDesktopTerminalUrl(true, "https://fleet.example.com", "../other"),
    ).toBeNull();
  });

  test("classifies tree cardinality and wraps shortcut cycles", () => {
    expect(fleetTreeTabMode([])).toBe("empty");
    expect(fleetTreeTabMode([{ paneId: "w0:p1" }])).toBe("direct");
    expect(fleetTreeTabMode([{ paneId: "w0:p1" }, { paneId: "w0:p2" }])).toBe(
      "branch",
    );
    expect(fleetTreeTabMode([{ paneId: "../../private" }])).toBe("empty");
    expect(fleetShortcutCycleIndex(["a", "b", "c"], "a", -1)).toBe(2);
    expect(fleetShortcutCycleIndex(["a", "b", "c"], "c", 1)).toBe(0);
    expect(fleetShortcutCycleIndex([], "a", 1)).toBeNull();
  });

  test("matches current Agents and close effects by exact route identity", () => {
    const primary = {
      nodeId: "alpha",
      paneId: "w1:p1",
      herdrSession: "alpha",
      primarySession: true,
    };
    const named = {
      nodeId: "alpha",
      paneId: "w1:p1",
      herdrSession: "demo",
      primarySession: false,
    };
    expect(
      fleetCurrentAgentMatch(
        { nodeId: "alpha", view: "pane", paneId: "w1:p1" },
        primary,
      ),
    ).toBeTrue();
    expect(
      fleetCurrentAgentMatch(
        { nodeId: "alpha", view: "pane", paneId: "w1:p1", session: "demo" },
        named,
      ),
    ).toBeTrue();
    expect(
      fleetCurrentAgentMatch(
        { nodeId: "alpha", view: "pane", paneId: "w1:p1", session: "other" },
        named,
      ),
    ).toBeFalse();

    const route = {
      nodeId: "alpha",
      view: "pane" as const,
      paneId: "w1:p2",
      tabId: "w1:t1",
    };
    expect(
      fleetCloseAffectsRoute(route, {
        nodeId: "alpha",
        kind: "pane",
        targetId: "w1:p2",
      }),
    ).toBeTrue();
    expect(
      fleetCloseAffectsRoute(route, {
        nodeId: "alpha",
        kind: "tab",
        targetId: "w1:t1",
        paneIds: [],
      }),
    ).toBeTrue();
    expect(
      fleetCloseAffectsRoute(route, {
        nodeId: "beta",
        kind: "tab",
        targetId: "w1:t1",
        paneIds: ["w1:p2"],
      }),
    ).toBeFalse();
  });
});
