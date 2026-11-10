// Sends to a Claude Code 2.1.314 pane whose input box shows typed keys late, under the agents footer
// (#623, 2026-10-30, Collie 1.24.3 on Herdr). A subagent ran for eleven minutes (`◯ general-purpose
// Loading Monitor tool schema`), and three sends in ten seconds ended `probe_failed` with the box empty
// (`saw=idle/none/empty`): the probe character did not show while the probe read. The fourth found a
// draft (`saw=idle/none/draft`), and its proof ended "an input box that does not take keys … may need a
// redraw". The report's screen shows why: the mode row lacks `· ↓ to manage`, which Claude Code draws
// only over an empty box, so the box held text by then, and the only text anyone typed was Collie's
// probes. The agent took the keys and drew them seconds later.
//
// The lab (2026-10-31, `~/.cache/collie-lab/m80-01-lab`, Claude Code 2.1.314 on a scratch Herdr 0.9.5,
// 282 columns, a background subagent and the agents footer up) gave the same receipts word for word
// once the Claude process was held for two seconds around each send, and none while it ran freely: the
// footer itself never kept a probe out of the box.
//
// Since M80 spec 09 (2026-11-01) a probe that shows nowhere on an idle pane reads on for the late-probe
// window (LATE_PROBE): an agent that draws the probe inside it takes the first send, and one busy past it
// gives the report's receipts as before, each probe gap now at least the window.
//
// The screen is the reporter's own bottom rows (web/src/fixtures/surface/claude--v2-1-314-agents-footer-
// late-probes--w282.txt), over a box the fake pane draws. A busy pane keeps every text and key in the
// terminal's buffer and draws them, in order, once it is free again.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { muxAck, muxOk, type MuxAck, type MuxGrid, type MuxGridRequest, type MuxOutcome } from "../mux/types.ts";
import { profileFor } from "../../web/src/lib/surface/profile.ts";
import { STALE_SCREEN, type SendAnswer } from "../../web/src/lib/surface/send.ts";
import { KeyGate } from "./key-gate.ts";
import { PROBE_MARKER } from "./probe-marker.ts";
import { LATE_PROBE, RowRing, SendProtocol, SessionLocks, type SendRequest } from "./protocol.ts";
import { RequestStore } from "./requests.ts";

const SURFACE = join(import.meta.dir, "..", "..", "web", "src", "fixtures", "surface");
/** The reporter's screen: the box held the three late probe characters, the agents footer under it. */
const CAPTURE = readFileSync(join(SURFACE, "claude--v2-1-314-agents-footer-late-probes--w282.txt"), "utf8");
const P = PROBE_MARKER;
const RULE = /^─{8,}$/u;
/** Claude Code adds this hint to the mode row while the box is empty, and drops it once the box holds text. */
const HINT = " · ↓ to manage";

interface Clock {
  now: number;
}

/** The captured screen, its box drawn from what reached the agent; while busy, nothing reaches it yet. */
class BusyClaudePane {
  box: string;
  submitted: string[] = [];
  keysSeen: string[] = [];
  /** The agent draws nothing it is sent before this time on the clock. */
  busyUntil = 0;
  private readonly head: string[];
  private readonly rule: string;
  private readonly modeRow: string;
  private readonly footer: string[];
  private readonly buffered: Array<{ readonly text: string } | { readonly key: string }> = [];
  private reads = 0;

  constructor(
    capture: string,
    private readonly clock: Clock,
  ) {
    const rows = capture.replace(/\r/gu, "").split("\n");
    while (rows.length > 0 && rows.at(-1)!.trim() === "") rows.pop();
    const bottom = rows.findLastIndex((row) => RULE.test(row));
    const top = rows.slice(0, bottom).findLastIndex((row) => RULE.test(row));
    if (top < 0 || bottom !== top + 2) throw new Error("the capture has no one-row box");
    this.head = rows.slice(0, top);
    this.rule = rows[top]!;
    this.box = rows[top + 1]!.replace(/^❯ ?/u, "");
    this.modeRow = rows[bottom + 1]!;
    this.footer = rows.slice(bottom + 2);
  }

  /** The mode row with the hint over an empty box: the hint takes its width out of the padding. */
  private mode(): string {
    if (this.box !== "") return this.modeRow;
    const at = this.modeRow.indexOf("shell") + "shell".length;
    const rest = this.modeRow.slice(at);
    return `${this.modeRow.slice(0, at)}${HINT}${rest.slice(HINT.length)}`;
  }

  private render(): string {
    return [...this.head, this.rule, `❯ ${this.box}`, this.rule, this.mode(), ...this.footer].join("\n");
  }

  /** Once the agent is free, it draws what waited in the terminal, in order. */
  private drain(): void {
    if (this.clock.now < this.busyUntil) return;
    for (const item of this.buffered.splice(0)) {
      if ("text" in item) this.apply(item.text);
      else this.press(item.key);
    }
  }

  private apply(text: string): void {
    this.box += text;
  }

  private press(key: string): void {
    if (key === "Backspace") this.box = [...this.box].slice(0, -1).join("");
    else if (key === "Enter" && this.box.length > 0) {
      this.submitted.push(this.box);
      this.box = "";
    }
  }

  readGrid = (paneId: string, request: MuxGridRequest): Promise<MuxOutcome<MuxGrid>> => {
    void request;
    this.reads++;
    this.drain();
    return Promise.resolve(muxOk({ paneId, text: this.render(), truncated: false, revision: this.reads }));
  };

  typeText = (paneId: string, text: string): Promise<MuxAck> => {
    void paneId;
    this.buffered.push({ text });
    this.drain();
    return Promise.resolve(muxAck());
  };

