import { expect, test } from "bun:test";
import { fleetTestConfig } from "../test-helpers.ts";
import { fetchBindingInventory, placeEvidence, readBindingInventory } from "./inventory.ts";
import { migratePlaces } from "./place.ts";

function snapshot() {
  return {
    bridge: "connected",
    servers: [{ id: "lead", isLead: true, reachable: true }, { id: "member-a", isLead: false, reachable: true }],
    sessions: [{ name: "default", host: "lead", isPrimary: true, reachable: true }, { name: "default", host: "member-a", isPrimary: true, reachable: true }],
    agents: [{ paneId: "w1:p1", workspaceLabel: "Example", workspaceId: "w1", host: "lead", session: "default", bindingId: "herdr:term_one", bindingSession: "default" }],
    shellPanes: [],
  };
}

test("primary-session aliases migrate to one canonical terminal while stale evidence is excluded", () => {
  const doc = snapshot(), inventory = readBindingInventory(doc);
  const legacy = { row: "lead\u0000\u0000w1:p1", space: "Example", payload: "keep" };
  expect(migratePlaces([legacy], placeEvidence(inventory), true)[0]?.row).toStartWith("fleet-terminal:v1:");
  doc.servers[0]!.reachable = false;
  expect(placeEvidence(readBindingInventory(doc))).toEqual([]);
});

test("every member is widened through the existing API host parameter", async () => {
  const config = fleetTestConfig(), calls: URL[] = [];
  const inventory = await fetchBindingInventory(new Request(config.public.origin), config, async (input) => {
    const url = new URL(String(input)); calls.push(url);
    const doc = snapshot();
    if (url.searchParams.get("host") === "member-a") {
      doc.agents = [{ ...doc.agents[0]!, host: "member-a", session: "work", bindingSession: "work", bindingId: "herdr:term_other" }];
    }
    return Response.json(doc);
  });
  expect(calls).toHaveLength(2);
  expect(calls.every((url) => url.searchParams.get("sessions") === "all")).toBeTrue();
  expect(calls[1]?.searchParams.get("host")).toBe("member-a");
  expect(inventory.map((pane) => pane.bindingId)).toEqual(["herdr:term_one", "herdr:term_other"]);
});
