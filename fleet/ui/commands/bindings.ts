// The binding grammar: the text an operator writes in their settings document, and the exact key
// event it has to match.
//
// A binding is one of two shapes and never a third. A DIRECT binding is modifiers and a key pressed
// together (`Ctrl+Shift+P`). A PREFIX binding is the configured prefix chord pressed and released,
// then a second chord (`Prefix+Shift+Tab`). Both end in exactly one key; what differs is whether the
// prefix is held or completed first.
//
// **Matching is on the physical CODE, never on `key`.** `key` is what the layout produced, so it
// moves with the layout, with the IME, and with Shift — `Shift+/` reports `?` on one keyboard and
// something else on another, and a binding that matched `key` would silently stop working when the
// operator switched layouts. `code` is the physical key, which is what "the P key" actually means.
// The one place the produced character matters is how a binding is SPELLED (`?` reads better than
// `Shift+Slash`), and that is a formatting concern, handled at the two ends of this module.
//
// Everything here is pure and total: it never throws, never touches the DOM, and answers about text
// and about plain chord records. The recognizer owns the state machine; this module owns the grammar.

/** A chord: one physical key plus the exact modifier set that must be held with it. */
export interface Chord {
  readonly code: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
}

/**
 * A parsed binding.
 *
 * `direct` fires when its chord is pressed. `prefix` fires when the configured prefix has been
 * completed and released, and this chord follows within the pending window.
 */
export type Binding =
  | { readonly kind: "direct"; readonly chord: Chord }
  | { readonly kind: "prefix"; readonly chord: Chord };

/** How usable a chord is in a real browser. */
export type ChordHazard =
  /** Nothing takes it; it will reach the page everywhere. */
  | "none"
  /** Some browsers or platforms keep it. It is allowed, and the operator is told. */
  | "risky"
  /** No browser lets a page see it. Binding it produces a key that can never fire. */
  | "reserved";

export type BindingParseFailure =
  | { readonly reason: "empty" }
  | { readonly reason: "unknown-token"; readonly token: string }
  | { readonly reason: "no-key" }
  | { readonly reason: "extra-key"; readonly token: string }
  | { readonly reason: "repeated-modifier"; readonly token: string }
  | { readonly reason: "prefix-not-first" }
  | { readonly reason: "reserved-chord" };

export type BindingParseResult =
  | { readonly ok: true; readonly binding: Binding; readonly hazard: ChordHazard }
  | { readonly ok: false; readonly failure: BindingParseFailure };

const MODIFIERS = new Map<string, "ctrl" | "alt" | "shift" | "meta">([
  ["ctrl", "ctrl"],
  ["control", "ctrl"],
  ["alt", "alt"],
  ["option", "alt"],
  ["shift", "shift"],
  ["meta", "meta"],
  ["cmd", "meta"],
  ["command", "meta"],
  ["super", "meta"],
]);

/**
 * The named keys, spelled the way an operator would write them, mapped to their physical code.
 *
 * `?` is in here rather than special-cased at the parser's top because it IS a named key from the
 * operator's side — they press the key marked `?`, which is `Slash`, and Shift is how that key
 * produces the character. The implied Shift is applied where the entry is read, and dropped again
 * when the binding is formatted, so `Prefix+?` survives a parse/format round trip unchanged.
 */
const NAMED_KEYS = new Map<string, { code: string; shift?: true }>([
  ["tab", { code: "Tab" }],
  ["enter", { code: "Enter" }],
  ["return", { code: "Enter" }],
  ["escape", { code: "Escape" }],
  ["esc", { code: "Escape" }],
  ["space", { code: "Space" }],
  ["backspace", { code: "Backspace" }],
  ["up", { code: "ArrowUp" }],
  ["down", { code: "ArrowDown" }],
  ["left", { code: "ArrowLeft" }],
  ["right", { code: "ArrowRight" }],
  ["-", { code: "Minus" }],
  ["minus", { code: "Minus" }],
  ["=", { code: "Equal" }],
  ["/", { code: "Slash" }],
  ["?", { code: "Slash", shift: true }],
  [",", { code: "Comma" }],
  [".", { code: "Period" }],
  [";", { code: "Semicolon" }],
  ["'", { code: "Quote" }],
  ["[", { code: "BracketLeft" }],
  ["]", { code: "BracketRight" }],
  ["\\", { code: "Backslash" }],
  ["`", { code: "Backquote" }],
]);