  pasteText = (paneId: string, text: string): Promise<MuxAck> => this.typeText(paneId, text);

  writeKeys = (paneId: string, keys: readonly string[]): Promise<MuxAck> => {
    void paneId;
    for (const key of keys) {
      this.keysSeen.push(key);
      this.buffered.push({ key });
    }
    this.drain();
    return Promise.resolve(muxAck());
  };
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "collie-late-keys-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

let ids = 0;

/** A protocol on a Claude Code 2.1.314 pane drawn from the capture, with `box` in its box. */
function rig(box: string) {
  const clock: Clock = { now: 1_000_000 };
  const pane = new BusyClaudePane(CAPTURE, clock);
  pane.box = box;
  const now = (): number => clock.now;
  const protocol = new SendProtocol({
    mux: { readGrid: pane.readGrid, typeText: pane.typeText, pasteText: pane.pasteText },
    gate: new KeyGate(pane, now),
    store: new RequestStore(join(dir, "sends"), now),
    locks: new SessionLocks(),
    ring: new RowRing(),
    profile: (harness: string) => Promise.resolve(profileFor(harness, "2.1.314", { log: () => undefined })),
    generation: () => "gen-1",
    now,
    sleep: (ms: number) => {
      clock.now += ms;
      return Promise.resolve();
    },
  });
  const send = (text: string, over: Partial<SendRequest> = {}): Promise<SendAnswer> =>
    protocol.handle({ id: `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`, text, mode: "send", ...over }, { session: "main", paneId: "w2:p1", harness: "claude" });
  return { pane, clock, send };
}

describe("Claude Code 2.1.314 under its agents footer, a box that shows keys late (#623)", () => {
  test("the reporter's screen reads idle with no modal: the agents footer is not a dialog, and the late probes are a draft", async () => {
    const { send } = rig(`${P}${P}${P}`);
    expect((await send("", { mode: "prepare" })).surface).toMatchObject({ turn: "idle", modal: "none", composer: "draft" });
  });

  test("with the box empty and the agent drawing at once, a send goes on one tap", async () => {
    const { pane, send } = rig("");
    expect((await send("", { mode: "prepare" })).surface).toMatchObject({ turn: "idle", modal: "none", composer: "empty" });
    const answer = await send("hello there");
    expect(answer.receipt).toMatchObject({ outcome: "sent", keys: ["probe", "Backspace", "Enter"] });
    expect(pane.submitted).toEqual(["hello there"]);
  });

  test("with the late-probe window the report's first send lands: the agent drew its probe 2 s late (M80 spec 09)", async () => {
    const { pane, clock, send } = rig("");
    pane.busyUntil = clock.now + 2_000;
    const answer = await send("hello there");
    expect(answer.receipt).toMatchObject({ outcome: "sent", keys: ["probe", "Backspace", "Enter"] });
    expect(answer.receipt?.gapsMs.probe).toBeGreaterThan(2_000);
    expect(pane.submitted).toEqual(["hello there"]);
    expect(pane.box).toBe("");
  });

  test("the four receipts of the report, on an agent busy past the window: three empty boxes, then the late probes, and the last one says to wait, not to redraw", async () => {
    const { pane, clock, send } = rig("");
    // Longer than the late-probe window: each of the three sends reads on for it, then refuses.
    pane.busyUntil = clock.now + 30_000;
    // 11:51:30, :34 and :37: the probe does not show while it reads, and nothing else is typed.
    for (const gap of [0, 3_400, 3_100]) {
      clock.now += gap;
      const answer = await send("hello there");
      expect(answer.receipt).toMatchObject({ outcome: "refused", reason: "probe_failed", keys: ["probe"], saw: { turn: "idle", modal: "none", composer: "empty" } });
      expect(answer.receipt?.detail).toContain("The probe character did not show in the box.");
      expect(answer.receipt?.gapsMs.probe).toBeGreaterThanOrEqual(LATE_PROBE.ms);
      expect(answer.cause).toBeUndefined();
    }
    // 11:51:41: the agent drew the three probes by now, then went busy again before this send.
    clock.now = pane.busyUntil;
    expect((await send("", { mode: "prepare" })).surface).toMatchObject({ composer: "draft" });
    expect(pane.box).toBe(`${P}${P}${P}`);
    pane.busyUntil = clock.now + 30_000;
    const fourth = await send("hello there");
    expect(fourth.receipt).toMatchObject({ outcome: "refused", reason: "probe_failed", keys: ["probe"], saw: { turn: "idle", modal: "none", composer: "draft" } });
    expect(fourth.cause).toBe("late_keys");
    expect(fourth.receipt?.detail).toContain("the agent took those keys but showed them late, so it may be busy. Wait a moment, then send again.");
    expect(fourth.receipt?.detail).not.toContain(STALE_SCREEN);
    expect(fourth.offers).toEqual(["keys"]);
    expect(pane.submitted).toEqual([]);

    // Once the agent draws again, the next send takes Collie's four characters out and goes.
    clock.now = pane.busyUntil;
    const fifth = await send("hello there");
    expect(fifth.receipt).toMatchObject({ outcome: "sent" });
    expect(pane.submitted).toEqual(["hello there"]);
    expect(pane.box).toBe("");
  });

  test("a person's draft in a box that shows keys late still reads as a stale screen: only Collie's own characters prove a late box", async () => {
    const { pane, clock, send } = rig(`note ${P}`);
    pane.busyUntil = clock.now + 10_000;
    const answer = await send("hello there");
    expect(answer.receipt).toMatchObject({ outcome: "refused", reason: "probe_failed" });
    expect(answer.cause).toBe("stale_screen");
    expect(answer.receipt?.detail).toContain(STALE_SCREEN);
    expect(pane.submitted).toEqual([]);
  });
});
