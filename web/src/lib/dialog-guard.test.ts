import { describe, expect, it, beforeEach, vi } from "vitest";

// The GENERIC dialog guard: what every *-action module now runs. The api layer is mocked so the pane
// can be made to drift (or to belong to another agent) between the render the user tapped and the
// read the guard takes; the adapters and the fixture corpus are the real thing.
vi.mock("./api", () => ({
  fetchPane: vi.fn(),
  sendKeys: vi.fn(),
}));

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fetchPane, sendKeys } from "./api";
import { parseAnsi } from "./ansi";
import { splitLines } from "./blocks";
import { dialogDetector, sendBoundKeys, sendGuardedKeys } from "./dialog-guard";
import { buildBlocks } from "./harness";
import { DIALOG_CONTRACT, dialogModelOf, type DialogKind, type DialogModels } from "./harness/dialog-contract";
import { submitPromptOption } from "./prompt-action";

const mockFetchPane = vi.mocked(fetchPane);
const mockSendKeys = vi.mocked(sendKeys);

const PANES_DIR = join(import.meta.dirname, "..", "fixtures", "panes");
const fixture = (name: string) => readFileSync(join(PANES_DIR, name), "utf8");
const lines = (text: string) => splitLines(parseAnsi(text));

beforeEach(() => {
  vi.clearAllMocks();
  mockSendKeys.mockResolvedValue({ ok: true });
});

function pane(text: string) {
  mockFetchPane.mockResolvedValue({ paneId: "w1:p1", text, truncated: false, revision: 0 });
}

describe("dialogDetector — re-derivation goes through the agent's adapter", () => {
  const permission = fixture("claude--permission-edit.txt");

  it("finds the tail block of the asked-for kind", () => {
    const model = dialogDetector("prompt-select", "claude")(lines(permission));
    expect(model?.family).toBe("permission");
    expect(model?.signature.length).toBeGreaterThan(0);
  });

  it("returns null for a kind this screen doesn't carry", () => {
    expect(dialogDetector("menu", "claude")(lines(permission))).toBeNull();
  });

  // Fail-CLOSED: an agent with no adapter has no verified grammar, so nothing may be re-derived from
  // its buffer — and nothing typed into it. Before the guard went through the registry, each action
  // module re-derived with Claude's detector regardless of whose pane it was.
  it("re-derives NOTHING for an agent with no adapter", () => {
    expect(dialogDetector("prompt-select", "codex")(lines(permission))).toBeNull();
    expect(dialogDetector("prompt-select", undefined)(lines(permission))).toBeNull();
  });
});

describe("the guard refuses when the fresh screen isn't the tapped dialog", () => {
  const permission = fixture("claude--permission-edit.txt");
  const prompt = () => dialogDetector("prompt-select", "claude")(lines(permission))!;

  it("sends when the screen is unchanged", async () => {
    pane(permission);
    const p = prompt();

    const res = await submitPromptOption({
      paneId: "w1:p1",
      requestedLines: 200,
      detectedRevision: 0,
      agent: "claude",
      prompt: p,
      option: p.options[0]!,
    });

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys).toHaveBeenCalledWith("w1:p1", p.options[0]!.keys, undefined, p.signature);
  });

  it("refuses (and types nothing) when the pane belongs to an agent with no adapter", async () => {
    pane(permission);
    const p = prompt();

    const res = await submitPromptOption({
      paneId: "w1:p1",
      requestedLines: 200,
      detectedRevision: 0,
      agent: "codex",
      prompt: p,
      option: p.options[0]!,
    });

    expect(res).toEqual({ status: "changed" });
    expect(mockSendKeys).not.toHaveBeenCalled();
  });

  // The adapter's ARBITRATION is inherited, not re-litigated: a screen a more specific grammar now
  // claims no longer carries a prompt-select block, so the tap is refused rather than re-parsed
  // through the grammar that lost.
  it("refuses when another grammar now claims the tail", async () => {
    pane(fixture("claude--wizard-q1.txt"));
    const p = prompt();

    const res = await sendGuardedKeys(
      {
        paneId: "w1:p1",
        requestedLines: 200,
        detectedRevision: 0,
        agent: "claude",
        kind: "prompt-select",
        model: p,
      },
      p.options[0]!.keys,
    );

    expect(res).toEqual({ status: "changed" });
    expect(mockSendKeys).not.toHaveBeenCalled();
  });
});

