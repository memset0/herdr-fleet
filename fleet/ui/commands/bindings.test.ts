import { describe, expect, test } from "bun:test";

import {
  bindingKey,
  chordHazard,
  chordMatchesEvent,
  formatBinding,
  isModifierCode,
  parseBinding,
  type Binding,
} from "./bindings.ts";

function parsed(text: string): Binding {
  const result = parseBinding(text);
  if (!result.ok) throw new Error(`expected ${text} to parse, got ${result.failure.reason}`);
  return result.binding;
}

function failure(text: string): string {
  const result = parseBinding(text);
  if (result.ok) throw new Error(`expected ${text} to be rejected`);
  return result.failure.reason;
}

describe("binding grammar", () => {
  test("a direct chord names its physical code and its exact modifiers", () => {
    expect(parsed("Ctrl+Shift+P")).toEqual({
      kind: "direct",
      chord: { code: "KeyP", ctrl: "either", alt: "absent", shift: "either", meta: "absent" },
    });
  });

  test("a prefix binding is a second chord, not a modifier", () => {
    expect(parsed("Prefix+S")).toEqual({
      kind: "prefix",
      chord: { code: "KeyS", ctrl: "absent", alt: "absent", shift: "absent", meta: "absent" },
    });
  });

  test("the second chord may carry its own modifiers", () => {
    expect(parsed("Prefix+Ctrl+R")).toEqual({
      kind: "prefix",
      chord: { code: "KeyR", ctrl: "either", alt: "absent", shift: "absent", meta: "absent" },
    });
  });

  test("`?` is the Slash key with its own Shift, and formats back as `?`", () => {
    const binding = parsed("Prefix+?");
    expect(binding.chord).toEqual({ code: "Slash", ctrl: "absent", alt: "absent", shift: "either", meta: "absent" });
    expect(formatBinding(binding)).toBe("Prefix+?");
  });

  test("Tab and Shift+Tab are two different bindings", () => {
    expect(bindingKey(parsed("Prefix+Tab"))).not.toBe(bindingKey(parsed("Prefix+Shift+Tab")));
  });

  test("digits, punctuation and named keys all resolve to codes", () => {
    expect(parsed("Prefix+1").chord.code).toBe("Digit1");
    expect(parsed("Prefix+-").chord.code).toBe("Minus");
    expect(parsed("Alt+Enter").chord.code).toBe("Enter");
    expect(parsed("Alt+Up").chord.code).toBe("ArrowUp");
  });

  test("parsing is case- and space-insensitive and formatting is canonical", () => {
    expect(formatBinding(parsed("  shift + ctrl + p "))).toBe("Ctrl+Shift+P");
    expect(bindingKey(parsed("Shift+Ctrl+P"))).toBe(bindingKey(parsed("Ctrl+Shift+P")));
  });

  test("every rejected shape says which shape it was", () => {
    expect(failure("")).toBe("empty");
    // `Ctrl` alone is a BINDING now — the Ctrl key itself — so the shape with no key left in it is
    // a `Prefix` that never says what follows it.
    expect(failure("Prefix")).toBe("no-key");
    expect(failure("Ctrl+P+Q")).toBe("extra-key");
    expect(failure("Ctrl+Ctrl+P")).toBe("repeated-modifier");
    expect(failure("Ctrl+Prefix+P")).toBe("prefix-not-first");
    expect(failure("Ctrl+Hyper")).toBe("unknown-token");
  });

  test("a chord no browser gives the page is rejected outright", () => {
    expect(failure("Ctrl+T")).toBe("reserved-chord");
    expect(failure("Ctrl+W")).toBe("reserved-chord");
    expect(failure("Ctrl+Shift+N")).toBe("reserved-chord");
    expect(failure("Ctrl+Tab")).toBe("reserved-chord");
    expect(failure("Prefix+Ctrl+Tab")).toBe("reserved-chord");
    expect(failure("Ctrl+1")).toBe("reserved-chord");
  });

  test("a chord only SOME browsers keep is accepted and marked", () => {
    // The case this tier exists for: Firefox on Linux quits on Ctrl+Q and cannot be stopped, while
    // Chrome hands it to the page. Refusing it would take a working binding from the operators whose
    // browser leaves it alone.
    const ctrlQ = parseBinding("Ctrl+Q");
    expect(ctrlQ.ok).toBe(true);
    expect(ctrlQ.ok && ctrlQ.hazard).toBe("risky");

    const altQ = parseBinding("Alt+Q");
    expect(altQ.ok && altQ.hazard).toBe("none");

    expect(chordHazard(parsed("Alt+1").chord)).toBe("risky");
    expect(chordHazard(parsed("Ctrl+Shift+P").chord)).toBe("none");
  });
});