/** The reverse of {@link NAMED_KEYS}, for formatting. Only the spelling we want back out. */
const KEY_LABELS = new Map<string, string>([
  ["Tab", "Tab"],
  ["Enter", "Enter"],
  ["Escape", "Escape"],
  ["Space", "Space"],
  ["Backspace", "Backspace"],
  ["ArrowUp", "Up"],
  ["ArrowDown", "Down"],
  ["ArrowLeft", "Left"],
  ["ArrowRight", "Right"],
  ["Minus", "-"],
  ["Equal", "="],
  ["Comma", ","],
  ["Period", "."],
  ["Semicolon", ";"],
  ["Quote", "'"],
  ["BracketLeft", "["],
  ["BracketRight", "]"],
  ["Backslash", "\\"],
  ["Backquote", "`"],
]);

/**
 * Chords no browser hands to a page. Binding one produces a key that can never fire, so the document
 * is refused rather than accepted into silence.
 *
 * Deliberately short. A chord belongs here only if EVERY major browser keeps it — anything that
 * depends on which browser or platform the operator is running is `risky` below, because refusing it
 * would take a working key away from the operators whose browser leaves it alone.
 */
function isReserved(chord: Chord): boolean {
  if (chord.ctrl && !chord.alt && (chord.code === "KeyN" || chord.code === "KeyT" || chord.code === "KeyW")) {
    return true;
  }
  // Tab-to-tab traversal, both directions.
  if (chord.ctrl && chord.code === "Tab") return true;
  // Ctrl with a digit selects a browser tab. Shift+Ctrl+digit does not, so the test is exact.
  if (chord.ctrl && !chord.alt && !chord.shift && DIGIT_CODE.test(chord.code)) return true;
  return false;
}

/**
 * Chords one browser or platform keeps and another does not. Allowed, and marked, so an operator
 * whose browser leaves the chord alone can use it while an operator whose browser does not is told
 * why their key is silent instead of hunting for a bug in the recognizer.
 *
 * `Ctrl+Q` is the one worth naming: Firefox on Linux and Windows QUITS on it and cannot be stopped,
 * while Chrome leaves it to the page. It is a perfectly good binding on one machine and a way to
 * lose your session on another, and that is exactly the distinction this tier exists to carry.
 */
function isRisky(chord: Chord): boolean {
  if (chord.meta) return true;
  if (chord.ctrl && !chord.alt && !chord.shift) {
    // The browser's own single-letter accelerators. All are preventable, but an extension or a
    // native dialog can still take one first, and the failure is visible (a print sheet, a reload).
    if (["KeyP", "KeyS", "KeyF", "KeyD", "KeyO", "KeyR", "KeyQ", "KeyL", "KeyJ"].includes(chord.code)) {
      return true;
    }
  }
  // Firefox on Linux and Windows also selects tabs with Alt and a digit; Chrome does not.
  if (chord.alt && !chord.ctrl && DIGIT_CODE.test(chord.code)) return true;
  return false;
}

const DIGIT_CODE = /^Digit[0-9]$/;

export function chordHazard(chord: Chord): ChordHazard {
  if (isReserved(chord)) return "reserved";
  if (isRisky(chord)) return "risky";
  return "none";
}

/**
 * Parse one binding.
 *
 * The grammar is `[Prefix+][modifier+]…key`, `+`-separated, case-insensitive, whitespace tolerated
 * around each token. `Prefix` is not a modifier — it is what makes the binding sequential — so it is
 * only meaningful as the first token and is rejected anywhere else rather than quietly ignored.
 */
