import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { splitLines, type Block, type StyledLine } from "../../blocks";
import { withoutClaudeManageHint } from "../../fleet-claude-mode-line";
import { withUnreadDialog } from "../index";
import { namesAMenuKey } from "../menu-hints";
import { claudeAdapter } from "./index";

// Claude Code 2.1.286's own key hints on the mode line (FORK.toml `claude-manage-hint-port`,
// openspec/specs/fleet-harness-compat). The two working screens are SYNTHETIC — hand-built in the
// shape of upstream's `claude--draft-footer-single.txt`, kept out of upstream's corpus directory so
// none of its hand-curated tables has to learn them. The dialogs are upstream's own captures.

const FLEET_PANES = join(import.meta.dirname, "..", "..", "..", "fixtures", "fleet-panes");
const UPSTREAM_PANES = join(import.meta.dirname, "..", "..", "..", "fixtures", "panes");

const linesOf = (text: string): StyledLine[] => splitLines(parseAnsi(text));
const fleetText = (name: string): string => readFileSync(join(FLEET_PANES, name), "utf8");
const upstreamText = (name: string): string => readFileSync(join(UPSTREAM_PANES, name), "utf8");

/** The unread-dialog post-pass exactly as `buildBlocks` composes it for a Claude pane. */
const pass = (lines: StyledLine[]): Block[] =>
  withUnreadDialog(claudeAdapter, lines, claudeAdapter.buildBlocks(lines));

const MODE = "  ⏵⏵ bypass permissions on (shift+tab to cycle)";

