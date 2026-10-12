import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import { promptsEqual, promptsSameIdentity, type PromptModel } from "../prompt-model";
import { detectPiQuestion, piModalOnScreen, readPiFrame } from "./ask";

const PANES = join(import.meta.dirname, "../../../fixtures/panes");
const raw = (name: string) => readFileSync(join(PANES, name), "utf8");
const linesOf = (text: string) => splitLines(parseAnsi(text));
/** Replace the LAST occurrence: the stock captures echo the question and options in the tool call above
 *  the dialog, and a mutation must land in the dialog. */
function replaceLast(text: string, from: string, to: string): string {
  const at = text.lastIndexOf(from);
  if (at < 0) throw new Error(`no ${JSON.stringify(from)} in the capture`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}
const load = (name: string) => linesOf(raw(name));

function prompt(lines: StyledLine[]): PromptModel {
  const question = detectPiQuestion(lines);
  if (question?.kind !== "prompt-select") throw new Error("no prompt-select lifted");
  return question.model;
}

const PI_FIXTURES = readdirSync(PANES).filter((name) => name.startsWith("pi--") && name.endsWith(".txt")).toSorted();

// What every pi screen in the corpus reads as. `walk` is plan (a), arrows then Enter; `digit` is plan
// (b), the digit OmO's footer names; `review` is a Submit page lifted as a wizard review. Everything
// else is `raw`, and `modal` says whether the unread-dialog card may offer Escape.
type Expect = "walk" | "digit" | "review" | "raw";
const LIFTS = new Map<string, Expect>([
  // pi's stock `question` example, pi 0.87.1 and 1.1.0 (live captures 2026-10-12).
  ["question-single", "walk"],
  ["question-single-moved", "walk"],
  ["question-plain", "walk"],
  ["question-plain-moved", "walk"],
  ["question-narrow", "walk"],
  ["question-narrow-moved", "walk"],
  // pi's stock `questionnaire` example: one question, then the tabbed pages and the Submit page.
  ["questionnaire-single", "walk"],
  ["questionnaire-single-moved", "walk"],
  ["questionnaire-tabs", "walk"],
  ["questionnaire-tabs-moved", "walk"],
  ["questionnaire-tabs-second", "walk"],
  ["questionnaire-tabs-second-moved", "walk"],
  ["questionnaire-tabs-answered", "walk"],
  ["questionnaire-submit-ready", "review"],
]);
const LIFTS_397 = new Map<string, Expect>([
  ["pi--v110-single.txt", "walk"],
  ["pi--v110-single-desc.txt", "walk"],
  ["pi--v110-single-moved.txt", "walk"],
  ["pi--v110-single-narrow.txt", "walk"],
  ["pi--v110-tabs-single.txt", "walk"],
  ["pi--v110-tabs-single-recorded.txt", "walk"],
  ["pi--v110-tabs-compact.txt", "walk"],
  ["pi--v110-review-complete.txt", "review"],
  ["pi--omo-v5130-single-described.txt", "digit"],
  ["pi--omo-v5130-single-described-moved.txt", "digit"],
]);
/** Screens with a pi modal up that stay raw: the Escape card's evidence. */
const RAW_MODALS = new Set([
  "pi--omo-v5130-answer-editor.txt",
  "pi--omo-v5130-multi.txt",
  "pi--omo-v5130-single-other-focused.txt",
  "pi--v110-core-selector.txt",
  "pi--v110-multi.txt",
  "pi--v110-multi-ticked.txt",
  "pi--v110-multi-moved.txt",
  "pi--v110-multi-pointer-other.txt",
  "pi--v110-multi-editor-open.txt",
  "pi--v110-single-editor-open.txt",
  "pi--v110-tabs-editor-open.txt",
  "pi--v110-tabs-multi.txt",
  "pi--v110-review-incomplete.txt",
  ...["v0871", "v110"].flatMap((v) => [
    `pi--${v}-question-other-focused.txt`,
    `pi--${v}-question-answer-editor.txt`,
    `pi--${v}-question-answer-editor-typed.txt`,
    `pi--${v}-questionnaire-answer-editor.txt`,
    `pi--${v}-questionnaire-submit-incomplete.txt`,
  ]),
]);

function expected(name: string): Expect {
  const stock = /^pi--v(?:0871|110)-(question.*)\.txt$/.exec(name);
  const state = stock?.[1];
  return (state === undefined ? undefined : LIFTS.get(state)) ?? LIFTS_397.get(name) ?? "raw";
}

function actual(lines: StyledLine[]): Expect {
  const question = detectPiQuestion(lines);
  if (question === null) return "raw";
  if (question.kind === "wizard") return "review";
  return question.model.options[0]!.keys.every((k) => /^[1-9]$/.test(k)) ? "digit" : "walk";
}

describe("every pi screen in the corpus", () => {
  it("covers both stock versions and both contributed corpora", () => {
    for (const prefix of ["pi--v0871-question-", "pi--v110-question", "pi--v110-single", "pi--omo-v5130-"]) {
      expect(PI_FIXTURES.some((name) => name.startsWith(prefix)), prefix).toBe(true);
    }
  });

  it.each(PI_FIXTURES)("%s reads as expected", (name) => {
    const lines = load(name);
    expect(actual(lines)).toBe(expected(name));
    const modal = expected(name) !== "raw" || RAW_MODALS.has(name);
    expect(piModalOnScreen(lines)).toBe(modal);
  });
});

describe("plan (a): arrows move and Enter selects", () => {
  it("walks the stock question with arrows and Enter, offers Esc as Cancel, and keeps the free-text row a field", () => {
    const model = prompt(load("pi--v0871-question-single.txt"));
    expect(model.question).toBe("Pick a color for the Collie probe?");
    expect(model.family).toBe("select");
    expect(model.options).toEqual([
      { label: "Red", description: "Warm and loud.", keys: ["Enter"], keyLabel: ">" },
      { label: "Green", description: "Calm and natural.", keys: ["Down", "Enter"], keyLabel: "" },
      { label: "Blue", description: "Cool and deep.", keys: ["Down", "Down", "Enter"], keyLabel: "" },
      { label: "Cancel", keys: ["Escape"], keyLabel: "Esc" },
    ]);
    expect(model.feedback).toEqual({ key: "", focused: false, text: "", purpose: "free-text" });
    // The free-text row is one more arrow stop below the last option, so the ends are not proven to
    // clamp at the option list (pi's stock question.ts clamps over every row, the free-text one too).
    expect(model.clampedEnds).toBeUndefined();
  });

  it("walks from the moved pointer in both directions", () => {
    expect(prompt(load("pi--v110-question-single-moved.txt")).options.map((o) => o.keys)).toEqual([
      ["Up", "Enter"], ["Enter"], ["Down", "Enter"], ["Escape"],
    ]);
  });

  it("reads the PR 397 extension's footer, where digits are only typed text, as plan (a)", () => {
    const model = prompt(load("pi--v110-single-desc.txt"));
    expect(model.options.at(-1)).toEqual({ label: "Cancel", keys: ["Escape"], keyLabel: "Esc" });
    expect(model.options.every((o) => o.keys.every((k) => !/^[0-9]$/.test(k)))).toBe(true);
  });

  it("reads a footer wrapped over two rows at 50 columns", () => {
    expect(prompt(load("pi--v110-single-narrow.txt")).options).toHaveLength(5);
    expect(prompt(load("pi--v0871-question-narrow.txt")).options).toHaveLength(4);
  });

  it("captions a tabbed page with the chip the background colour marks", () => {
    expect(prompt(load("pi--v0871-questionnaire-tabs.txt")).caption).toBe("Color");
    expect(prompt(load("pi--v110-questionnaire-tabs-second.txt")).caption).toBe("Size");
    expect(prompt(load("pi--v110-tabs-single.txt")).caption).toBe("Auth");
    expect(prompt(load("pi--v0871-questionnaire-single.txt")).caption).toBeUndefined();
  });
});

describe("plan (b): the digit the footer names", () => {
  const single = raw("pi--omo-v5130-single-described.txt");

  it("offers the printed digit alone on OmO's one-question dialog", () => {
    const model = prompt(linesOf(single));
    expect(model.question).toBe("Pick a color for the Collie sandbox probe?");
    expect(model.options).toEqual([
      { label: "Red (Recommended)", description: "Warm color.", keys: ["1"] },
      { label: "Green", description: "Cool color.", keys: ["2"] },
      { label: "Blue", description: "Deep color.", keys: ["3"] },
      { label: "Cancel", keyLabel: "Esc", keys: ["Escape"] },
    ]);
    expect(model.feedback).toEqual({ key: "", focused: false, text: "", purpose: "free-text" });
  });

  it("keeps the digits when the desk pointer moves, and still tells the two screens apart", () => {
    const first = prompt(linesOf(single));
    const moved = prompt(load("pi--omo-v5130-single-described-moved.txt"));
    expect(moved.options).toEqual(first.options);
    expect(promptsEqual(first, moved)).toBe(false);
    expect(promptsSameIdentity(first, moved)).toBe(true);
  });

  it.each([
    ["several question chips", replaceLast(single, "Submit\x1b", "Size    Submit\x1b")],
    ["a counter of two questions", replaceLast(single, "(0/1 answered)", "(0/2 answered)")],
    ["an answered question", replaceLast(single, "(0/1 answered)", "(1/1 answered)")],
  ])("declines the digit on %s", (_name, text) => {
    expect(detectPiQuestion(linesOf(text))).toBeNull();
  });

  it("walks instead when the same footer names Enter as select: plan (a) wins over the digits", () => {
    const model = prompt(linesOf(replaceLast(single, " next\x1b", " select\x1b")));
    expect(model.options.map((o) => o.keys)).toEqual([["Enter"], ["Down", "Enter"], ["Down", "Down", "Enter"], ["Escape"]]);
  });

  it("does not care what the dialog is called: the reader names no extension", () => {
    for (const text of [replaceLast(single, "Ask user", "Model picker"), replaceLast(single, "Warm color.", "Warm.")]) {
      expect(detectPiQuestion(linesOf(text))?.kind).toBe("prompt-select");
    }
  });
});

describe("the shape declines anything unexpected", () => {
  const omo = raw("pi--omo-v5130-single-described.txt");
  const stock = raw("pi--v0871-question-single.txt");

  it.each([
    ["noncontiguous numbers", replaceLast(omo, "2. \x1b", "4. \x1b")],
    ["a tenth option", replaceLast(omo, "3. \x1b", "10. \x1b")],
    ["a missing free-text row", replaceLast(omo, "Type your own answer...", "Unknown action")],
    ["a missing pointer", replaceLast(omo, "→ \x1b", "  \x1b")],
    ["an unknown footer key", replaceLast(omo, "mspace\x1b", "mf5\x1b")],
    ["a stock gap in the numbers", replaceLast(stock, "3. Blue", "5. Blue")],
    ["a second pointer", replaceLast(stock, "  \x1b[0m\x1b[38;2;212;212;212m2. Green", "\x1b[0m\x1b[38;2;138;190;183m> 2. Green")],
    ["a footer without Esc", replaceLast(stock, " • Esc to cancel", "")],
    ["a footer without Enter", replaceLast(stock, "Enter to select • ", "")],
    ["Enter named as next", replaceLast(stock, "Enter to select", "Enter next")],
    ["Up/Down named as scroll", replaceLast(stock, "navigate", "scroll")],
    ["a free-text row before the last option", replaceLast(replaceLast(stock, "3. Blue", "3. Type something."), "4. Type something.", "4. Blue")],
  ])("declines %s", (_name, text) => {
    expect(detectPiQuestion(linesOf(text))).toBeNull();
  });

  it("does not lift a dialog once plain output follows its status rows", () => {
    for (const name of ["pi--omo-v5130-single-described.txt", "pi--v0871-question-single.txt"]) {
      const output: StyledLine = { segments: [{ text: "Agent resumed", style: {}, muted: false }] };
      expect(detectPiQuestion([...load(name), output])).toBeNull();
    }
  });

  it("declines a multi-select by its checkboxes, or by a footer that toggles with Space", () => {
    expect(detectPiQuestion(load("pi--v110-multi.txt"))).toBeNull();
    expect(detectPiQuestion(load("pi--omo-v5130-multi.txt"))).toBeNull();
    const toggles = replaceLast(omo, "space\x1b[0m\x1b[38;2;157;165;169m select", "space\x1b[0m\x1b[38;2;157;165;169m toggle");
    expect(toggles).not.toBe(omo);
    expect(detectPiQuestion(linesOf(toggles))).toBeNull();
  });

  it("leaves a pointer on the free-text row raw", () => {
    expect(detectPiQuestion(load("pi--v0871-question-other-focused.txt"))).toBeNull();
    expect(detectPiQuestion(load("pi--omo-v5130-single-other-focused.txt"))).toBeNull();
  });
});

describe("the Submit page", () => {
  it("lifts a complete Submit page as a wizard review that sends Enter or Escape", () => {
    const question = detectPiQuestion(load("pi--v0871-questionnaire-submit-ready.txt"));
    expect(question?.kind).toBe("wizard");
    if (question?.kind !== "wizard" || question.model.phase !== "review") throw new Error("no review lifted");
    expect(question.model).toMatchObject({
      phase: "review",
      steps: [{ label: "Color", answered: true }, { label: "Size", answered: true }],
      answers: [{ question: "Color", answer: "Green" }, { question: "Size", answer: "Small" }],
      incomplete: false,
      submitKeys: ["Enter"],
      cancelKeys: ["Escape"],
    });
    expect(question.model.cancelLabel).toBeUndefined();
  });

  it("reads the PR 397 review rows (`1. Auth      OAuth 2.0 / OIDC`)", () => {
    const question = detectPiQuestion(load("pi--v110-review-complete.txt"));
    if (question?.kind !== "wizard" || question.model.phase !== "review") throw new Error("no review lifted");
    expect(question.model.answers.map((a) => a.answer)).toEqual([
      "OAuth 2.0 / OIDC", "Audit logs", "Cloudflare Workers",
    ]);
  });

  it("keeps an incomplete Submit page raw", () => {
    for (const name of ["pi--v0871-questionnaire-submit-incomplete.txt", "pi--v110-review-incomplete.txt"]) {
      expect(detectPiQuestion(load(name))).toBeNull();
    }
  });
});

describe("signatures", () => {
  it("binds the dialog's own rows, rule to rule, and leaves the status rows below it unbound", () => {
    const lines = load("pi--omo-v5130-single-described.txt");
    const question = detectPiQuestion(lines);
    expect(question?.startLine).toBe(0);
    expect(question?.model.signature).toBe(lines.slice(0, 16).map((line) => lineText(line).trimEnd()).join("\n"));
    expect(readPiFrame(lines)).toMatchObject({ top: 0, bottom: 15 });
  });

  it("blanks the pointer in coreSignature and keeps it in signature", () => {
    for (const [a, b] of [
      ["pi--v0871-question-single.txt", "pi--v0871-question-single-moved.txt"],
      ["pi--v110-questionnaire-tabs.txt", "pi--v110-questionnaire-tabs-moved.txt"],
      ["pi--v110-single-desc.txt", "pi--v110-single-moved.txt"],
    ] as const) {
      const first = prompt(load(a));
      const moved = prompt(load(b));
      expect(first.coreSignature, a).toBe(moved.coreSignature);
      expect(first.signature, a).not.toBe(moved.signature);
    }
  });

  it("blanks OmO's countdown in coreSignature only", () => {
    const single = raw("pi--omo-v5130-single-described.txt");
    const model = prompt(linesOf(single));
    const later = prompt(linesOf(replaceLast(single, "30m", "29m")));
    expect(later.coreSignature).toBe(model.coreSignature);
    expect(later.signature).not.toBe(model.signature);
    expect(promptsEqual(model, later)).toBe(false);
  });

  it("moves both signatures when the question or an option changes", () => {
    const stock = raw("pi--v0871-question-single.txt");
    const model = prompt(linesOf(stock));
    for (const changed of [replaceLast(stock, "Pick a color", "Choose a color"), replaceLast(stock, "Calm and natural.", "Calm.")]) {
      const fresh = prompt(linesOf(changed));
      expect(fresh.coreSignature).not.toBe(model.coreSignature);
      expect(promptsSameIdentity(model, fresh)).toBe(false);
    }
  });
});

describe("piModalOnScreen", () => {
  it("is false on every editor, idle, typed into, running or with the palette open", () => {
    for (const name of [
      "pi--v0871-idle.txt", "pi--v0871-draft.txt", "pi--v110-stock-idle.txt", "pi--v110-working.txt",
      "pi--v110-slash-palette.txt", "pi--omo-v5130-idle.txt", "pi--v0871-question-answered.txt",
    ]) {
      expect(piModalOnScreen(load(name)), name).toBe(false);
    }
  });

  it("is true on an inline answer editor, which says Esc goes back", () => {
    const lines = load("pi--v0871-question-answer-editor.txt");
    expect(readPiFrame(lines)?.footer.escapeVerb).toBe("go back");
    expect(piModalOnScreen(lines)).toBe(true);
  });

  it("is true on pi's own /model picker", () => {
    expect(piModalOnScreen(load("pi--v110-core-selector.txt"))).toBe(true);
  });
});

// Agent prose can quote a whole dialog: a real dialog's own rows (pi--prose-*, built from the real
// captures, see the fixtures README) in the reply, in a tool result, or left at the tail after pi exited.
describe("a quoted dialog is not a dialog", () => {
  it.each([
    "pi--prose-quoted-dialog-above-editor.txt",
    "pi--prose-quoted-omo-dialog-above-editor.txt",
    "pi--prose-quoted-dialog-in-tool-result.txt",
  ])("%s: the real editor below wins, nothing lifts and no modal is claimed", (name) => {
    const lines = load(name);
    expect(detectPiQuestion(lines)).toBeNull();
    expect(readPiFrame(lines)).toBeNull();
    expect(piModalOnScreen(lines)).toBe(false);
  });

  /** The quoted block alone at the tail, nothing under its bottom rule: the shell fixture without its
   *  prompt. Not a fixture of its own, because agy's generic menu claims that screen (a foreign claim
   *  the agy suite would fail on); the pi reader is what this file pins. */
  const atTail = () => {
    const lines = load("pi--prose-quoted-dialog-then-shell.txt");
    const bottom = lines.findLastIndex((line) => /^─{8,}$/.test(lineText(line).trimEnd()));
    return lines.slice(0, bottom + 1);
  };

  it("with no editor below, the tail rules refuse the quoted block, with a shell prompt under it or nothing", () => {
    for (const lines of [load("pi--prose-quoted-dialog-then-shell.txt"), atTail()]) {
      expect(detectPiQuestion(lines)).toBeNull();
      expect(piModalOnScreen(lines)).toBe(false);
    }
    expect(lineText(atTail().at(-1)!)).toMatch(/^─{8,}/);
  });

  // Without an editor below, the quoted rows lift only when EVERY tail rule holds: one to four
  // styled, non-rule rows under the bottom rule and nothing else; two full rules of one length and
  // colour; a styled footer row of known key hints that names Esc, at most one blank row above the
  // bottom rule; and the option shape. That is pi's own screen, so a styled row under a quoted block
  // is the one case the screen cannot tell apart. A walked tap there still sends no Enter: the pointer
  // never moves, the poll times out (lib/prompt-action.ts).
  it("states the limit: a quoted block at the tail lifts only when every tail rule holds", () => {
    const quoted = atTail();
    const styled = (t: string): StyledLine => ({ segments: [{ text: t, style: {}, muted: true }] });
    const plain: StyledLine = { segments: [{ text: "$ ", style: {}, muted: false }] };
    expect(detectPiQuestion(quoted)).toBeNull();
    expect(detectPiQuestion([...quoted, plain])).toBeNull();
    expect(detectPiQuestion([...quoted, styled("a"), plain])).toBeNull();
    expect(detectPiQuestion([...quoted, ...["a", "b", "c", "d", "e"].map(styled)])).toBeNull();
    expect(detectPiQuestion([...quoted, styled("─".repeat(20))])).toBeNull();
    expect(detectPiQuestion([...quoted, styled("/tmp/project")])?.kind).toBe("prompt-select");
  });

  it("does not take key hints typed into a draft for a footer", () => {
    const draft = raw("pi--v0871-draft.txt");
    const typed = replaceLast(draft, "collie stock pi draft probe", "see this:\r\n ↑↓ navigate • Enter to select • Esc to cancel");
    const lines = linesOf(typed);
    expect(piModalOnScreen(lines)).toBe(false);
    expect(detectPiQuestion(lines)).toBeNull();
  });
});
