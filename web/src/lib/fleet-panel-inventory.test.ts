import { expect, it } from "vitest";
import { inventoryFromSnapshots, resolvePanelTerminal } from "./fleet-panel-inventory";
import { terminalReference } from "../../../fleet/bindings/identity.ts";
import type { AgentView, SnapshotResponse } from "./types";

const agent: AgentView = { paneId: "w1:p1", workspaceId: "w1", workspaceLabel: "Example", workspaceNumber: 1,
  tabId: "t1", agent: "codex", status: "working", cwd: "/example", focused: false,
  host: "member-a", session: "default", bindingSession: "default", bindingId: "herdr:term_a" };
const snapshot = (agents: AgentView[], reachable = true): SnapshotResponse => ({ bridge: "connected", agents, shellPanes: [], workspaces: [], tabs: [], ts: 1,
  servers: [{ id: "member-a", name: "Example member", isLead: false, reachable, protocol: "ok", lastSeenAt: 1 }] });

it("widening covers sessions without duplicated primary rows and follows a moved terminal", () => {
  const moved = { ...agent, paneId: "w2:p9", workspaceId: "w2" };
  const other = { ...agent, paneId: "w1:p1", session: "other", bindingSession: "other" };
  const inventory = inventoryFromSnapshots([snapshot([agent]), snapshot([moved, other])]);
  expect(inventory.agents).toEqual([moved, other]);
  expect(resolvePanelTerminal(terminalReference(agent)!, inventory)).toEqual({ status: "resolved", pane: moved });
});

it("offline or failed members keep display rows without authorizing a replacement", () => {
  const stale = inventoryFromSnapshots([snapshot([], false)], [agent]);
  expect(stale.agents).toEqual([agent]);
  expect(resolvePanelTerminal(terminalReference(agent)!, stale).status).toBe("unavailable");
  const failed = inventoryFromSnapshots([snapshot([agent])], [agent], [], ["member-a"]);
  expect(failed.fresh.size).toBe(0);
  const replacement = { ...agent, bindingId: "herdr:term_new" };
  expect(resolvePanelTerminal(terminalReference(agent)!, inventoryFromSnapshots([snapshot([replacement])])).status).toBe("unavailable");
});

it("a successful empty widened member removes its former primary-only rows", () => {
  const inventory = inventoryFromSnapshots([snapshot([agent]), snapshot([])], [], ["member-a"]);
  expect(inventory.agents).toEqual([]);
});

it("duplicate stable identities refuse resolution", () => {
  const inventory = inventoryFromSnapshots([snapshot([agent, { ...agent, paneId: "w1:p2" }])]);
  expect(resolvePanelTerminal(terminalReference(agent)!, inventory).status).toBe("ambiguous");
});

it("a disconnected lead keeps its Agent visible without authorizing it", () => {
  const snap = snapshot([agent]);
  snap.servers![0]!.isLead = true;
  snap.bridge = "disconnected";
  const inventory = inventoryFromSnapshots([snap]);
  expect(inventory.agents).toEqual([agent]);
  expect(inventory.fresh.size).toBe(0);
});

it("member widening filters merged responses and preserves unique scoped placements", () => {
  const lead = { ...agent, host: "member-lead", bindingId: "herdr:term_lead", lastActiveAt: 100 };
  const first = { ...agent, lastActiveAt: 300 };
  const second = { ...agent, host: "member-b", bindingId: "herdr:term_b", lastActiveAt: 200 };
  const primary = [lead, { ...first, session: undefined }, { ...second, session: undefined }];
  const firstMerged = [ { ...lead, session: undefined }, first, { ...second, session: undefined } ];
  const secondMerged = [ { ...lead, session: undefined }, { ...first, session: undefined }, second ];
  const inventory = inventoryFromSnapshots([snapshot(primary), snapshot(firstMerged), snapshot(secondMerged)], [], ["member-a", "member-b"]);
  expect(inventory.agents).toEqual([lead, first, second]);
});

it("exact repeats collapse while different sessions and conflicting placements remain distinct", () => {
  const otherSession = { ...agent, session: "other", bindingSession: "other" };
  const conflicting = { ...agent, paneId: "w1:p2" };
  const inventory = inventoryFromSnapshots([snapshot([agent, agent, { ...agent, session: undefined }, otherSession, conflicting])]);
  expect(inventory.agents).toEqual([agent, otherSession, conflicting]);
  expect(resolvePanelTerminal(terminalReference(agent)!, inventory).status).toBe("ambiguous");
});