describe("withoutClaudeManageHint", () => {
  it("drops the whole hint after the mode text and the agent count", () => {
    expect(withoutClaudeManageHint(`${MODE} · ← 2 agents · ↓ to manage`)).toBe(`${MODE} · ← 2 agents`);
    expect(withoutClaudeManageHint(`${MODE} · ← 1 agent · ↓ to manage`)).toBe(`${MODE} · ← 1 agent`);
  });

  it.each(["↓ to ma…", "↓ to manag…", "↓ to…", "↓ to …", "↓ to manage…"])("drops the clipped hint %s", (clip) => {
    expect(withoutClaudeManageHint(`${MODE} · ← 2 agents · ${clip}`)).toBe(`${MODE} · ← 2 agents`);
  });

  it.each([
    "⏵⏵ accept edits on (shift+tab to cycle)",
    "⏸ plan mode on (shift+tab to cycle)",
    "⏵⏵ auto mode on (shift+tab to cycle)",
    "⏸ manual mode on",
  ])("follows every permission-mode text: %s", (mode) => {
    expect(withoutClaudeManageHint(`  ${mode} · ← 3 agents · ↓ to manage`)).toBe(`  ${mode} · ← 3 agents`);
  });

  it("keeps a notice Claude right-aligned after the hint, so upstream still reads it", () => {
    const notice = "                    new task? /clear to save 120.0k tokens";
    expect(withoutClaudeManageHint(`${MODE} · ← 2 agents · ↓ to manage${notice}`)).toBe(
      `${MODE} · ← 2 agents${notice}`,
    );
  });

  // Overturned by widen-claude-mode-line-hint: these two rows were left unchanged while the rule
  // required an agent count before the hint. The mode text alone now marks Claude's own line.
  it.each([
    ["no agent count before it", `${MODE} · ↓ to manage`, MODE],
    ["a count that is not a number", `${MODE} · ← for agents · ↓ to manage`, `${MODE} · ← for agents`],
  ])("drops the hint with %s", (_case, row, expected) => {
    expect(withoutClaudeManageHint(row)).toBe(expected);
    expect(namesAMenuKey(withoutClaudeManageHint(row))).toBe(false);
  });

  it.each([
    ["no mode text before it", "  ← 2 agents · ↓ to manage"],
    ["the hint alone", "  ↓ to manage"],
    ["a dialog footer", "   ↑/↓ to select · Enter to view · ↓ to manage"],
    ["a different verb", `${MODE} · ← 2 agents · ↓ to view`],
    ["the hint not last", `${MODE} · ← 2 agents · ↓ to manage · Esc to cancel`],
    ["Esc to cancel after the mode text", `${MODE} · Esc to cancel`],
    ["a different interrupt verb", `${MODE} · esc to stop`],
    ["the interrupt hint without mode text", "  esc to interrupt · ← for agents"],
  ])("keeps upstream's reading with %s", (_case, row) => {
    expect(namesAMenuKey(withoutClaudeManageHint(row))).toBe(namesAMenuKey(row));
  });

  it.each([
    ["no mode text before it", "  ← 2 agents · ↓ to manage"],
    ["the hint alone", "  ↓ to manage"],
    ["a dialog footer", "   ↑/↓ to select · Enter to view · ↓ to manage"],
    ["a different verb", `${MODE} · ← 2 agents · ↓ to view`],
    ["Esc to cancel after the mode text", `${MODE} · Esc to cancel`],
    ["the interrupt hint without mode text", "  esc to interrupt · ← for agents"],
  ])("returns the row unchanged with %s", (_case, row) => {
    expect(withoutClaudeManageHint(row)).toBe(row);
    expect(namesAMenuKey(row)).toBe(true);
  });

  it("drops both of Claude's hints from the working-turn mode line", () => {
    const row = `${MODE} · esc to interrupt · ← for agents · ↓ to manage`;
    expect(namesAMenuKey(row)).toBe(true);
    expect(withoutClaudeManageHint(row)).toBe(`${MODE} · ← for agents`);
    expect(namesAMenuKey(withoutClaudeManageHint(row))).toBe(false);
  });

  it.each(["↓ to ma…", "↓ to…", "↓ to manage…"])("drops both hints with the manage hint clipped to %s", (clip) => {
    expect(withoutClaudeManageHint(`${MODE} · esc to interrupt · ← for agents · ${clip}`)).toBe(
      `${MODE} · ← for agents`,
    );
  });

  it.each(["↓ t…", "↓…"])("keeps a clip shorter than `<key> to` (%s), which names no key upstream", (clip) => {
    const row = `${MODE} · esc to interrupt · ← for agents · ${clip}`;
    expect(withoutClaudeManageHint(row)).toBe(`${MODE} · ← for agents · ${clip}`);
    expect(withoutClaudeManageHint(`${MODE} · esc t…`)).toBe(`${MODE} · esc t…`);
  });

  it("drops the interrupt hint alone, and a clip of it as the last segment", () => {
    expect(withoutClaudeManageHint(`${MODE} · esc to interrupt`)).toBe(MODE);
    expect(withoutClaudeManageHint(`${MODE} · esc to interrupt · ← 2 agents`)).toBe(`${MODE} · ← 2 agents`);
    expect(withoutClaudeManageHint(`${MODE} · esc to inter…`)).toBe(MODE);
    expect(withoutClaudeManageHint(`${MODE} · esc to…`)).toBe(MODE);
  });

  it("keeps a trailing Esc to cancel under upstream's reading after dropping the hints", () => {
    const row = `${MODE} · esc to interrupt · ← 2 agents · ↓ to manage · Esc to cancel`;
    expect(withoutClaudeManageHint(row)).toBe(`${MODE} · ← 2 agents · ↓ to manage · Esc to cancel`);
    expect(namesAMenuKey(withoutClaudeManageHint(row))).toBe(true);
  });

  it("leaves every other segment of the mode line under upstream's reading", () => {
    const row = `${MODE} · Esc to cancel · ← 2 agents · ↓ to manage`;
    expect(withoutClaudeManageHint(row)).toBe(`${MODE} · Esc to cancel · ← 2 agents`);
    expect(namesAMenuKey(withoutClaudeManageHint(row))).toBe(true);
  });
});

