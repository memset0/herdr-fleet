import { describe, expect, test } from "bun:test";

import {
  FLEET_AGENT_FAVORITES_MAX,
  fleetAgentBucket,
  fleetAgentFavoriteCompare,
  fleetAgentFavoriteKey,
  fleetAgentFavoritePreference,
  fleetAttentionResetEligible,
  fleetHeaderAgentCount,
} from "./agents.ts";

describe("Fleet Agent model", () => {
  test("retains Collie triage and attention-reset semantics", () => {
    expect(fleetAgentBucket({ reachable: true, status: "blocked" })).toBe(
      "needs",
    );
    expect(
      fleetAgentBucket({
        reachable: true,
        status: "done",
        lastActiveAt: 2,
        lastSeenAt: 1,
      }),
    ).toBe("ready");
    expect(fleetAgentBucket({ reachable: true, status: "working" })).toBe(
      "working",
    );
    expect(fleetAgentBucket({ reachable: false, status: "idle" })).toBe(
      "recent",
    );
    expect(
      fleetHeaderAgentCount([
        { reachable: true, status: "blocked" },
        { reachable: true, status: "done", lastActiveAt: 2, lastSeenAt: 1 },
        { reachable: true, status: "working" },
        { reachable: false, status: "idle" },
      ]),
    ).toBe(3);
    expect(
      fleetAttentionResetEligible({ reachable: true, status: "blocked" }),
    ).toBeTrue();
    expect(
      fleetAttentionResetEligible({ reachable: false, status: "blocked" }),
    ).toBeFalse();
    expect(
      fleetAttentionResetEligible({ reachable: true, status: "working" }),
    ).toBeFalse();
  });

  test("parses bounded browser-local favorite identities", () => {
    const alpha = fleetAgentFavoriteKey({
      nodeId: "alpha",
      herdrSession: "default",
      paneId: "w0:p1",
      agent: "codex",
    });
    const beta = fleetAgentFavoriteKey({
      nodeId: "beta",
      herdrSession: "batch",
      paneId: "w1:p2",
      agent: "claude",
    });
    expect(alpha).toBe('["alpha","default","w0:p1","codex"]');
    expect(
      fleetAgentFavoriteKey({
        nodeId: "",
        herdrSession: "default",
        paneId: "w0:p1",
        agent: "codex",
      }),
    ).toBeNull();
    expect([
      ...fleetAgentFavoritePreference(
        JSON.stringify({ version: 1, keys: [alpha!, beta!] }),
      ),
    ]).toEqual([alpha!, beta!]);
    expect([
      ...fleetAgentFavoritePreference(
        JSON.stringify({ version: 1, keys: [alpha!, alpha!] }),
      ),
    ]).toEqual([]);
    expect([...fleetAgentFavoritePreference("not json")]).toEqual([]);
    const oversized = Array.from(
      { length: FLEET_AGENT_FAVORITES_MAX + 1 },
      (_, index) =>
        fleetAgentFavoriteKey({
          nodeId: "alpha",
          herdrSession: "default",
          paneId: `w0:p${index}`,
          agent: "codex",
        }),
    );
    expect([
      ...fleetAgentFavoritePreference(
        JSON.stringify({ version: 1, keys: oversized }),
      ),
    ]).toEqual([]);
    const favorites = new Set([beta!]);
    expect(fleetAgentFavoriteCompare(alpha!, beta!, favorites)).toBe(1);
    expect(fleetAgentFavoriteCompare(beta!, alpha!, favorites)).toBe(-1);
  });
});
