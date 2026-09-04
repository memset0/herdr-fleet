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
      chord: { code: "KeyP", ctrl: true, alt: false, shift: true, meta: false },
    });
  });

  test("a prefix binding is a second chord, not a modifier", () => {
    expect(parsed("Prefix+S")).toEqual({
      kind: "prefix",
      chord: { code: "KeyS", ctrl: false, alt: false, shift: false, meta: false },
    });
  });

  test("the second chord may carry its own modifiers", () => {
    expect(parsed("Prefix+Ctrl+R")).toEqual({
      kind: "prefix",
      chord: { code: "KeyR", ctrl: true, alt: false, shift: false, meta: false },
    });
  });

  test("`?` is the Slash key with its own Shift, and formats back as `?`", () => {
    const binding = parsed("Prefix+?");
    expect(binding.chord).toEqual({ code: "Slash", ctrl: false, alt: false, shift: true, meta: false });
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
    expect(failure("Ctrl")).toBe("no-key");
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
