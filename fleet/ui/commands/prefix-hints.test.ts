import { describe, expect, test } from "bun:test";

import { parseBinding, type Binding } from "./bindings.ts";
import type { CommandId } from "./catalog.ts";
import { resolveBindings } from "./effective.ts";
import { PREFIX_HINT_GROUPS, prefixHints } from "./prefix-hints.ts";

function bind(...texts: string[]): readonly Binding[] {
  return texts.map((text) => {
    const parsed = parseBinding(text);
    if (!parsed.ok) throw new Error(`bad fixture ${text}`);
    return parsed.binding;
  });
}

function hints(overrides?: ReadonlyMap<CommandId, readonly Binding[]>, limit?: number) {
  return prefixHints(resolveBindings(overrides), limit);
}

function flat(result: ReturnType<typeof hints>) {
  return result.groups.flatMap((group) => group.hints.map((hint) => `${hint.chord}=${hint.id}`));
}

describe("what a pending prefix leads to", () => {
  test("the shipped defaults produce a row per prefix binding and nothing else", () => {
    const result = hints();
    const rows = flat(result);
    expect(rows).toContain("S=open-fleet-settings");
    expect(rows).toContain("Shift+P=rename-pane");
    expect(rows).toContain("Tab=next-pane-in-tab");
    expect(rows).toContain("Shift+Tab=previous-pane-in-tab");
    expect(rows).toContain("?=open-command-bar");
    expect(result.elided).toBe(0);
  });

  test("a direct chord is never listed", () => {
    // `Ctrl+Shift+P` is the one direct default, and it belongs to a command that also has a prefix
    // binding — so this asserts the filter, not merely that the command is absent.
    const rows = flat(hints());
    expect(rows).toContain("?=open-command-bar");
    expect(rows.some((row) => row.includes("Ctrl+Shift+P"))).toBe(false);
  });

  test("one command reached by three chords is three rows", () => {
    const rows = flat(hints()).filter((row) => row.endsWith("=create-tab"));
    expect(rows.toSorted()).toEqual(["-=create-tab", "C=create-tab", "V=create-tab"]);
  });

  test("an operator's own binding replaces the shipped one", () => {
    const result = hints(new Map([["next-tab", bind("Prefix+Right")]]));
    const rows = flat(result);
    expect(rows).toContain("Right=next-tab");
    expect(rows).not.toContain("N=next-tab");
  });

  test("an unbound command contributes nothing", () => {
    const rows = flat(hints(new Map([["open-fleet-settings", []]])));
    expect(rows.some((row) => row.endsWith("=open-fleet-settings"))).toBe(false);
  });

  test("a command with no prefix binding at all stays absent", () => {
    // `last-pane` ships unbound; giving it a DIRECT chord must not put it in the panel.
    const rows = flat(hints(new Map([["last-pane", bind("Alt+O")]])));
    expect(rows.some((row) => row.endsWith("=last-pane"))).toBe(false);
  });

  test("groups appear in their declared order and carry only their own commands", () => {
    const result = hints();
    const seen = result.groups.map((group) => group.scope);
    expect(seen).toEqual(PREFIX_HINT_GROUPS.filter((scope) => seen.includes(scope)));
    const global = result.groups.find((group) => group.scope === "global");
    expect(global?.hints.every((hint) => hint.id.startsWith("open-") || hint.id.startsWith("toggle-"))).toBe(
      true,
    );
  });

  test("plain letters sort first, so the key half-remembered is the easy one to find", () => {
    const tab = hints().groups.find((group) => group.scope === "tab");
    const chords = tab?.hints.map((hint) => hint.chord) ?? [];
    const firstAwkward = chords.findIndex((chord) => !/^[A-Za-z]$/.test(chord));
    const lastPlain = chords.findLastIndex((chord) => /^[A-Za-z]$/.test(chord));
    expect(firstAwkward === -1 || lastPlain < firstAwkward).toBe(true);
  });

  test("every row carries the same English name the rest of the app shows", () => {
    const settings = hints()
      .groups.flatMap((group) => group.hints)
      .find((hint) => hint.id === "open-fleet-settings");
    expect(settings?.name).toBe("Open Fleet Settings");
  });

  test("a set past the ceiling is cut, and the panel is told how much it lost", () => {
    const all = flat(hints()).length;
    const capped = hints(undefined, 5);
    expect(flat(capped)).toHaveLength(5);
    expect(capped.elided).toBe(all - 5);
  });

  test("a set exactly at the ceiling loses nothing", () => {
    const all = flat(hints()).length;
    expect(hints(undefined, all).elided).toBe(0);
  });

  test("a ceiling of zero shows nothing rather than throwing", () => {
    const none = hints(undefined, 0);
    expect(none.groups).toEqual([]);
    expect(none.elided).toBeGreaterThan(0);
  });
});