// Claude Code 2.1.296 draws a closing rule with the session name under some dialogs in a renamed
// session (claude/closing-rule.ts). The phone renders and the guard re-derives through the same
// adapter entry point, so both read the same rows: the model the user tapped and the model the guard
// derives from the fresh read are one dialog, and the region the first write is bound to is the text
// the bridge finds in the raw read, one row above its end.
describe("a dialog in a named session is tapped, guarded and bound like an unnamed one", () => {
  const NAMED: [DialogKind, string][] = [
    ["prompt-select", "claude-lab--ask-single-named-v2296--w82.txt"],
    ["multi-select", "claude-lab--ask-multi-named-v2296--w82.txt"],
    ["wizard", "claude-lab--ask-wizard-named-v2296--w82.txt"],
    ["wizard", "claude-lab--ask-wizard-review-named-v2296--w82.txt"],
    ["menu", "claude-lab--menu-config-panel-named-v2296--w82.txt"],
    ["prompt-select", "claude-lab--menu-resume-picker-named-v2296--w82.txt"],
  ];

  /** The phone's model: what `buildBlocks` renders from this read, taken the way the card does. */
  function rendered<K extends DialogKind>(kind: K, text: string): DialogModels[K] | null {
    const blocks = buildBlocks(lines(text), { agent: "claude" });
    for (const block of blocks.toReversed()) {
      const model = dialogModelOf(block, kind);
      if (model !== null) return model;
    }
    return null;
  }

  /** Whether the guard's commits comparator calls the fresh model the tapped one, and the region the
   *  first write is bound to. Generic in the kind, so the contract row keeps its own model type. */
  function guardVerdict<K extends DialogKind>(kind: K, name: string) {
    const text = fixture(name);
    const phone = rendered(kind, text);
    const fresh = dialogDetector(kind, "claude")(lines(text));
    expect(phone, "the phone lifts the dialog").not.toBeNull();
    expect(fresh, "the guard re-derives it").not.toBeNull();
    const row = DIALOG_CONTRACT[kind];
    return {
      same: row.commits(phone!, fresh!),
      sameRegion: row.region(phone!) === row.region(fresh!),
    };
  }

  it.each(NAMED)("%s: %s re-derives to the model the phone rendered", (kind, name) => {
    expect(guardVerdict(kind, name)).toEqual({ same: true, sameRegion: true });
  });

  it.each(NAMED)("%s: %s has the model of the same screen without the rule", (kind, name) => {
    const text = fixture(name);
    // The screen an unnamed session shows: the same bytes minus the final row.
    const unnamed = text.slice(0, text.lastIndexOf("\n"));
    expect(rendered(kind, text)).toEqual(rendered(kind, unnamed));
  });

  it("sends a bound tap on a named wizard step: the region is the signature, no rule in it", async () => {
    const text = fixture("claude-lab--ask-wizard-named-v2296--w82.txt");
    pane(text);
    const model = rendered("wizard", text)!;
    const res = await sendGuardedKeys(
      { paneId: "w1:p1", requestedLines: 200, detectedRevision: 0, agent: "claude", kind: "wizard", model },
      ["1"],
    );
    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys).toHaveBeenCalledWith("w1:p1", ["1"], undefined, model.signature);
    expect(model.signature).not.toContain("capture lab");
    expect(model.signature.split("\n").some((row: string) => row.includes("capture lab"))).toBe(false);
  });

  it("refuses the tap when the named screen has moved on to a different step", async () => {
    pane(fixture("claude-lab--ask-wizard-review-named-v2296--w82.txt"));
    const model = rendered("wizard", fixture("claude-lab--ask-wizard-named-v2296--w82.txt"))!;
    const res = await sendGuardedKeys(
      { paneId: "w1:p1", requestedLines: 200, detectedRevision: 0, agent: "claude", kind: "wizard", model },
      ["1"],
    );
    expect(res).toEqual({ status: "changed" });
    expect(mockSendKeys).not.toHaveBeenCalled();
  });
});

// ADR 0080 point 7: a model that carries `styledSignature` has the guard bind its write to it too.
// A grammar with no style-only state sends the old four arguments, byte for byte.
describe("the guard binds a model's styledSignature as expected_styled", () => {
  const opencode = (name: string) => dialogDetector("prompt-select", "opencode")(lines(fixture(name)))!;
  const target = (model: ReturnType<typeof opencode>) => ({
    paneId: "w1:p1",
    requestedLines: 200,
    detectedRevision: 0,
    agent: "opencode",
    kind: "prompt-select" as const,
    model,
  });

  it("sends the styled lines of the FRESH read beside the text region", async () => {
    pane(fixture("oc--permission-bash.txt"));
    const p = opencode("oc--permission-bash.txt");
    expect(p.styledSignature).toBeDefined();

    expect(await sendGuardedKeys(target(p), p.options[0]!.keys)).toEqual({ status: "sent" });
    expect(mockSendKeys).toHaveBeenCalledWith("w1:p1", ["Enter"], undefined, p.signature, p.styledSignature);
  });

  it("refuses a tap whose chip has since moved, though the text is identical", async () => {
    pane(fixture("oc--permission-bash--moved.txt"));
    const p = opencode("oc--permission-bash.txt");
    expect(await sendGuardedKeys(target(p), p.options[0]!.keys)).toEqual({ status: "changed" });
    expect(mockSendKeys).not.toHaveBeenCalled();
  });

  it("a model with no styledSignature sends exactly the old four arguments", async () => {
    pane(fixture("claude--permission-edit.txt"));
    const p = dialogDetector("prompt-select", "claude")(lines(fixture("claude--permission-edit.txt")))!;
    expect(p.styledSignature).toBeUndefined();
    await sendGuardedKeys({ ...target(p), agent: "claude" }, p.options[0]!.keys);
    expect(mockSendKeys.mock.calls[0]).toEqual(["w1:p1", p.options[0]!.keys, undefined, p.signature]);
  });
});

// A refused write says which check refused, for a person with the console open (never UI text).
describe("sendBoundKeys: the bridge's reason on a changed prompt", () => {
  const target = { paneId: "w1:p1" };

  it("puts the bridge's reason code on the result as `why`", async () => {
    mockSendKeys.mockResolvedValueOnce({ ok: false, code: "prompt_changed", error: "moved", reason: "style_not_found" });
    expect(await sendBoundKeys(target, ["Enter"], "region", "v1\nstyled")).toEqual({
      status: "changed",
      why: "bridge: style_not_found",
    });
  });

  it("is the bare `changed` of old when the body carries no reason (an older bridge)", async () => {
    mockSendKeys.mockResolvedValueOnce({ ok: false, code: "prompt_changed", error: "moved" });
    expect(await sendBoundKeys(target, ["Enter"], "region")).toEqual({ status: "changed" });
  });
});
