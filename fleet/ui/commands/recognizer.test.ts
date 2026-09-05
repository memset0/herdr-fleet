import { describe, expect, test } from "bun:test";

import { parseBinding, type Binding } from "./bindings.ts";
import type { CommandId } from "./catalog.ts";
import { createRecognizer, shouldPrevent, type RecognizerKeyEvent } from "./recognizer.ts";

function binding(text: string): Binding {
  const result = parseBinding(text);
  if (!result.ok) throw new Error(`bad fixture ${text}`);
  return result.binding;
}

function key(code: string, modifiers: Partial<RecognizerKeyEvent> = {}): RecognizerKeyEvent {
  return {
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    repeat: false,
    ...modifiers,
  };
}

type BindingFixture = readonly (readonly [CommandId, readonly string[]])[];

function harness(bindings: BindingFixture = []) {
  let clock = 1000;
  const map = new Map<CommandId, readonly Binding[]>();
  for (const [id, texts] of bindings) {
    map.set(id, texts.map(binding));
  }
  const recognizer = createRecognizer({
    prefix: binding("Ctrl+B").chord,
    prefixLabel: "Ctrl+B",
    bindings: () => map,
    now: () => clock,
  });
  return {
    recognizer,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

const DEFAULTS: BindingFixture = [
  ["open-command-bar", ["Ctrl+Shift+P", "Prefix+?"]],
  ["rename-pane", ["Prefix+Shift+P"]],
  ["next-pane-in-tab", ["Prefix+Tab"]],
  ["previous-pane-in-tab", ["Prefix+Shift+Tab"]],
  ["copy-fleet-pane-link", ["Prefix+Ctrl+R"]],
];

describe("direct chords", () => {
  test("a registered chord invokes its command and is consumed", () => {
    const { recognizer } = harness(DEFAULTS);
    const outcome = recognizer.handle(key("KeyP", { ctrlKey: true, shiftKey: true }));
    expect(outcome.kind).toBe("command");
    expect(outcome.kind === "command" && outcome.id).toBe("open-command-bar");
    expect(outcome.kind === "command" && outcome.label).toBe("Ctrl+Shift+P");
    expect(shouldPrevent(outcome)).toBe(true);
  });

  test("an extra modifier is a different chord and is left alone", () => {
    const { recognizer } = harness(DEFAULTS);
    const outcome = recognizer.handle(key("KeyP", { ctrlKey: true, shiftKey: true, altKey: true }));
    expect(outcome.kind).toBe("ignored");
    expect(shouldPrevent(outcome)).toBe(false);
  });

  test("auto-repeat fires nothing", () => {
    const { recognizer } = harness(DEFAULTS);
    expect(recognizer.handle(key("KeyP", { ctrlKey: true, shiftKey: true, repeat: true })).kind).toBe(
      "ignored",
    );
  });

  test("a modifier's own keydown starts nothing", () => {
    const { recognizer } = harness(DEFAULTS);
    expect(recognizer.handle(key("ControlLeft", { ctrlKey: true })).kind).toBe("ignored");
    expect(recognizer.armed()).toBe(false);
  });
});

describe("prefix sequences", () => {
  test("the prefix arms, the second chord invokes, and both are consumed", () => {
    const { recognizer } = harness(DEFAULTS);
    const armed = recognizer.handle(key("KeyB", { ctrlKey: true }));
    expect(armed.kind).toBe("prefix-armed");
    expect(shouldPrevent(armed)).toBe(true);
    expect(recognizer.armed()).toBe(true);

    const outcome = recognizer.handle(key("KeyP", { shiftKey: true }));
    expect(outcome.kind === "command" && outcome.id).toBe("rename-pane");
    expect(outcome.kind === "command" && outcome.label).toBe("Ctrl+B Shift+P");
    expect(recognizer.armed()).toBe(false);
  });

  test("Tab and Shift+Tab resolve to their own commands", () => {
    const { recognizer } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    expect(recognizer.handle(key("Tab")).kind === "command").toBe(true);

    recognizer.handle(key("KeyB", { ctrlKey: true }));
    const back = recognizer.handle(key("Tab", { shiftKey: true }));
    expect(back.kind === "command" && back.id).toBe("previous-pane-in-tab");
  });

  test("a second chord may carry its own modifiers", () => {
    const { recognizer } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    const outcome = recognizer.handle(key("KeyR", { ctrlKey: true }));
    expect(outcome.kind === "command" && outcome.id).toBe("copy-fleet-pane-link");
    expect(outcome.kind === "command" && outcome.label).toBe("Ctrl+B Ctrl+R");
  });

  test("`?` completes as Shift on the Slash key", () => {
    const { recognizer } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    const outcome = recognizer.handle(key("Slash", { shiftKey: true }));
    expect(outcome.kind === "command" && outcome.id).toBe("open-command-bar");
    expect(outcome.kind === "command" && outcome.label).toBe("Ctrl+B ?");
  });

  test("the pending prefix expires and the next key is read fresh", () => {
    const { recognizer, advance } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    advance(2001);
    const outcome = recognizer.handle(key("KeyP", { shiftKey: true }));
    expect(outcome.kind).toBe("ignored");
    expect(recognizer.armed()).toBe(false);
  });

  test("a key just inside the window still completes", () => {
    const { recognizer, advance } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    advance(2000);
    expect(recognizer.handle(key("KeyP", { shiftKey: true })).kind).toBe("command");
  });

  test("Escape cancels deliberately and is consumed", () => {
    const { recognizer } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    const outcome = recognizer.handle(key("Escape"));
    expect(outcome.kind).toBe("prefix-cancelled");
    expect(shouldPrevent(outcome)).toBe(true);
    expect(recognizer.armed()).toBe(false);
  });

  test("an unregistered second chord cancels and is NOT swallowed", () => {
    const { recognizer } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    const outcome = recognizer.handle(key("KeyZ"));
    expect(outcome.kind).toBe("prefix-cancelled");
    expect(shouldPrevent(outcome)).toBe(false);
  });

  test("holding a key while armed neither fires nor cancels", () => {
    const { recognizer } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    expect(recognizer.handle(key("KeyZ", { repeat: true })).kind).toBe("ignored");
    expect(recognizer.armed()).toBe(true);
  });

  test("pressing the prefix again restarts the wait", () => {
    const { recognizer, advance } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    advance(1500);
    expect(recognizer.handle(key("KeyB", { ctrlKey: true })).kind).toBe("prefix-armed");
    advance(1500);
    // Would have expired against the FIRST press; the second one moved the deadline.
    expect(recognizer.handle(key("KeyP", { shiftKey: true })).kind).toBe("command");
  });

  test("blur and document hiding drop the pending prefix", () => {
    const { recognizer } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    recognizer.cancel();
    expect(recognizer.armed()).toBe(false);
    expect(recognizer.handle(key("KeyP", { shiftKey: true })).kind).toBe("ignored");
  });

  test("a direct chord is still a direct chord while nothing is pending", () => {
    const { recognizer } = harness(DEFAULTS);
    const outcome = recognizer.handle(key("KeyP", { ctrlKey: true, shiftKey: true }));
    expect(outcome.kind === "command" && outcome.label).toBe("Ctrl+Shift+P");
    expect(recognizer.armed()).toBe(false);
  });

  test("an unbound catalog entry is unreachable by key", () => {
    const { recognizer } = harness([...DEFAULTS, ["send-ctrl-c", []]]);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    expect(recognizer.handle(key("KeyC", { ctrlKey: true })).kind).toBe("prefix-cancelled");
  });
});

describe("a modifier bound as a key", () => {
  test("the right Alt fires on its own keydown, and the left one does not", () => {
    const { recognizer } = harness([["toggle-mic-recording", ["RAlt"]]]);
    // `altKey` is already true on the modifier's OWN keydown — the key being pressed IS Alt — which
    // is exactly why the chord does not ask for Alt a second time.
    const fired = recognizer.handle(key("AltRight", { altKey: true }));
    expect(fired.kind === "command" && fired.id).toBe("toggle-mic-recording");
    expect(shouldPrevent(fired)).toBe(true);
    expect(recognizer.handle(key("AltLeft", { altKey: true })).kind).toBe("ignored");
  });

  test("holding it does not fire again", () => {
    const { recognizer } = harness([["toggle-mic-recording", ["RAlt"]]]);
    recognizer.handle(key("AltRight", { altKey: true }));
    expect(recognizer.handle(key("AltRight", { altKey: true, repeat: true })).kind).toBe("ignored");
  });

  test("a modifier nobody bound is still ignored", () => {
    const { recognizer } = harness(DEFAULTS);
    expect(recognizer.handle(key("ControlLeft", { ctrlKey: true })).kind).toBe("ignored");
    expect(recognizer.handle(key("AltRight", { altKey: true })).kind).toBe("ignored");
  });

  test("a modifier pressed mid-sequence neither completes nor cancels a pending prefix", () => {
    const { recognizer } = harness(DEFAULTS);
    recognizer.handle(key("KeyB", { ctrlKey: true }));
    expect(recognizer.armed()).toBe(true);
    // Reaching for the Shift of `Prefix+Shift+P` must not end the sequence.
    expect(recognizer.handle(key("ShiftLeft", { shiftKey: true })).kind).toBe("ignored");
    expect(recognizer.armed()).toBe(true);
    const done = recognizer.handle(key("KeyP", { shiftKey: true }));
    expect(done.kind === "command" && done.id).toBe("rename-pane");
  });
});

describe("which side a modifier was on", () => {
  test("a sided qualifier matches only while that side is the one held", () => {
    const { recognizer } = harness([["fit-pane-width", ["RAlt+Q"]]]);
    // The machine learns the side from the modifier's own keydown, because the event for `Q` will
    // say `altKey` and never which Alt.
    recognizer.handle(key("AltRight", { altKey: true }));
    const fired = recognizer.handle(key("KeyQ", { altKey: true }));
    expect(fired.kind === "command" && fired.id).toBe("fit-pane-width");

    recognizer.release({ code: "AltRight" });
    recognizer.handle(key("AltLeft", { altKey: true }));
    expect(recognizer.handle(key("KeyQ", { altKey: true })).kind).toBe("ignored");
  });

  test("releasing the modifier stops it matching", () => {
    const { recognizer } = harness([["fit-pane-width", ["RAlt+Q"]]]);
    recognizer.handle(key("AltRight", { altKey: true }));
    recognizer.release({ code: "AltRight" });
    // The flag can still be true — another Alt may be down — but this machine no longer believes the
    // right one is, and a sided chord that cannot prove its side must not fire.
    expect(recognizer.handle(key("KeyQ", { altKey: true })).kind).toBe("ignored");
  });

  test("cancelling forgets every side, because the keyups will never arrive", () => {
    const { recognizer } = harness([["fit-pane-width", ["RAlt+Q"]]]);
    recognizer.handle(key("AltRight", { altKey: true }));
    // The page lost focus. Every keyup between now and the next focus happens somewhere else, so a
    // remembered side is a guess — and a stale side fires the wrong binding on the next press.
    recognizer.cancel();
    expect(recognizer.handle(key("KeyQ", { altKey: true })).kind).toBe("ignored");
  });
});
