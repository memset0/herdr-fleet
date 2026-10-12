import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import {
  composerDraft, composerPrompt, composerStatusLines, locateComposer, tailRule,
} from "./composer";

function fixture(name: string): StyledLine[] {
  return splitLines(parseAnsi(readFileSync(
    new URL(`../../../fixtures/panes/${name}.txt`, import.meta.url), "utf8",
  )));
}

const capture = (name: string) => fixture(`pi--omo-v5130-${name}`);
const stock = (name: string) => fixture(`pi--v0851-${name}`);

function row(value: string): StyledLine {
  return { segments: parseAnsi(value) };
}

const idle = capture("idle");
const rule = lineText(idle[0]!).trimEnd();
const blue = "\x1b[38;2;97;133;204m";

describe("OmO composer", () => {
  it("locates the editor when the captured idle tail has three status rows", () => {
    expect(locateComposer(idle)).toEqual({ layout: "omo", top: 0, bottom: 2, statusStart: 3, end: 6 });
  });

  it("returns no draft when the captured editor is empty", () => {
    expect(composerDraft(idle)).toBeNull();
  });

  it("reads the literal draft when it was typed into the real sandbox editor", () => {
    const lines = capture("draft");
    expect(composerDraft(lines)).toBe("collie composer draft probe");
    expect(composerPrompt(lines)).toBe(`${rule}\n❯ collie composer draft probe\n${rule}`);
  });

  it("binds the exact frame when terminal padding follows the prompt", () => {
    expect(composerPrompt(idle)).toBe(`${rule}\n❯\n${rule}`);
  });

  it("extracts wrapped draft text when only the editor rows change", () => {
    const lines = [idle[0]!, row(`${blue}❯\x1b[0m first draft`), row("  wrapped text"),
      row("  "), row("    indented"), ...idle.slice(2)];
    expect(composerDraft(lines)).toBe("first draft wrapped text indented");
  });

  it("binds all draft rows when a wrapped editor changes", () => {
    const lines = [idle[0]!, row(`${blue}❯\x1b[0m first`), row("  second"), ...idle.slice(2)];
    expect(composerPrompt(lines)).toBe(`${rule}\n❯ first\n  second\n${rule}`);
  });

  it.each([1, 2, 3])("accepts %i styled status rows with trailing blank padding", (count) => {
    const lines = [...idle.slice(0, 3 + count), row("  "), row("")];
    expect(tailRule(lines)).toMatchObject({ bottom: 2, statusStart: 3, end: 3 + count, palette: false });
  });

  it("preserves the captured status rows and their styling", () => {
    expect(composerStatusLines(idle)).toEqual(idle.slice(3, 6));
  });

  it.each(["single-described", "single-described-moved", "single-other-focused", "multi"])(
    "refuses typing on the %s dialog and still reads its status rows", (name) => {
      const lines = capture(name);
      expect(locateComposer(lines)).toBeNull();
      expect(composerDraft(lines)).toBeNull();
      expect(composerPrompt(lines)).toBeNull();
      expect(tailRule(lines)).toMatchObject({ bottom: 15, statusStart: 16, end: 19 });
      expect(composerStatusLines(lines)).toEqual(lines.slice(16, 19));
    },
  );

  it.each([
    ["ordinary appended output", [...idle, row("output after the status")]],
    ["a fourth status row", [...idle, row(`${blue}extra footer`)]],
    ["an intervening blank", [...idle.slice(0, 4), row(""), ...idle.slice(4)]],
    ["a boxed footer", [...idle.slice(0, 5), row(`${blue}╭────────╮`)]],
    ["a double-line boxed footer", [...idle.slice(0, 5), row(`${blue}╔════════╗`)]],
    ["an unstyled continuation", [...idle.slice(0, 5), row("ordinary output")]],
    ["unstyled status fields", [...idle.slice(0, 3), row("cwd • model")]],
    ["a box bottom instead of a plain rule", [idle[0]!, idle[1]!, row(`${blue}╰────────╯`), ...idle.slice(3)]],
  ])("rejects the unknown tail when it contains %s", (_name, lines) => {
    expect(locateComposer(lines)).toBeNull();
    expect(composerStatusLines(lines)).toEqual([]);
  });

  it.each([
    ["indented prompt", row(`${blue} ❯ draft`)],
    ["unstyled prompt", row("❯ draft")],
    ["dialog choice", row(`${blue} → 1. Choice`)],
  ])("refuses the editor when its prompt is a %s", (_name, prompt) => {
    expect(locateComposer([idle[0]!, prompt, ...idle.slice(2)])).toBeNull();
  });

  it("refuses a boxed continuation when an apparent composer encloses it", () => {
    const lines = [idle[0]!, idle[1]!, row("  │ dialog │"), ...idle.slice(2)];
    expect(locateComposer(lines)).toBeNull();
  });

  it("refuses mismatched rule styling when the frame is torn", () => {
    expect(locateComposer([row(`\x1b[31m${rule}`), ...idle.slice(1)])).toBeNull();
  });

  it("refuses a missing top rule when only the prompt remains", () => {
    expect(locateComposer(idle.slice(1))).toBeNull();
  });

  it("refuses an overlong editor when its prompt lies beyond the scan bound", () => {
    const lines = [idle[0]!, idle[1]!, ...Array.from({ length: 100 }, () => row("  text")),
      ...idle.slice(2)];
    expect(locateComposer(lines)).toBeNull();
  });

  it("refuses an empty buffer", () => {
    expect(tailRule([])).toBeNull();
    expect(locateComposer([])).toBeNull();
  });
});

