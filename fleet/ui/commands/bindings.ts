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

/** Which side of the keyboard a modifier is on. */
export type ModifierSide = "left" | "right";

/**
 * What a chord asks of one modifier family.
 *
 * `either` is what a plain `Alt` means and is deliberately the DEFAULT reading: an operator who does
 * not care which Alt should not have to say so twice. A side is only ever asked for explicitly.
 */
export type ModifierRequirement = "absent" | "either" | ModifierSide;

export type ModifierName = "ctrl" | "alt" | "shift" | "meta";

export const MODIFIER_NAMES: readonly ModifierName[] = ["ctrl", "alt", "shift", "meta"];

/** A chord: one key plus what it asks of every modifier family. */
export interface Chord {
  /**
   * The key. Ordinarily a `KeyboardEvent.code`.
   *
   * A MODIFIER CAN BE THE KEY, and then this is either that modifier's own code (`AltRight`) or its
   * family name (`Alt`) when the operator did not name a side. The family it belongs to is then
   * `absent` below and is not checked — it is held by definition, being the key that was pressed.
   */
  readonly code: string;
  readonly ctrl: ModifierRequirement;
  readonly alt: ModifierRequirement;
  readonly shift: ModifierRequirement;
  readonly meta: ModifierRequirement;
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

const MODIFIERS = new Map<string, ModifierName>([
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

/** Each modifier family's two physical codes, left first. */
const MODIFIER_KEY_CODES = {
  ctrl: ["ControlLeft", "ControlRight"],
  alt: ["AltLeft", "AltRight"],
  shift: ["ShiftLeft", "ShiftRight"],
  meta: ["MetaLeft", "MetaRight"],
} as const satisfies Record<ModifierName, readonly [string, string]>;

/** How a family is written when a chord names it as its key without naming a side. */
const MODIFIER_FAMILY_CODES = {
  ctrl: "Control",
  alt: "Alt",
  shift: "Shift",
  meta: "Meta",
} as const satisfies Record<ModifierName, string>;

/** How a family is written in a formatted binding. */
const MODIFIER_LABELS = {
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  meta: "Meta",
} as const satisfies Record<ModifierName, string>;

function sideCode(family: ModifierName, side: ModifierSide): string {
  const codes = MODIFIER_KEY_CODES[family];
  return side === "left" ? codes[0] : codes[1];
}

/**
 * Read a chord's key as a modifier, or `null` when it is an ordinary key.
 *
 * This is the predicate the whole "a modifier can be a binding" idea rests on, so it is one function
 * and every caller asks it rather than testing a code prefix of their own.
 */
export function modifierKeyOf(
  code: string,
): { readonly family: ModifierName; readonly side: ModifierSide | null } | null {
  for (const family of MODIFIER_NAMES) {
    if (code === MODIFIER_FAMILY_CODES[family]) return { family, side: null };
    const codes = MODIFIER_KEY_CODES[family];
    if (code === codes[0]) return { family, side: "left" };
    if (code === codes[1]) return { family, side: "right" };
  }
  return null;
}

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
  const ctrl = chord.ctrl !== "absent";
  const alt = chord.alt !== "absent";
  const shift = chord.shift !== "absent";
  if (ctrl && !alt && (chord.code === "KeyN" || chord.code === "KeyT" || chord.code === "KeyW")) {
    return true;
  }
  // Tab-to-tab traversal, both directions.
  if (ctrl && chord.code === "Tab") return true;
  // Ctrl with a digit selects a browser tab. Shift+Ctrl+digit does not, so the test is exact.
  if (ctrl && !alt && !shift && DIGIT_CODE.test(chord.code)) return true;
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
  // A modifier bound as a KEY is browser- and layout-dependent in a way nothing else here is. On the
  // layouts where right Alt is AltGr the browser also reports Control, so the chord silently never
  // matches; in Firefox a bare Alt release reaches the menu bar. It works, and where it does not the
  // operator is owed the warning rather than a key that does nothing.
  if (modifierKeyOf(chord.code) !== null) return true;
  if (chord.meta !== "absent") return true;
  if (chord.ctrl !== "absent" && chord.alt === "absent" && chord.shift === "absent") {
    // The browser's own single-letter accelerators. All are preventable, but an extension or a
    // native dialog can still take one first, and the failure is visible (a print sheet, a reload).
    if (["KeyP", "KeyS", "KeyF", "KeyD", "KeyO", "KeyR", "KeyQ", "KeyL", "KeyJ"].includes(chord.code)) {
      return true;
    }
  }
  // Firefox on Linux and Windows also selects tabs with Alt and a digit; Chrome does not.
  if (chord.alt !== "absent" && chord.ctrl === "absent" && DIGIT_CODE.test(chord.code)) return true;
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
  const asked = new Map<ModifierName, ModifierRequirement>();
  // In the order written, so the LAST one can become the key when no key follows it.
  const namedModifiers: { name: ModifierName; side: ModifierSide | null }[] = [];
  let code: string | null = null;
  let impliedShift = false;

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

    const modifier = readModifier(lower);
    if (modifier !== null) {
      // A key already claimed means the modifier is trailing it, which is the same mistake as an
      // extra key: the operator wrote something whose order does not say what they meant.
      if (code !== null) return { ok: false, failure: { reason: "extra-key", token } };
      if (asked.has(modifier.name)) return { ok: false, failure: { reason: "repeated-modifier", token } };
      asked.set(modifier.name, modifier.side ?? "either");
      namedModifiers.push(modifier);
      continue;
    }

    if (code !== null) return { ok: false, failure: { reason: "extra-key", token } };

    const named = NAMED_KEYS.get(lower);
    if (named !== undefined) {
      code = named.code;
      if (named.shift === true) impliedShift = true;
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

  if (code === null) {
    // NO KEY FOLLOWED, so the last modifier written IS the key: `RAlt` is the right Alt key, not a
    // right Alt held over nothing. `Ctrl+RAlt` reads the same way — Ctrl held, right Alt pressed.
    // A binding with no tokens at all is still the parse failure it always was.
    const key = namedModifiers.at(-1);
    if (key === undefined) return { ok: false, failure: { reason: "no-key" } };
    asked.delete(key.name);
    code = key.side === null ? MODIFIER_FAMILY_CODES[key.name] : sideCode(key.name, key.side);
  }

  if (impliedShift && !asked.has("shift")) asked.set("shift", "either");

  const chord: Chord = {
    code,
    ctrl: asked.get("ctrl") ?? "absent",
    alt: asked.get("alt") ?? "absent",
    shift: asked.get("shift") ?? "absent",
    meta: asked.get("meta") ?? "absent",
  };
  const hazard = chordHazard(chord);
  if (hazard === "reserved") return { ok: false, failure: { reason: "reserved-chord" } };
  return { ok: true, binding: { kind, chord }, hazard };
}

/**
 * Read one token as a modifier, sided or not.
 *
 * A side is an `L`/`R` prefix on any spelling the family already accepts, so `RAlt`, `Roption` and
 * `RControl` all work without a second table to keep in step. The exact name is tried FIRST, which
 * is what keeps `left` and `right` reading as the arrow keys they are rather than as a stray `L`
 * followed by nonsense.
 */
function readModifier(lower: string): { name: ModifierName; side: ModifierSide | null } | null {
  const exact = MODIFIERS.get(lower);
  if (exact !== undefined) return { name: exact, side: null };
  const first = lower.slice(0, 1);
  if (first !== "l" && first !== "r") return null;
  const family = MODIFIERS.get(lower.slice(1));
  if (family === undefined) return null;
  return { name: family, side: first === "l" ? "left" : "right" };
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

  // `?` carries its own Shift, so naming Shift again would spell a chord the operator never wrote.
  const shiftIsTheKey = chord.code === "Slash" && chord.shift !== "absent";
  for (const family of MODIFIER_NAMES) {
    const asked = chord[family];
    if (asked === "absent") continue;
    if (family === "shift" && shiftIsTheKey) continue;
    parts.push(`${sidePrefix(asked)}${MODIFIER_LABELS[family]}`);
  }

  const key = modifierKeyOf(chord.code);
  const named = KEY_LABELS.get(chord.code);
  if (shiftIsTheKey) parts.push("?");
  else if (key !== null) parts.push(`${key.side === null ? "" : key.side === "left" ? "L" : "R"}${MODIFIER_LABELS[key.family]}`);
  else if (named !== undefined) parts.push(named);
  else if (chord.code.startsWith("Key")) parts.push(chord.code.slice(3));
  else if (chord.code.startsWith("Digit")) parts.push(chord.code.slice(5));
  else parts.push(chord.code);

  return parts.join("+");
}

/** `L`/`R` where a side was asked for, and nothing where either will do. */
function sidePrefix(asked: ModifierRequirement): string {
  if (asked === "left") return "L";
  if (asked === "right") return "R";
  return "";
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

/** The fields of a key event a chord is matched against. */
export interface ChordEvent {
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
}

function modifierIsDown(family: ModifierName, event: ChordEvent): boolean {
  if (family === "ctrl") return event.ctrlKey;
  if (family === "alt") return event.altKey;
  if (family === "shift") return event.shiftKey;
  return event.metaKey;
}

/** Nothing held, for the callers that do not track sides. */
const NOTHING_HELD: ReadonlySet<string> = new Set();

/**
 * Whether a key event is exactly this chord.
 *
 * Exact, in both directions: every modifier the chord names must be held, and every modifier it does
 * not name must NOT be held. A chord that matched a superset would make `Ctrl+Shift+P` fire on
 * `Ctrl+Alt+Shift+P`, which is a different key the operator may have bound to something else.
 *
 * WHY `held` EXISTS. A browser reports THAT a modifier is down and never WHICH ONE: the event for
 * `Q` pressed with the right Alt says `altKey: true` and nothing more. The only place a side is
 * observable is the modifier key's own event, so a caller that wants sided chords to work has to
 * remember which modifier codes are currently down and pass that set in. Without it a sided
 * requirement simply never matches, which is the right way to be wrong: a binding that does nothing
 * beats one that fires on the wrong key.
 */
export function chordMatchesEvent(
  chord: Chord,
  event: ChordEvent,
  held: ReadonlySet<string> = NOTHING_HELD,
): boolean {
  const key = modifierKeyOf(chord.code);
  if (key === null) {
    if (chord.code !== event.code) return false;
  } else if (key.side === null) {
    const codes = MODIFIER_KEY_CODES[key.family];
    if (event.code !== codes[0] && event.code !== codes[1]) return false;
  } else if (event.code !== sideCode(key.family, key.side)) {
    return false;
  }

  for (const family of MODIFIER_NAMES) {
    // The key's own family is held by definition — it IS the key that was pressed — so asking again
    // would make every bare-modifier chord unmatchable.
    if (key !== null && key.family === family) continue;
    const asked = chord[family];
    const down = modifierIsDown(family, event);
    if (asked === "absent") {
      if (down) return false;
      continue;
    }
    if (!down) return false;
    if (asked === "either") continue;
    if (!held.has(sideCode(family, asked))) return false;
  }
  return true;
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
