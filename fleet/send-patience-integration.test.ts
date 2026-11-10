import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HoldStore } from "../bridge/surface/holds.ts";
import { rig } from "../bridge/surface/protocol.test.ts";
import { resetProfileLog } from "../web/src/lib/surface/profile.ts";
import { BOUNDS } from "../bridge/surface/protocol.ts";
import { profileTuning } from "./profile-tunes.ts";
import { sendHolds } from "./send-holds.ts";
import { sendPolicy } from "./send-patience.ts";

describe("Fleet patient send integration", () => {
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "fleet-patient-send-"));
  profileTuning.enabled = true;
  sendPolicy.patient = true;
  sendHolds.enabled = false;
  Object.assign(BOUNDS, { s0: { reads: 2, ms: 3000 }, probe: { reads: 40, ms: 8000 }, s1: { reads: 60, ms: 15000 }, s2: { reads: 60, ms: 15000 }, notice: { reads: 40, ms: 10000 } });
  resetProfileLog();
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

test("a probe drawn 3.5 seconds late sends successfully without waiting out the whole bound", async () => {
  const r = rig({ storeDir: directory, version: "2.1.999" });
  r.pane.swallow = true;
  let typedAt: number | null = null;
  let probe = "";
  r.pane.afterInput = (_pane, what) => {
    if (what.startsWith("type:") && typedAt === null) { typedAt = r.clock.now; probe = what.slice(5); }
  };
  r.pane.beforeRead = (pane) => {
    if (typedAt !== null && pane.swallow && r.clock.now >= typedAt + 3500) { pane.box = probe; pane.swallow = false; }
  };
  const answer = await r.send("patient message");
  expect(answer.receipt?.outcome).toBe("sent");
  expect(answer.receipt?.gapsMs.probe).toBeGreaterThanOrEqual(3500);
  expect(answer.receipt?.gapsMs.probe).toBeLessThan(4300);
  expect(r.pane.box).toBe("");
});

test("a fast screen does not pay for the longer windows", async () => {
  const r = rig({ storeDir: directory });
  expect((await r.send("fast message")).receipt?.outcome).toBe("sent");
  expect(r.clock.now - 1_000_000).toBeLessThan(1000);
});

test("a real draft remains untouched and is refused immediately", async () => {
  const holds = new HoldStore(join(directory, "holds"));
  const r = rig({ storeDir: join(directory, "sends"), holds });
  r.pane.box = "operator draft";
  const answer = await r.send("new message", { draftHolds: true });
  expect(answer.receipt?.reason).toBe("draft_present");
  expect(r.pane.box).toBe("operator draft");
  expect(r.pane.keysSeen).not.toContain("Enter");
  expect(holds.waiting("main", "%1")).toEqual([]);
});

test("Fleet's Codex text still uses Enter on an idle box", async () => {
  const r = rig({ storeDir: directory, mode: "codex", harness: "codex", version: "0.159.2" });
  const answer = await r.send("operator message");
  expect(answer.receipt?.outcome).toBe("sent");
  expect(r.pane.keysSeen).toContain("Enter");
  expect(r.pane.keysSeen).not.toContain("Tab");
});

test("Fleet's Codex text enters the running turn without a delayed queue", async () => {
  const r = rig({ storeDir: directory, mode: "codex", harness: "codex", version: "0.159.2" });
  r.pane.over = ["• Working (4s • esc to interrupt)"];
  const answer = await r.send("operator correction");
  expect(answer.receipt?.outcome).toBe("sent");
  expect(r.pane.keysSeen).toContain("Enter");
  expect(r.pane.keysSeen).not.toContain("Tab");
});

test("a profile lookup past the total ceiling returns without typing", async () => {
  const r = rig({ storeDir: directory });
  const original = r.deps.profile;
  Object.assign(r.deps, { profile: async (harness: string, pane: string) => {
    const match = await original(harness, pane);
    r.clock.now += 95_000;
    return match;
  } });
  const answer = await r.send("do not type after the ceiling");
  expect(answer.receipt?.reason).toBe("bound");
  expect(r.pane.calls).toEqual([]);
});

});
