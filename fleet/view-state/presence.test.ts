import { expect, test } from "bun:test";
import { createViewPresence, PRESENCE_TTL, viewPresenceResponse } from "./presence.ts";

test("leases exclude self, separate sessions, withdraw, expire and refuse older revival", () => {
  let now = 0;
  const presence = createViewPresence(() => now);
  expect(presence.pulse("session-a", "tab-a", 1, true)).toBe(0);
  expect(presence.pulse("session-a", "tab-b", 1, true)).toBe(1);
  expect(presence.pulse("session-b", "tab-a", 1, true)).toBe(2);
  expect(presence.pulse("controller", "panel", 1, false)).toBe(3);
  presence.pulse("session-a", "tab-a", 3, false);
  presence.pulse("session-a", "tab-a", 2, true);
  expect(presence.pulse("controller", "panel", 2, false)).toBe(2);
  presence.removeSession("session-b");
  expect(presence.pulse("controller", "panel", 3, false)).toBe(1);
  now += PRESENCE_TTL;
  expect(presence.pulse("controller", "panel", 4, false)).toBe(0);
});

test("presence request validates bounded bodies and exposes counts only without caching", async () => {
  const presence = createViewPresence();
  const post = (body: string) => new Request("https://fleet.example.test/fleet/api/view-presence", { method: "POST", body });
  expect((await viewPresenceResponse(post("{}"), "example", presence)).status).toBe(400);
  expect((await viewPresenceResponse(post("x".repeat(513)), "example", presence)).status).toBe(413);
  expect((await viewPresenceResponse(new Request("https://fleet.example.test/fleet/api/view-presence"), "example", presence)).status).toBe(405);
  const response = await viewPresenceResponse(post(JSON.stringify({ id: "00000000-0000-0000-0000-000000000001", sequence: 1, active: true })), "example", presence);
  expect(await response.json()).toEqual({ active: 0 });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
