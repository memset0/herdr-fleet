// fleet-send-failure-screens: the local store of a failed send's screens. Synthetic screens only.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asJsonObject, parseJsonObject, type JsonObject } from "../web/src/lib/json.ts";
import type { SendReceipt } from "../web/src/lib/surface/send.ts";
import { RECORD_NAME, SendFailureScreens, wantsFailureScreens, type SendFailureCapture } from "./send-failure-screens.ts";

function receipt(over: Partial<SendReceipt> = {}): SendReceipt {
  return {
    requestId: "req-000001",
    session: "main",
    paneId: "%1",
    paneGeneration: "gen-1",
    harness: "claude",
    version: "2.1.200",
    profileId: "claude",
    profileStatus: "verified",
    textHash: "0".repeat(64),
    textLength: 5,
    s0: null,
    s1: null,
    s2: null,
    gapsMs: {},
    keys: ["probe", "Backspace"],
    outcome: "refused",
    reason: "probe_failed",
    ...over,
  };
}

const BOX = "\u001b[2m────\u001b[0m\r\n> \u001b[7m \u001b[0m\r\n────";

function capture(at: number, over: Partial<SendReceipt> = {}, raw = BOX): SendFailureCapture {
  return { receipt: receipt(over), at, screens: [{ label: "s0", step: "s0", revision: 3, raw }, { label: "last", step: "probe", revision: 4, raw: `${raw}⌁` }] };
}

let root: string;
let dir: string;
let warnings: string[];
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "fleet-send-failures-"));
  dir = join(root, "send-failures");
  warnings = [];
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function store(options: { maxFiles?: number; maxBytes?: number; maxScreenChars?: number } = {}): SendFailureScreens {
  return new SendFailureScreens(dir, { ...options, warn: (line) => warnings.push(line) });
}

/** A record on disk, parsed as JSON; a record that is not an object fails the test. */
function readRecord(name: string): JsonObject {
  const body = parseJsonObject(readFileSync(join(dir, name), "utf8"));
  if (body === undefined) throw new Error(`${name} is not a JSON object`);
  return body;
}

function records(): string[] {
  return readdirSync(dir).toSorted();
}

describe("which failures keep their screens", () => {
  test("a screen-decided refusal does; a send that went in does not", () => {
    for (const reason of ["probe_failed", "draft_present", "unconfirmed", "modal_cue"] as const) expect(wantsFailureScreens(receipt({ reason }))).toBe(true);
    expect(wantsFailureScreens(receipt({ outcome: "typed_not_submitted", reason: "mismatch" }))).toBe(true);
    expect(wantsFailureScreens(receipt({ outcome: "typed_not_submitted", reason: "changed" }))).toBe(true);
    expect(wantsFailureScreens(receipt({ outcome: "sent", reason: undefined }))).toBe(false);
    expect(wantsFailureScreens(receipt({ outcome: "effective", reason: undefined }))).toBe(false);
  });

  test("a refusal over an unreadable modal does; one decided before any read does not", () => {
    expect(wantsFailureScreens(receipt({ reason: "turn_running", saw: { turn: "running", modal: "unreadable", composer: "unknown" } }))).toBe(true);
    expect(wantsFailureScreens(receipt({ reason: "busy" }))).toBe(false);
    expect(wantsFailureScreens(receipt({ reason: "turn_running", saw: { turn: "running", modal: "none", composer: "empty" } }))).toBe(false);
  });

  test("a blind send on a pane with no profile never does", () => {
    expect(wantsFailureScreens(receipt({ reason: "probe_failed", saw: { turn: "unknown", modal: "unknown", composer: "unknown", reason: "no-profile" } }))).toBe(false);
  });
});

