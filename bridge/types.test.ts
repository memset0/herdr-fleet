import { describe, expect, test } from "bun:test";

import { toPaneWire, type AgentView } from "./types.ts";

const pane: AgentView = {
  paneId: "w1:p1",
  workspaceId: "w1",
  workspaceLabel: "demo",
  workspaceNumber: 1,
  tabId: "w1:t1",
  agent: "claude",
  status: "idle",
  cwd: "/tmp/demo",
  focused: true,
  readableLines: 54,
  viewportRows: 24,
  agentSession: { kind: "id", value: "synthetic-session" },
};

describe("toPaneWire", () => {
  test("keeps public scroll depth but strips bridge-only resize rows", () => {
    const wire = toPaneWire(pane, () => true);
    expect(wire.readableLines).toBe(54);
    expect(wire.hasSession).toBe(true);
    expect("viewportRows" in wire).toBe(false);
    expect("agentSession" in wire).toBe(false);
  });
});