describe("stock pi composer", () => {
  it("locates the stock pi editor when the draft row carries no prompt glyph", () => {
    const lines = stock("idle");
    expect(locateComposer(lines)).toEqual({ layout: "stock", top: 0, bottom: 2, statusStart: 3, end: 5 });
    expect(composerDraft(lines)).toBeNull();
    expect(composerStatusLines(lines)).toEqual(lines.slice(3, 5));
  });

  it("reads the literal draft when it was typed into a real stock pi editor", () => {
    const lines = stock("draft");
    expect(composerDraft(lines)).toBe("collie stock pi draft probe");
    expect(composerPrompt(lines)?.split("\n")[1]).toBe("collie stock pi draft probe");
  });

  it("keeps the editor when a running turn labels the top rule", () => {
    // The label sits inside a rule of the editor's own width and colour (pi--v085-working-editor.txt).
    const labelled = (lines: StyledLine[], label: string): StyledLine[] => {
      const width = lineText(lines[0]!).trimEnd().length;
      const segment = lines[0]!.segments.find((s) => s.text.trim() !== "")!;
      const text = `── ${label} ${"─".repeat(width - label.length - 4)}`;
      return [{ segments: [{ ...segment, text }] }, ...lines.slice(1)];
    };
    expect(locateComposer(labelled(stock("draft"), "⠴ Working"))?.top).toBe(0);
    expect(locateComposer(labelled(idle, "• Working"))?.top).toBe(0);
  });

  it("refuses a stock layout when a row between the rules opens with a space", () => {
    const lines = [...stock("idle").slice(0, 1), row(" Ask user · 30m"), ...stock("idle").slice(2)];
    expect(locateComposer(lines)).toBeNull();
  });

  it("reads a draft with a blank row and indented rows, one space per seam (canary 04 and 07)", () => {
    const lines = stock("draft");
    const draft = (rows: string[]) => composerDraft([lines[0]!, ...rows.map((r) => row(r)), ...lines.slice(2)]);
    expect(draft(["Reply with only OK.", "", "A paragraph after a blank line."])).toBe(
      "Reply with only OK. A paragraph after a blank line.",
    );
    expect(draft(["Reply with only OK.", "    indented code line", "    another indented line"])).toBe(
      "Reply with only OK. indented code line another indented line",
    );
  });

  it("refuses a stock editor whose first row is indented: that is a panel, not a draft", () => {
    const lines = stock("draft");
    expect(locateComposer([lines[0]!, row("    indented first"), row("second"), ...lines.slice(2)])).toBeNull();
    expect(locateComposer([lines[0]!, row(""), row(" Pick a color?"), row("> 1. Red"), ...lines.slice(2)])).toBeNull();
  });

  it("passes over a shorter pasted rule inside the draft and finds the editor's own top rule", () => {
    const lines = stock("draft");
    const pasted = [lines[0]!, row("before"), row("─".repeat(15)), row("after"), ...lines.slice(2)];
    expect(locateComposer(pasted)?.top).toBe(0);
    expect(composerDraft(pasted)).toBe(`before ${"─".repeat(15)} after`);
  });
});

// The PR 397 captures (pi 1.1.0 with the contributor's question extension, fixtures README): a
// one-row powerbar status line, pi's default two-row footer, a multi-row draft, the running turn and
// the slash palette.
describe("pi 1.1.0 composer (PR 397 captures)", () => {
  it.each([
    ["pi--v110-idle", null, 1],
    ["pi--v110-idle-default-footer", null, 2],
    ["pi--v110-narrow-idle", null, 1],
    ["pi--v110-draft", "Add unit tests for the parser", 1],
    ["pi--v110-draft-multiline", "Add unit tests for the parser and verify edge cases", 1],
    ["pi--v110-working", null, 1],
  ])("reads %s as a stock editor", (name, draft, status) => {
    const lines = fixture(name);
    expect(locateComposer(lines)?.layout).toBe("stock");
    expect(composerDraft(lines)).toBe(draft);
    expect(composerStatusLines(lines)).toHaveLength(status);
    expect(composerPrompt(lines)).not.toBeNull();
  });

  it("reads the slash palette under the editor and leaves the frame unbound past the tail window", () => {
    const lines = fixture("pi--v110-slash-palette");
    const composer = locateComposer(lines);
    expect(composer).not.toBeNull();
    expect(tailRule(lines)?.palette).toBe(true);
    expect(composerDraft(lines)).toBe("/");
    // Six palette rows and the status row sit under the bottom rule: the bridge binds a region only
    // within the last six non-blank rows, so the write goes unbound rather than 409 every time.
    expect(composerPrompt(lines)).toBeNull();
    expect(composerStatusLines(lines)).toHaveLength(1);
  });

  it("refuses a palette under a draft that is not a slash command", () => {
    const lines = fixture("pi--v110-slash-palette");
    const composer = locateComposer(lines)!;
    const edited = [...lines.slice(0, composer.top + 1), row("plain text"), ...lines.slice(composer.bottom)];
    expect(locateComposer(edited)).toBeNull();
  });

  it("keeps the editor when a scrolled editor writes its overflow into the top rule", () => {
    const lines = fixture("pi--v110-draft");
    const composer = locateComposer(lines)!;
    const width = lineText(lines[composer.bottom]!).trimEnd().length;
    const mark = `─── ↑ 2 more ${"─".repeat(width - 13)}`;
    const ruleSegment = lines[composer.top]!.segments.find((s) => s.text.trim() !== "")!;
    const scrolled = [
      ...lines.slice(0, composer.top), { segments: [{ ...ruleSegment, text: mark }] }, ...lines.slice(composer.top + 1),
    ];
    expect(composerDraft(scrolled)).toBe("Add unit tests for the parser");
  });
});
