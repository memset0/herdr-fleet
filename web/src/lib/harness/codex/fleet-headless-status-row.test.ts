import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseAnsi, type AnsiSegment } from "../../ansi";
import { splitLines, type StyledLine } from "../../blocks";
import { fleetReadsUnpaintedNotice, withFleetCodexStatusSegments } from "../../fleet-codex-status-row";
import { buildBlocks } from "../index";
import { locateComposer } from "./chrome";
import { codexAdapter } from "./index";
import { isStatusRow, lineText } from "./markers";

// Codex's status row as a headless Codex draws it with a multi-item `status_line`
// (FORK.toml `codex-headless-status-row-port`, openspec/specs/fleet-harness-compat). The two screens
// are SYNTHETIC — hand-built in the captured segment shape, kept out of upstream's corpus directory
// so its pinned codex list does not have to learn them. The dialogs are upstream's own captures.

const FLEET_PANES = join(import.meta.dirname, "..", "..", "..", "fixtures", "fleet-panes");
const UPSTREAM_PANES = join(import.meta.dirname, "..", "..", "..", "fixtures", "panes");

const linesOf = (text: string): StyledLine[] => splitLines(parseAnsi(text));
const fleetLines = (name: string): StyledLine[] => linesOf(readFileSync(join(FLEET_PANES, name), "utf8"));
const upstreamLines = (name: string): StyledLine[] => linesOf(readFileSync(join(UPSTREAM_PANES, name), "utf8"));

const OFF = "\u001b[0m";
const FIELD = "\u001b[38;2;246;226;183m";
const FIELD2 = "\u001b[38;2;171;223;167m";
const FIELD3 = "\u001b[38;2;143;179;239m";
const WARN = "\u001b[38;2;196;167;103m";
const MUTED = "\u001b[38;2;135;140;164m";
const BOLD = "\u001b[1m";

function accepts(raw: string): boolean {
  const line = linesOf(raw)[0]!;
  return isStatusRow(lineText(line), line);
}

type Paint = Pick<AnsiSegment, "fg" | "dim">;
const seg = (text: string, paint: Paint = {}): AnsiSegment => ({ ...paint, text, style: {}, muted: false });

describe("withFleetCodexStatusSegments", () => {
  it("splits an unpainted gap off the notice glyph glued to it", () => {
    const out = withFleetCodexStatusSegments([seg("  "), seg("model", { fg: "a" }), seg("   ⚠ ")]);
    expect(out.map((s) => s.text)).toEqual(["  ", "model", "   ", "⚠ "]);
  });

  it("gives a coloured item's trailing space back to the `· ` after it", () => {
    const out = withFleetCodexStatusSegments([seg("  "), seg("main ", { fg: "a" }), seg("· "), seg("x", { fg: "b" })]);
    expect(out.map((s) => s.text)).toEqual(["  ", "main", " · ", "x"]);
    expect(out[1]!.fg).toBe("a");
    expect(out[2]!.fg).toBeUndefined();
  });

  it("leaves an upstream-shaped row, the indent, and painted or unglued runs as they are", () => {
    const row = [
      seg("  "),
      seg("model", { fg: "a" }),
      seg(" · ", { fg: "m" }),
      seg("/dir", { fg: "b" }),
      seg("        "),
      seg("⚠ ", { fg: "m" }),
      seg("   x", { dim: true }),
      seg("main ", { fg: "a" }),
      seg("· x"),
      seg("plain "),
      seg("· "),
    ];
    expect(withFleetCodexStatusSegments(row)).toEqual(row);
    expect(withFleetCodexStatusSegments([seg("  x")]).map((s) => s.text)).toEqual(["  x"]);
  });

  it("leaves the field-and-gap pair upstream's splitPaintedGaps cut from a goal notice's padding", () => {
    const row = [seg("  "), seg("model", { fg: "a" }), seg(" · ", { fg: "m" }), seg("main", { fg: "b" }), seg("   "), seg("Pursuing goal", { fg: "m" })];
    expect(withFleetCodexStatusSegments(row)).toEqual(row);
  });

  it("never modifies its input", () => {
    const input = [seg("  "), seg("main ", { fg: "a" }), seg("· "), seg("  ⚠ ")];
    const copy = structuredClone(input);
    withFleetCodexStatusSegments(input);
    expect(input).toEqual(copy);
  });

  it("relaxes the notice only on a row whose separators carry no paint", () => {
    expect(fleetReadsUnpaintedNotice("plain")).toBe(true);
    expect(fleetReadsUnpaintedNotice("dim")).toBe(false);
    expect(fleetReadsUnpaintedNotice(`fg:135,140,164`)).toBe(false);
    expect(fleetReadsUnpaintedNotice(null)).toBe(false);
  });
});