describe("a working screen carrying the hint", () => {
  it.each([
    "claude--manage-hint--w120.txt",
    "claude--manage-hint--w73.txt",
    "claude--v2286-agents-interrupt-manage-hint--w120.txt",
    "claude--v2286-agents-interrupt-manage-hint--w93.txt",
  ])(
    "%s: the composer is ready, no modal is reported, no card is drawn",
    (name) => {
      const lines = linesOf(fleetText(name));
      expect(claudeAdapter.composerReady!(lines)).toBe(true);
      expect(claudeAdapter.modalOnScreen!(lines)).toBe(false);
      expect(pass(lines).map((b) => b.kind)).toEqual(["raw"]);
    },
  );

  it("still reads as a working screen with a right-aligned notice after the hint", () => {
    const text = fleetText("claude--manage-hint--w120.txt").replace(
      "↓ to manage",
      "↓ to manage" + " ".repeat(10) + "new task? /clear to save 120.0k tokens",
    );
    const lines = linesOf(text);
    expect(claudeAdapter.composerReady!(lines)).toBe(true);
    expect(claudeAdapter.modalOnScreen!(lines)).toBe(false);
  });
});

describe("a working-turn screen carrying only one of Claude's two hints", () => {
  const INTERRUPT_FIXTURE = "claude--v2286-agents-interrupt-manage-hint--w120.txt";
  const BOTH = " · esc to interrupt · ← for agents · ↓ to manage";

  it.each([
    ["only the manage hint", " · ← for agents · ↓ to manage"],
    ["only esc to interrupt", " · esc to interrupt"],
    ["esc to interrupt before the agents segment", " · esc to interrupt · ← for agents"],
  ])("%s: the composer is ready, no modal is reported, no card is drawn", (_case, tail) => {
    const text = fleetText(INTERRUPT_FIXTURE);
    expect(text).toContain(BOTH);
    const lines = linesOf(text.replace(BOTH, tail));
    expect(claudeAdapter.composerReady!(lines)).toBe(true);
    expect(claudeAdapter.modalOnScreen!(lines)).toBe(false);
    expect(pass(lines).map((b) => b.kind)).toEqual(["raw"]);
  });

  it("a real key hint after them on the mode line still refuses the box", () => {
    const text = fleetText(INTERRUPT_FIXTURE).replace(BOTH, BOTH + " · Esc to cancel");
    const lines = linesOf(text);
    expect(claudeAdapter.composerReady!(lines)).toBe(false);
    expect(claudeAdapter.modalOnScreen!(lines)).toBe(true);
  });
});

describe("a real dialog whose footer uses an arrow key is still a dialog", () => {
  it.each(["claude-lab--tasks-panel--w82.txt", "claude-lab--menu-config-panel--w82.txt"])(
    "%s: no composer, a modal",
    (name) => {
      const lines = linesOf(upstreamText(name));
      expect(claudeAdapter.composerReady!(lines)).toBe(false);
      expect(claudeAdapter.modalOnScreen!(lines)).toBe(true);
    },
  );

  it("the background panel with `↓ to manage` as its only footer hint is still a modal", () => {
    // Upstream's tasks panel, its footer narrowed to the one `↓` hint, so nothing but that hint can
    // report the modal — the case a broader exemption would silently lose.
    const text = upstreamText("claude-lab--tasks-panel--w82.txt");
    const footer = "↑/↓ to select · Enter to view · Esc to close";
    expect(text).toContain(footer);
    const lines = linesOf(text.replace(footer, "↓ to manage"));
    expect(claudeAdapter.composerReady!(lines)).toBe(false);
    expect(claudeAdapter.modalOnScreen!(lines)).toBe(true);
  });

  it("the background panel with `Esc to cancel` as its only footer hint is still a modal", () => {
    const text = upstreamText("claude-lab--tasks-panel--w82.txt");
    const footer = "↑/↓ to select · Enter to view · Esc to close";
    const lines = linesOf(text.replace(footer, "Esc to cancel"));
    expect(claudeAdapter.composerReady!(lines)).toBe(false);
    expect(claudeAdapter.modalOnScreen!(lines)).toBe(true);
  });
});
