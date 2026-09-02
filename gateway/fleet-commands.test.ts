import { describe, expect, test } from "bun:test";

import {
  createFleetShortcutRecognizer,
  FLEET_COMMANDS,
  FLEET_PUBLIC_DEFAULT_BINDINGS,
  fleetChordSignature,
  parseFleetKeyChord,
  parseFleetShortcutDocument,
  publicFleetShortcutDocument,
  type FleetShortcutEventLike,
} from "../shared/fleet-commands.ts";

async function packagedDefaults(): Promise<unknown> {
  return JSON.parse(await Bun.file(new URL("./shortcuts.default.json", import.meta.url)).text()) as unknown;
}

async function packagedExternalExample(): Promise<unknown> {
  return JSON.parse(await Bun.file(new URL("./shortcuts.external.example.json", import.meta.url)).text()) as unknown;
}

function key(
  code: string,
  modifiers: Partial<Omit<FleetShortcutEventLike, "code">> = {},
): FleetShortcutEventLike {
  return {
    code,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    ...modifiers,
  };
}

describe("Fleet command catalog", () => {
  test("contains every stable command exactly once and complete public defaults", async () => {
    expect(FLEET_COMMANDS).toHaveLength(48);
    expect(new Set(FLEET_COMMANDS.map((command) => command.id)).size).toBe(FLEET_COMMANDS.length);
    expect(new Set(FLEET_COMMANDS.map((command) => command.name)).size).toBe(FLEET_COMMANDS.length);
    expect(Object.keys(FLEET_PUBLIC_DEFAULT_BINDINGS).sort()).toEqual(FLEET_COMMANDS.map((command) => command.id).sort());

    const file = await packagedDefaults();
    expect(file).toEqual(publicFleetShortcutDocument());
    const parsed = parseFleetShortcutDocument(file, { requireComplete: true });
    expect(parsed.prefix.label).toBe("Ctrl+B");
    expect(parsed.bindingsByCommand["copy-fleet-pane-link"]).toEqual([]);
    expect(parsed.bindingsByCommand["create-tab"]?.map((binding) => binding.label)).toEqual([
      "Prefix C",
      "Prefix V",
      "Prefix -",
    ]);
  });

  test("keeps the synthetic external example and public documentation aligned with the parser", async () => {
    const example = await packagedExternalExample();
    const parsed = parseFleetShortcutDocument(example, { requireComplete: true });
    expect(parsed.bindingsByCommand["copy-fleet-pane-link"]).toEqual([]);
    expect(parsed.bindingsByCommand["toggle-type-mode"]?.map((binding) => binding.label)).toEqual(["Prefix T"]);

    const readme = await Bun.file(new URL("../README.md", import.meta.url)).text();
    const architecture = await Bun.file(new URL("../ARCHITECTURE.md", import.meta.url)).text();
    const gatewayExample = await Bun.file(new URL("../gateway.example.json", import.meta.url)).json() as {
      fleetUi?: { shortcutsFile?: unknown };
    };
    expect(readme).toContain("fleetUi.shortcutsFile");
    expect(readme).toMatch(/completely\s+replaces those defaults/);
    expect(readme).toContain("A leading `/` searches command ids");
    expect(readme).toContain("other non-empty input modes are visibly reserved");
    expect(readme).toMatch(/browser, operating-system,\s+and extension interception/);
    expect(readme).toContain("version-2 exact-window/origin handshake");
    expect(architecture).toContain("version-2 exact-child shortcut boundary");
    expect(architecture).toContain("empty list means deliberately unbound");
    expect(gatewayExample.fleetUi?.shortcutsFile).toBe("/etc/herdr-web-remote/shortcuts.json");
  });

  test("normalizes supported special and modifier-bearing chords", () => {
    expect(parseFleetKeyChord("?")).toEqual({
      code: "Slash",
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      label: "?",
    });
    expect(parseFleetKeyChord("Shift+Tab").label).toBe("Shift+Tab");
    expect(parseFleetKeyChord("Ctrl+R").label).toBe("Ctrl+R");
    expect(parseFleetKeyChord("-").code).toBe("Minus");
    expect(parseFleetKeyChord("Space").code).toBe("Space");
    expect(parseFleetKeyChord("Left").code).toBe("ArrowLeft");
  });

  test("rejects malformed, unknown, incomplete, colliding, and payload-bearing documents", () => {
    const complete = publicFleetShortcutDocument();
    expect(() => parseFleetShortcutDocument({ ...complete, schemaVersion: 2 })).toThrow("schemaVersion");
    expect(() => parseFleetShortcutDocument({ ...complete, action: { url: "https://example.invalid" } })).toThrow("unknown field");
    expect(() => parseFleetShortcutDocument({ ...complete, bindings: { ...complete.bindings, "not-a-command": [] } })).toThrow("unknown command");

    const missing = structuredClone(complete);
    delete missing.bindings["last-pane"];
    expect(() => parseFleetShortcutDocument(missing, { requireComplete: true })).toThrow("omits command");
    expect(parseFleetShortcutDocument(missing).bindingsByCommand["last-pane"]).toEqual([]);

    const collision = structuredClone(complete);
    collision.bindings["last-pane"] = ["Alt+J"];
    expect(() => parseFleetShortcutDocument(collision)).toThrow("collision");

    const prefixCollision = structuredClone(complete);
    prefixCollision.bindings["last-pane"] = ["Ctrl+B"];
    expect(() => parseFleetShortcutDocument(prefixCollision)).toThrow("prefix collides");
    expect(() => parseFleetShortcutDocument({ ...complete, prefix: "Ctrl+Ctrl+B" })).toThrow("repeats modifier");
    expect(() => parseFleetShortcutDocument({ ...complete, prefix: "Ctrl+F12" })).toThrow("unsupported key");
  });
});

