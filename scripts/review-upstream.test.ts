import { describe, expect, test } from "bun:test";

import type { ForkManifest } from "./fork-manifest.ts";
import { buildUpstreamReview } from "./review-upstream.ts";

const manifest: ForkManifest = {
  schema_version: 1,
  upstream: {
    url: "https://github.com/example/collie.git",
    tag: "v0.34.0",
    commit: "0c647372d89d50ec62dfe8b569e9109a830660e5",
  },
  owned: [
    {
      id: "gateway",
      intent: "Synthetic Gateway.",
      paths: ["gateway/**"],
      contracts: ["snapshot"],
      verify: ["gateway/fleet.test.ts"],
    },
  ],
  invasive: [
    {
      id: "app-port",
      intent: "Synthetic App port.",
      strategy: "keep",
      review: "every-upstream-sync",
      paths: ["web/src/App.tsx#App"],
      verify: ["web/src/App.test.tsx"],
      reason: "The host owns bootstrap.",
    },
    {
      id: "removed-service",
      intent: "Synthetic deletion.",
      strategy: "drop",
      review: "every-upstream-sync",
      paths: ["systemd/collie.service#deleted"],
      verify: ["scripts/check.test.ts"],
      reason: "One lifecycle owner.",
    },
  ],
};

describe("upstream review report", () => {
  test("lists every invasive entry even when the target leaves it unchanged", () => {
    const review = buildUpstreamReview(
      manifest,
      "96c3bc3374ea49920ba1c62cfe3135277e16bf00",
      new Map([["web/src/App.tsx", "modified"]]),
      new Set(["web/src/App.tsx"]),
    );
    expect(review.entries.map((entry) => [entry.id, entry.targetTouched])).toEqual([
      ["app-port", true],
      ["removed-service", false],
    ]);
    expect(review.errors).toContain("invasive entry removed-service is unreviewed");
  });

  test("requires a decision, verification, and reason for every entry", () => {
    const target = "96c3bc3374ea49920ba1c62cfe3135277e16bf00";
    const review = buildUpstreamReview(
      manifest,
      target,
      new Map(),
      new Set(),
      {
        target,
        decisions: {
          "app-port": { decision: "adapt", verification: ["bun test app"], reason: "Keep one typed host port." },
          "removed-service": { decision: "drop", verification: ["bun test lifecycle"], reason: "The downstream supervisor remains sole owner." },
        },
      },
    );
    expect(review.errors).toEqual([]);
    expect(review.entries.every((entry) => entry.complete)).toBeTrue();
  });

  test("reports owned target collisions separately", () => {
    const target = "96c3bc3374ea49920ba1c62cfe3135277e16bf00";
    const review = buildUpstreamReview(
      manifest,
      target,
      new Map(),
      new Set(["gateway/new-upstream.ts"]),
      {
        target,
        decisions: {
          "app-port": { decision: "keep", verification: ["test"], reason: "Still required." },
          "removed-service": { decision: "drop", verification: ["test"], reason: "Still excluded." },
        },
      },
    );
    expect(review.ownedCollisions).toEqual([{ id: "gateway", path: "gateway/new-upstream.ts" }]);
    expect(review.errors).toContain("selected target occupies 1 downstream-owned path(s)");
  });

  test.each([
    ["added", "added"],
    ["modified", "modified"],
    ["deleted", "deleted"],
  ] as const)("keeps a target-%s invasive path incomplete without a decision", (_label, status) => {
    const review = buildUpstreamReview(
      manifest,
      "96c3bc3374ea49920ba1c62cfe3135277e16bf00",
      new Map([["web/src/App.tsx", status]]),
      new Set(),
    );
    expect(review.entries[0]?.targetChanges).toEqual([
      { path: "web/src/App.tsx", status },
    ]);
    expect(review.entries[0]?.complete).toBeFalse();
    expect(review.errors).toContain("invasive entry app-port is unreviewed");
  });
});