describe("a headless multi-item status row is read as a status row", () => {
  it.each([
    [
      "codex--headless-status-9-items.txt",
      "  GPT-6-Luna medium · Full Access · Check the training config · /tmp/project · main · weekl…  ⚠ 1 warning · f2 to view",
    ],
    [
      "codex--headless-status-5-items.txt",
      `  GPT-6-Luna medium · Full Access · Check the training config · /tmp/project · main${" ".repeat(11)}⚠ 1 warning · f2 to view`,
    ],
  ])("%s: the composer is ready, the row re-surfaces with its notice, no card is drawn", (name, row) => {
    const lines = fleetLines(name);
    expect(codexAdapter.composerReady!(lines)).toBe(true);
    const status = codexAdapter.extractStatusLines(lines);
    expect(status).toHaveLength(1);
    expect(lineText(status[0]!)).toBe(row);
    expect(status[0]).toBe(lines[locateComposer(lines)!.statusRow]);
    expect(codexAdapter.extractInputDraft(lines)).toBeNull();
    const kinds = buildBlocks(lines, { agent: "codex" }).map((b) => b.kind);
    expect(kinds).toEqual(["raw"]);
    expect(kinds).not.toContain("unread-dialog");
  });
});

describe("the relaxation opens no other way in", () => {
  const LEFT = `  ${FIELD}model${OFF}${MUTED} · ${OFF}${FIELD2}/dir${OFF}`;

  it("a coloured row still needs every notice segment painted", () => {
    expect(accepts(`${LEFT}        ${MUTED}⚠ ${OFF}${WARN}1 warning${OFF}${MUTED} · ${OFF}${BOLD}${FIELD}f2${OFF}${MUTED} to view${OFF}`)).toBe(true);
    expect(accepts(`${LEFT}        ⚠ ${WARN}1 warning${OFF}${MUTED} · ${OFF}${BOLD}f2${OFF} to view`)).toBe(false);
    expect(accepts(`${LEFT}        ${MUTED}⚠ ${OFF}${WARN}1 warning${OFF}${MUTED} · ${OFF}${BOLD}${FIELD}f2${OFF} to view`)).toBe(false);
  });

  it("a row whose items carry no colour is still prose", () => {
    expect(accepts("  model · Full Access · /tmp/project · main  ⚠ 1 warning · f2 to view")).toBe(false);
  });

  it("the notice still follows a whole status row, and keeps its bounds", () => {
    const plainLeft = `  ${FIELD}model${OFF} · ${FIELD2}/dir${OFF}`;
    expect(accepts(`${plainLeft}  ⚠ ${WARN}1 warning ${OFF}· ${BOLD}f2 ${OFF}to view`)).toBe(true);
    expect(accepts(`  ${FIELD}model${OFF}  ⚠ ${WARN}1 warning ${OFF}· ${BOLD}f2 ${OFF}to view`)).toBe(false);
    expect(accepts(`${plainLeft}  ⚠ ${"word ".repeat(40)}`)).toBe(false);
    expect(accepts(`${plainLeft}  ⚠ ${WARN}1 warning${OFF}    to view`)).toBe(false);
  });

  it("a separator glued the headless way still has to match the row's one separator paint", () => {
    expect(accepts(`  ${FIELD}model${OFF}${MUTED} · ${OFF}${FIELD2}/dir ${OFF}· ${FIELD3}main${OFF}`)).toBe(false);
    expect(accepts(`  ${FIELD}model${OFF} · ${FIELD2}/dir ${OFF}· ${FIELD3}main${OFF}`)).toBe(true);
  });
});

describe("a real Codex dialog is still a dialog", () => {
  it.each(["codex--v0156-approval-exec-2opt.txt", "codex--v0156-approval-patch.txt", "codex--v0156-trust.txt"])(
    "%s: no composer, the dialog is lifted",
    (name) => {
      const lines = upstreamLines(name);
      expect(codexAdapter.composerReady!(lines)).toBe(false);
      const kinds = buildBlocks(lines, { agent: "codex" }).map((b) => b.kind);
      expect(kinds).toContain("prompt-select");
      expect(kinds).not.toContain("unread-dialog");
    },
  );
});
