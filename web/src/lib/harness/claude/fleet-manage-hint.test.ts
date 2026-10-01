import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { splitLines, type Block, type StyledLine } from "../../blocks";
import { withoutClaudeManageHint } from "../../fleet-claude-mode-line";
import { withUnreadDialog } from "../index";
import { namesAMenuKey } from "../menu-hints";
import { claudeAdapter } from "./index";

// Claude Code 2.1.286's background-work hint on the mode line (FORK.toml `claude-manage-hint-port`,
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

  it.each([
    ["no mode text before it", "  ← 2 agents · ↓ to manage"],
    ["the hint alone", "  ↓ to manage"],
    ["a dialog footer", "   ↑/↓ to select · Enter to view · ↓ to manage"],
    ["a different verb", `${MODE} · ← 2 agents · ↓ to view`],
    ["no agent count before it", `${MODE} · ↓ to manage`],
    ["a count that is not a number", `${MODE} · ← for agents · ↓ to manage`],
    ["the hint not last", `${MODE} · ← 2 agents · ↓ to manage · Esc to cancel`],
  ])("returns the row unchanged with %s", (_case, row) => {
    expect(withoutClaudeManageHint(row)).toBe(row);
    expect(namesAMenuKey(withoutClaudeManageHint(row))).toBe(namesAMenuKey(row));
  });

  it("leaves every other segment of the mode line under upstream's reading", () => {
    const row = `${MODE} · Esc to cancel · ← 2 agents · ↓ to manage`;
    expect(withoutClaudeManageHint(row)).toBe(`${MODE} · Esc to cancel · ← 2 agents`);
    expect(namesAMenuKey(withoutClaudeManageHint(row))).toBe(true);
  });
});

describe("a working screen carrying the hint", () => {
  it.each(["claude--manage-hint--w120.txt", "claude--manage-hint--w73.txt"])(
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
});