export function parseBinding(text: string): BindingParseResult {
  const raw = text.trim();
  if (raw === "") return { ok: false, failure: { reason: "empty" } };

  const tokens = raw.split("+").map((token) => token.trim());
  let kind: Binding["kind"] = "direct";
  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  let code: string | null = null;

  for (const [index, token] of tokens.entries()) {
    if (token === "") return { ok: false, failure: { reason: "unknown-token", token } };
    const lower = token.toLowerCase();

    if (lower === "prefix") {
      // First token only. A `Ctrl+Prefix+P` is not a shape this grammar has, and reading it as one
      // of the two it does have would be guessing at what the operator meant.
      if (index !== 0) return { ok: false, failure: { reason: "prefix-not-first" } };
      kind = "prefix";
      continue;
    }

    const modifier = MODIFIERS.get(lower);
    if (modifier !== undefined) {
      // A key already claimed means the modifier is trailing it, which is the same mistake as an
      // extra key: the operator wrote something whose order does not say what they meant.
      if (code !== null) return { ok: false, failure: { reason: "extra-key", token } };
      if (modifier === "ctrl") {
        if (ctrl) return { ok: false, failure: { reason: "repeated-modifier", token } };
        ctrl = true;
      } else if (modifier === "alt") {
        if (alt) return { ok: false, failure: { reason: "repeated-modifier", token } };
        alt = true;
      } else if (modifier === "shift") {
        if (shift) return { ok: false, failure: { reason: "repeated-modifier", token } };
        shift = true;
      } else {
        if (meta) return { ok: false, failure: { reason: "repeated-modifier", token } };
        meta = true;
      }
      continue;
    }

    if (code !== null) return { ok: false, failure: { reason: "extra-key", token } };

    const named = NAMED_KEYS.get(lower);
    if (named !== undefined) {
      code = named.code;
      if (named.shift === true) shift = true;
      continue;
    }
    if (/^[a-z]$/.test(lower)) {
      code = `Key${lower.toUpperCase()}`;
      continue;
    }
    if (/^[0-9]$/.test(lower)) {
      code = `Digit${lower}`;
      continue;
    }
    return { ok: false, failure: { reason: "unknown-token", token } };
  }

  if (code === null) return { ok: false, failure: { reason: "no-key" } };

  const chord: Chord = { code, ctrl, alt, shift, meta };
  const hazard = chordHazard(chord);
  if (hazard === "reserved") return { ok: false, failure: { reason: "reserved-chord" } };
  return { ok: true, binding: { kind, chord }, hazard };
}

/**
 * The one spelling of a binding, used everywhere it is shown: the settings editor, the command bar's
 * trailing labels, and the acknowledgement that names the key actually pressed.
 *
 * Modifier order is fixed rather than preserved from the input, so two documents that mean the same
 * binding read the same and the duplicate check below cannot be fooled by ordering.
 */
export function formatBinding(binding: Binding): string {
  const { chord } = binding;
  const parts: string[] = [];
  if (binding.kind === "prefix") parts.push("Prefix");
  if (chord.ctrl) parts.push("Ctrl");
  if (chord.alt) parts.push("Alt");

  // `?` carries its own Shift, so naming Shift again would spell a chord the operator never wrote.
  const shiftIsTheKey = chord.code === "Slash" && chord.shift;
  if (chord.shift && !shiftIsTheKey) parts.push("Shift");
  if (chord.meta) parts.push("Meta");

  const named = KEY_LABELS.get(chord.code);
  if (shiftIsTheKey) parts.push("?");
  else if (named !== undefined) parts.push(named);
  else if (chord.code.startsWith("Key")) parts.push(chord.code.slice(3));
  else if (chord.code.startsWith("Digit")) parts.push(chord.code.slice(5));
  else parts.push(chord.code);

  return parts.join("+");
}

/** Identity for duplicate detection: two bindings collide when they are the same shape and chord. */
export function bindingKey(binding: Binding): string {
  return `${binding.kind}:${formatBinding(binding)}`;
}

export function chordsEqual(a: Chord, b: Chord): boolean {
  return (
    a.code === b.code && a.ctrl === b.ctrl && a.alt === b.alt && a.shift === b.shift && a.meta === b.meta
  );
}

/**
 * Whether a key event is exactly this chord.
 *
 * Exact, in both directions: every modifier the chord names must be held, and every modifier it does
 * not name must NOT be held. A chord that matched a superset would make `Ctrl+Shift+P` fire on
 * `Ctrl+Alt+Shift+P`, which is a different key the operator may have bound to something else.
 */
export function chordMatchesEvent(
  chord: Chord,
  event: { code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
): boolean {
  return (
    chord.code === event.code &&
    chord.ctrl === event.ctrlKey &&
    chord.alt === event.altKey &&
    chord.shift === event.shiftKey &&
    chord.meta === event.metaKey
  );
}

/** The modifier keys themselves, which are never a binding's key and never start a match. */
const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "MetaLeft",
  "MetaRight",
]);

export function isModifierCode(code: string): boolean {
  return MODIFIER_CODES.has(code);
}