describe("the store", () => {
  test("one owner-only record in an owner-only folder, raw screens and the receipt, no temp file left", async () => {
    const s = store();
    s.keep(capture(Date.UTC(2026, 0, 2, 3, 4, 5, 6)));
    await s.idle();
    const names = records();
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(RECORD_NAME);
    expect(names[0]!.startsWith("2026-01-02T03-04-05-006Z-")).toBe(true);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(join(dir, names[0]!)).mode & 0o777).toBe(0o600);
    const body = readRecord(names[0]!);
    expect(body).toMatchObject({ format: "herdr-fleet.send-failure/1", requestId: "req-000001", harness: "claude", version: "2.1.200", profileId: "claude", outcome: "refused", reason: "probe_failed" });
    expect(body["screens"]).toEqual([
      { label: "s0", step: "s0", revision: 3, truncated: false, raw: BOX },
      { label: "last", step: "probe", revision: 4, truncated: false, raw: `${BOX}⌁` },
    ]);
    expect(warnings).toEqual([]);
  });

  test("a request id that is not one is not kept, and never names the file", async () => {
    const s = store();
    s.keep(capture(1_000, { requestId: "../../escape" }));
    await s.idle();
    const [name] = records();
    expect(name).toMatch(RECORD_NAME);
    expect(readRecord(name!)["requestId"]).toBeNull();
  });

  test("a folder left loose is made owner-only again", async () => {
    mkdirSync(dir, { mode: 0o755 });
    const s = store();
    s.keep(capture(1_000));
    await s.idle();
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });

  test("keeps the newest records within the count bound", async () => {
    const s = store({ maxFiles: 3 });
    for (let i = 0; i < 5; i++) s.keep(capture(1_000 + i * 1_000));
    await s.idle();
    // The queue holds eight, so all five were written; the two oldest were pruned.
    expect(records().map((name) => name.slice(0, 24))).toEqual(["1970-01-01T00-00-03-000Z", "1970-01-01T00-00-04-000Z", "1970-01-01T00-00-05-000Z"]);
  });

  test("keeps the newest records within the byte bound", async () => {
    const big = "x".repeat(4_000);
    const s = store({ maxBytes: 20_000 });
    for (let i = 0; i < 4; i++) s.keep(capture(1_000 + i * 1_000, {}, big));
    await s.idle();
    const names = records();
    // Each record holds two 4 kB screens: two fit in 20 kB, a third does not.
    expect(names).toHaveLength(2);
    expect(names[0]!.startsWith("1970-01-01T00-00-03-000Z")).toBe(true);
    const total = names.reduce((sum, name) => sum + statSync(join(dir, name)).size, 0);
    expect(total).toBeLessThanOrEqual(20_000);
  });

  test("a long screen keeps its end, where the box is, and says it was cut", async () => {
    const s = store({ maxScreenChars: 10 });
    s.keep({ receipt: receipt(), at: 1_000, screens: [{ label: "s0", step: "s0", revision: 1, raw: "top rows ... > box" }] });
    await s.idle();
    const screens = readRecord(records()[0]!)["screens"];
    expect(Array.isArray(screens) ? asJsonObject(screens[0]) : undefined).toMatchObject({ raw: " ... > box", truncated: true });
  });

  test("a dead temp file and a stranger's file: the temp goes, the stranger stays", async () => {
    mkdirSync(dir, { mode: 0o700 });
    writeFileSync(join(dir, ".1970-01-01T00-00-00-000Z-00000000.json.tmp"), "{");
    writeFileSync(join(dir, "notes.txt"), "the operator's own");
    const s = store();
    s.keep(capture(1_000));
    await s.idle();
    expect(records().filter((name) => !RECORD_NAME.test(name))).toEqual(["notes.txt"]);
  });

  test("a symbolic link where the folder should be is refused: nothing written through it, one warning", async () => {
    const elsewhere = join(root, "elsewhere");
    mkdirSync(elsewhere, { mode: 0o700 });
    symlinkSync(elsewhere, dir);
    const s = store();
    s.keep(capture(1_000));
    s.keep(capture(2_000));
    await s.idle();
    expect(readdirSync(elsewhere)).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("not a plain folder");
  });

  test("a file where the folder should be is refused", async () => {
    writeFileSync(dir, "not a folder");
    const s = store();
    s.keep(capture(1_000));
    await s.idle();
    expect(readFileSync(dir, "utf8")).toBe("not a folder");
    expect(warnings).toHaveLength(1);
  });

  test("keep returns at once, and a capture with no screens writes nothing", async () => {
    const s = store();
    s.keep({ receipt: receipt(), at: 1_000, screens: [] });
    await s.idle();
    expect(() => readdirSync(dir)).toThrow();
  });
});