describe("Fleet direct/prefix shortcut recognizer", () => {
  test("distinguishes sequential prefix chords from simultaneous direct chords", () => {
    let now = 1_000;
    const config = parseFleetShortcutDocument(publicFleetShortcutDocument());
    const recognizer = createFleetShortcutRecognizer(config, () => now);

    expect(recognizer.handle(key("KeyP", { ctrlKey: true, shiftKey: true }))).toEqual({
      kind: "command",
      commandId: "open-command-palette",
      bindingLabel: "Ctrl+Shift+P",
    });
    expect(recognizer.handle(key("KeyB", { ctrlKey: true }))).toEqual({ kind: "prefix" });
    expect(recognizer.pending()).toBe(true);
    expect(recognizer.handle(key("ShiftLeft", { shiftKey: true }))).toEqual({ kind: "ignored" });
    expect(recognizer.handle(key("KeyP", { shiftKey: true }))).toEqual({
      kind: "command",
      commandId: "rename-pane",
      bindingLabel: "Ctrl+B Shift+P",
    });

    expect(recognizer.handle(key("KeyB", { ctrlKey: true }))).toEqual({ kind: "prefix" });
    expect(recognizer.handle(key("Tab"))).toEqual({
      kind: "command",
      commandId: "next-pane-in-tab",
      bindingLabel: "Ctrl+B Tab",
    });
    expect(recognizer.handle(key("KeyB", { ctrlKey: true }))).toEqual({ kind: "prefix" });
    expect(recognizer.handle(key("Tab", { shiftKey: true }))).toEqual({
      kind: "command",
      commandId: "previous-pane-in-tab",
      bindingLabel: "Ctrl+B Shift+Tab",
    });

    now += 3_000;
    expect(recognizer.handle(key("KeyB", { ctrlKey: true }))).toEqual({ kind: "prefix" });
    now += 2_000;
    expect(recognizer.handle(key("KeyS"))).toEqual({ kind: "ignored" });
  });

  test("cancels prefix on Escape, unsupported keys, extra modifiers, and explicit context loss", () => {
    const config = parseFleetShortcutDocument(publicFleetShortcutDocument());
    const recognizer = createFleetShortcutRecognizer(config);
    for (const second of [
      key("Escape"),
      key("KeyQ"),
      key("KeyS", { altKey: true }),
    ]) {
      expect(recognizer.handle(key("KeyB", { ctrlKey: true }))).toEqual({ kind: "prefix" });
      expect(recognizer.handle(second)).toEqual({ kind: "cancelled" });
      expect(recognizer.pending()).toBe(false);
    }
    expect(recognizer.handle(key("KeyB", { ctrlKey: true }))).toEqual({ kind: "prefix" });
    recognizer.cancel();
    expect(recognizer.handle(key("KeyS"))).toEqual({ kind: "ignored" });
    expect(recognizer.handle(key("KeyJ", { altKey: true, repeat: true }))).toEqual({ kind: "ignored" });
  });

  test("uses exact physical-code signatures", () => {
    expect(fleetChordSignature(parseFleetKeyChord("Alt+J"))).toBe("KeyJ|true|false|false|false");
    expect(fleetChordSignature(parseFleetKeyChord("Ctrl+Shift+P"))).toBe("KeyP|false|true|false|true");
  });
});
