import { describe, expect, test } from "bun:test";

import type { JsonValue } from "../../bridge/json.ts";
import { formatBinding } from "../ui/commands/bindings.ts";
import {
  DEFAULT_FLEET_SETTINGS,
  parseFleetSettings,
  parseFleetSettingsText,
  serializeFleetSettings,
} from "./document.ts";

function rejection(value: JsonValue) {
  const result = parseFleetSettings(value);
  if (result.ok) throw new Error("expected the document to be rejected");
  return result.rejection;
}

function accepted(value: JsonValue) {
  const result = parseFleetSettings(value);
  if (!result.ok) throw new Error(`expected acceptance, got ${result.rejection.message}`);
  return result.settings;
}

describe("the settings document", () => {
  test("an absent document is every shipped default, not an error", () => {
    expect(parseFleetSettingsText("")).toEqual({ ok: true, settings: DEFAULT_FLEET_SETTINGS });
    expect(accepted({ schemaVersion: 1 })).toEqual(DEFAULT_FLEET_SETTINGS);
  });

  test("a syntax error is reported as one", () => {
    const result = parseFleetSettingsText("{ nope");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.rejection.at).toBe("");
  });

  test("an unknown setting is refused rather than ignored", () => {
    expect(rejection({ shortcut: {} }).at).toBe("shortcut");
    expect(rejection({ shortcuts: { prefixes: "Ctrl+A" } }).at).toBe("shortcuts.prefixes");
  });

  test("a schema version it does not know is refused", () => {
    expect(rejection({ schemaVersion: 2 }).at).toBe("schemaVersion");
  });

  test("an unknown command id is named back", () => {
    const at = rejection({ shortcuts: { bindings: { "open-everything": ["Prefix+E"] } } });
    expect(at.at).toBe("shortcuts.bindings.open-everything");
    expect(at.message).toContain("open-everything");
  });

  test("a binding the grammar refuses is named back", () => {
    const at = rejection({ shortcuts: { bindings: { "next-tab": ["Ctrl+T"] } } });
    expect(at.at).toBe("shortcuts.bindings.next-tab");
    expect(at.message).toContain("Ctrl+T");
  });

  test("one binding on two commands is refused, effective set and all", () => {
    // `Prefix+S` is Open Fleet Settings' shipped default, and this document never mentions it.
    const at = rejection({ shortcuts: { bindings: { "next-tab": ["Prefix+S"] } } });
    expect(at.message).toContain("open-fleet-settings");
  });

  test("a command listing the same binding twice is a typo, not an alias", () => {
    expect(
      rejection({ shortcuts: { bindings: { "next-tab": ["Prefix+N", "Prefix+N"] } } }).message,
    ).toContain("twice");
  });

  test("a direct binding on the prefix itself is refused", () => {
    const at = rejection({ shortcuts: { prefix: "Ctrl+B", bindings: { "next-tab": ["Ctrl+B"] } } });
    expect(at.message).toContain("the prefix itself");
  });

  test("an empty list is a real answer and survives", () => {
    const settings = accepted({ shortcuts: { bindings: { "open-fleet-settings": [] } } });
    expect(settings.bindings.get("open-fleet-settings")).toEqual([]);
  });

  test("a browser-dependent binding is accepted and marked", () => {
    const settings = accepted({ shortcuts: { bindings: { "open-command-bar": ["Ctrl+Q", "Alt+Q"] } } });
    expect(settings.bindings.get("open-command-bar")?.map(formatBinding)).toEqual(["Ctrl+Q", "Alt+Q"]);
    expect(settings.risky).toEqual(["Ctrl+Q"]);
  });

  test("the prefix must be a chord, not a prefix binding", () => {
    expect(accepted({ shortcuts: { prefix: "Ctrl+A" } }).prefix).toBe("Ctrl+A");
    expect(rejection({ shortcuts: { prefix: "Prefix+A" } }).at).toBe("shortcuts.prefix");
    expect(rejection({ shortcuts: { prefix: 4 } }).at).toBe("shortcuts.prefix");
  });

  test("shapes that are not documents are refused before anything is read", () => {
    expect(rejection([]).at).toBe("");
    expect(rejection("nope").at).toBe("");
    expect(rejection({ shortcuts: [] }).at).toBe("shortcuts");
    expect(rejection({ shortcuts: { bindings: { "next-tab": "Prefix+N" } } }).at).toBe(
      "shortcuts.bindings.next-tab",
    );
    expect(rejection({ shortcuts: { bindings: { "next-tab": [7] } } }).at).toBe(
      "shortcuts.bindings.next-tab",
    );
  });

  test("a serialized document parses back to the same settings", () => {
    const settings = accepted({
      shortcuts: { prefix: "Ctrl+A", bindings: { "next-tab": ["Prefix+M"], "last-pane": [] } },
    });
    const round = parseFleetSettingsText(serializeFleetSettings(settings));
    expect(round.ok && round.settings.prefix).toBe("Ctrl+A");
    expect(round.ok && [...round.settings.bindings.keys()].toSorted()).toEqual([
      "last-pane",
      "next-tab",
    ]);
  });
});