describe("matching a key event", () => {
  const chord = parsed("Ctrl+Shift+P").chord;

  test("matches only the exact modifier set", () => {
    expect(
      chordMatchesEvent(chord, {
        code: "KeyP",
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
        metaKey: false,
      }),
    ).toBe(true);
  });

  test("an extra modifier is a different chord, not a looser one", () => {
    expect(
      chordMatchesEvent(chord, {
        code: "KeyP",
        ctrlKey: true,
        altKey: true,
        shiftKey: true,
        metaKey: false,
      }),
    ).toBe(false);
  });

  test("a missing modifier does not match either", () => {
    expect(
      chordMatchesEvent(chord, {
        code: "KeyP",
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      }),
    ).toBe(false);
  });

  test("the modifier keys themselves never start a match", () => {
    expect(isModifierCode("ShiftLeft")).toBe(true);
    expect(isModifierCode("ControlRight")).toBe(true);
    expect(isModifierCode("KeyP")).toBe(false);
  });
});

describe("a modifier as the key, and modifiers with a side", () => {
  test("a lone modifier is the key, and its own family is not asked for again", () => {
    // `RAlt` is the right Alt KEY. Asking for Alt as well would make it unmatchable: the event that
    // delivers it already reports `altKey: true`, because the key being pressed IS Alt.
    expect(parsed("RAlt").chord).toEqual({
      code: "AltRight",
      ctrl: "absent",
      alt: "absent",
      shift: "absent",
      meta: "absent",
    });
    expect(parsed("Alt").chord.code).toBe("Alt");
    expect(parsed("LShift").chord.code).toBe("ShiftLeft");
  });

  test("a side is an L or R on any spelling the family already accepts", () => {
    expect(parsed("Roption").chord.code).toBe("AltRight");
    expect(parsed("Lcontrol").chord.code).toBe("ControlLeft");
    expect(parsed("Rcmd").chord.code).toBe("MetaRight");
  });

  test("`left` and `right` are still the arrow keys", () => {
    // The exact name is tried before the sided form, which is the whole reason these do not read as
    // an `L` followed by nonsense.
    expect(parsed("Alt+Left").chord.code).toBe("ArrowLeft");
    expect(parsed("Alt+Right").chord.code).toBe("ArrowRight");
  });

  test("a side on a modifier that qualifies another key", () => {
    expect(parsed("RAlt+Q").chord).toEqual({
      code: "KeyQ",
      ctrl: "absent",
      alt: "right",
      shift: "absent",
      meta: "absent",
    });
  });

  test("the last modifier written is the key when no key follows", () => {
    expect(parsed("Ctrl+RAlt").chord).toEqual({
      code: "AltRight",
      ctrl: "either",
      alt: "absent",
      shift: "absent",
      meta: "absent",
    });
  });

  test("every one of these formats back to what was written", () => {
    for (const text of ["RAlt", "Alt", "LShift", "RAlt+Q", "Ctrl+RAlt", "LCtrl+Shift+P"]) {
      expect(formatBinding(parsed(text))).toBe(text);
    }
  });

  test("a modifier bound as a key is marked risky rather than refused", () => {
    // On the layouts where right Alt is AltGr the browser reports Control alongside it, so the chord
    // silently never matches; in Firefox a bare Alt reaches the menu bar. It works on the machines
    // where it works, and the operator is owed the warning on the others.
    const result = parseBinding("RAlt");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hazard).toBe("risky");
  });
});

describe("matching a chord that asks for a side", () => {
  const event = (code: string, mods: Partial<Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>> = {}) => ({
    code,
    ctrlKey: mods.ctrlKey ?? false,
    altKey: mods.altKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    metaKey: mods.metaKey ?? false,
  });

  test("a bare modifier matches only its own side, and the family form matches either", () => {
    expect(chordMatchesEvent(parsed("RAlt").chord, event("AltRight", { altKey: true }))).toBe(true);
    expect(chordMatchesEvent(parsed("RAlt").chord, event("AltLeft", { altKey: true }))).toBe(false);
    expect(chordMatchesEvent(parsed("Alt").chord, event("AltLeft", { altKey: true }))).toBe(true);
    expect(chordMatchesEvent(parsed("Alt").chord, event("AltRight", { altKey: true }))).toBe(true);
  });

  test("a bare modifier still refuses the modifiers it did not ask for", () => {
    // The AltGr shape: the browser reports Control alongside the right Alt, and this chord asked for
    // no Control. It fails to match, which is the correct way to be wrong on those layouts.
    expect(
      chordMatchesEvent(parsed("RAlt").chord, event("AltRight", { altKey: true, ctrlKey: true })),
    ).toBe(false);
  });

  test("a sided qualifier needs the held set, and matches nothing without it", () => {
    const chord = parsed("RAlt+Q").chord;
    const pressed = event("KeyQ", { altKey: true });
    // Nothing tracked: the browser said `altKey` and never which one, so the honest answer is no.
    expect(chordMatchesEvent(chord, pressed)).toBe(false);
    expect(chordMatchesEvent(chord, pressed, new Set(["AltRight"]))).toBe(true);
    expect(chordMatchesEvent(chord, pressed, new Set(["AltLeft"]))).toBe(false);
  });

  test("an unsided qualifier does not care what is in the held set", () => {
    const chord = parsed("Alt+Q").chord;
    expect(chordMatchesEvent(chord, event("KeyQ", { altKey: true }))).toBe(true);
    expect(chordMatchesEvent(chord, event("KeyQ", { altKey: true }), new Set(["AltLeft"]))).toBe(true);
  });
});
