import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../ansi";
import { splitLines } from "../blocks";
import { describeAdapterConformance } from "./conformance";
import { buildBlocks } from "./index";
import { piAdapter } from "./pi";
import { adapterFor } from "./registry";

const PANES = join(import.meta.dirname, "../../fixtures/panes");
const fixtures = readdirSync(PANES).filter((name) => name.endsWith(".txt")).toSorted();
const load = (name: string) => splitLines(parseAnsi(readFileSync(join(PANES, name), "utf8")));
const pi = fixtures.filter((name) => name.startsWith("pi--"));
// Every pi screen that lifts (pi/ask.test.ts names what each one lifts as). The rest of the pi corpus
// is the raw cohort: editors, answer editors, multi-selects, a pointer on the free-text row, an
// incomplete Submit page and pi's own /model picker.
const lifted = pi.filter((name) => piAdapter.buildBlocks(load(name)).some((block) => block.kind !== "raw"));

describeAdapterConformance(piAdapter, {
  ownFixtures: lifted,
  neutralFixtures: pi.filter((name) => !lifted.includes(name)),
  foreignFixtures: fixtures.filter((name) => !name.startsWith("pi--")),
  // The slash palette pushes the editor frame out of the bridge's six-row tail window.
  unboundComposerFixtures: ["pi--v110-slash-palette.txt"],
});

describe("pi adapter routing", () => {
  it("lifts every question screen the corpus proves, and no fewer", () => {
    expect(lifted).toHaveLength(38);
  });

  it.each([
    ["pi--omo-v5130-single-described.txt", "prompt-select"],
    ["pi--v0871-question-single.txt", "prompt-select"],
    ["pi--v110-questionnaire-submit-ready.txt", "wizard"],
  ])("lifts %s through the public pi dispatch", (name, kind) => {
    const lines = load(name);
    expect(buildBlocks(lines, { agent: "pi" }).map((block) => block.kind)).toContain(kind);
    expect(adapterFor("pi")?.composerReady?.(lines)).toBe(false);
  });

  it.each([
    "pi--omo-v5130-multi.txt",
    "pi--omo-v5130-single-other-focused.txt",
    "pi--omo-v5130-answer-editor.txt",
    "pi--v0871-question-other-focused.txt",
    "pi--v0871-question-answer-editor.txt",
    "pi--v110-questionnaire-submit-incomplete.txt",
    "pi--v110-multi.txt",
    "pi--v110-core-selector.txt",
  ])("offers only the printed Escape key on the unmodelled %s", (name) => {
    const lines = load(name);
    expect(piAdapter.buildBlocks(lines).every((block) => block.kind === "raw")).toBe(true);
    expect(piAdapter.composerReady?.(lines)).toBe(false);
    expect(buildBlocks(lines, { agent: "pi" }).map((block) => block.kind)).toContain("unread-dialog");
  });

  it("keeps pi's own /model picker on the mirror and reads no draft from it", () => {
    const lines = load("pi--v110-core-selector.txt");
    expect(piAdapter.extractInputDraft(lines)).toBeNull();
    expect(piAdapter.buildBlocks(lines)).toEqual([{ kind: "raw", lines }]);
  });

  it("retains the raw mirror when the terminal view disables grammars", () => {
    const lines = load("pi--omo-v5130-single-described.txt");
    expect(buildBlocks(lines, { agent: "pi", grammars: false })).toEqual([{ kind: "raw", lines }]);
  });

  it("allows the captured OmO composer and binds its input frame", () => {
    const lines = load("pi--omo-v5130-idle.txt");
    expect(piAdapter.composerReady?.(lines)).toBe(true);
    expect(piAdapter.extractInputDraft(lines)).toBeNull();
    expect(piAdapter.composerPrompt?.(lines)).not.toBeNull();
    expect(buildBlocks(lines, { agent: "pi" }).every((block) => block.kind === "raw")).toBe(true);
  });

  it.each([
    ["pi--v0851-idle.txt", "pi--v0851-draft.txt"],
    ["pi--v0871-idle.txt", "pi--v0871-draft.txt"],
    ["pi--v110-stock-idle.txt", "pi--v110-stock-draft.txt"],
  ])("keeps stock pi sendable: %s is a composer and its draft reads back", (idleName, draftName) => {
    const idle = load(idleName);
    expect(piAdapter.composerReady?.(idle)).toBe(true);
    expect(piAdapter.extractInputDraft(load(draftName))).toBe("collie stock pi draft probe");
    expect(buildBlocks(idle, { agent: "pi" }).every((block) => block.kind === "raw")).toBe(true);
  });

  it.each(["pi--v0871-narrow-idle.txt", "pi--v110-stock-narrow-idle.txt", "pi--v0871-question-answered.txt"])(
    "reads %s as a ready composer",
    (name) => {
      expect(piAdapter.composerReady?.(load(name))).toBe(true);
    },
  );

  it.each([
    "pi--prose-quoted-dialog-above-editor.txt",
    "pi--prose-quoted-omo-dialog-above-editor.txt",
    "pi--prose-quoted-dialog-in-tool-result.txt",
  ])("keeps %s sendable: the quoted dialog stays prose, the editor below is the composer", (name) => {
    const lines = load(name);
    expect(piAdapter.composerReady?.(lines)).toBe(true);
    expect(piAdapter.extractInputDraft(lines)).toBeNull();
    expect(buildBlocks(lines, { agent: "pi" }).every((block) => block.kind === "raw")).toBe(true);
  });

  it("shows a quoted dialog under which pi exited as raw text with no card", () => {
    const lines = load("pi--prose-quoted-dialog-then-shell.txt");
    expect(piAdapter.composerReady?.(lines)).toBe(false);
    expect(buildBlocks(lines, { agent: "pi" })).toEqual([{ kind: "raw", lines }]);
  });

  it("strips the editor off the mirror on an idle screen", () => {
    const lines = load("pi--v0871-draft.txt");
    const [block] = buildBlocks(lines, { agent: "pi" });
    expect(block?.kind).toBe("raw");
    expect(block?.kind === "raw" ? block.lines.length : 0).toBeLessThan(lines.length);
  });
});
