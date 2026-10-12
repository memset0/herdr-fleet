// The key-hint footer of a pi-family question screen, read as a CONTRACT (.adr/0098).
//
// A pi question extension draws its own footer, and each one words it differently. The footer is
// still the one thing on the screen that says which keys do what, so the reader takes every plan from
// it and from nothing else:
//
//   ↑↓ navigate • Enter to select • Esc to cancel                         stock `question` (pi 0.87.1, 1.1.0)
//   ↑↓ navigate • Enter select • Esc cancel                               stock `questionnaire`, one question
//   Tab/←→ navigate • ↑↓ select • Enter confirm • Esc cancel              stock `questionnaire`, several
//   ↑↓ navigate • Enter to select • Tab to add note • type a number or an answer • Esc to cancel
//                                                                         the PR 397 extension (pi--v110-*)
//   ↑↓ move  1-9 select  space select  enter next  tab next question  c comment  esc cancel
//                                                                         OmO's built-in ask (pi--omo-v5130-*)
//
// Two separators (` • ` and OmO's double space; ` · ` too, which pi's own modals print) and two hint
// forms (`<key> to <verb>` and `<key> <verb>`). Every segment must be a hint whose key is in the
// small set below, or prose that starts with `type` (a footer that says digits are TYPED TEXT, which
// makes no plan, ADR 0098). One segment that is neither, and the row is not a footer: a countdown, a
// scroll indicator, a status line. What a verb means is read per key, and only the verbs below count;
// any other verb leaves that key with no role, so it can never be the reason a plan exists.
//
// Pure, no harness imports.

/** What the footer says Enter does on this screen. */
export type EnterRole = "select" | "submit" | "other";

export interface PiFooter {
  /** The joined text that was parsed (one space between wrapped rows). */
  text: string;
  /** ↑↓ named, with a verb that moves the pointer (`navigate`, `move`, or `select` as the stock
   *  questionnaire's `↑↓ select` says it). */
  arrowsMove: boolean;
  /** Enter's role, or null when the footer does not name Enter. `select` and `confirm` are `select`;
   *  `submit` is `submit`; every other verb (`next`, `toggle`, `save and next`, `goes to the first
   *  unanswered`) is `other`. */
  enter: EnterRole | null;
  /** `1-9 select`: a digit picks an option. A footer that only says digits may be TYPED is not this. */
  digitsSelect: boolean;
  /** Space named as `tick` or `toggle`. */
  spaceToggles: boolean;
  /** The verb the footer gives Escape (`cancel`, `go back`, `discard`), or null when Esc is not named. */
  escapeVerb: string | null;
  /** Left/Right or Tab named as moving between tabs. */
  tabs: boolean;
}

// Segment separators: a bullet or a middle dot with spaces round it, or a run of two or more spaces.
const SEPARATOR = /\s+[•·]\s+|\s{2,}/;
// `<key> to <verb>` or `<key> <verb>`. The key is one token; the verb is the rest.
const HINT = /^(\S+)\s+(?:to\s+)?(\S.*)$/i;

type KeyKind = "updown" | "leftright" | "enter" | "escape" | "space" | "digits" | "tab" | "letter";

function keyKind(token: string): KeyKind | null {
  if (token === "↑↓" || token === "↑/↓") return "updown";
  if (token === "←→" || token === "←/→" || /^tab\/←\/?→$/i.test(token)) return "leftright";
  if (/^enter$/i.test(token)) return "enter";
  // pi's own core modals print `Escape/Ctrl+C to cancel` (pi--v110-core-selector.txt).
  if (/^(?:esc|escape)(?:\/ctrl\+c)?$/i.test(token)) return "escape";
  if (/^space$/i.test(token)) return "space";
  if (token === "1-9") return "digits";
  if (/^(?:tab|shift\+tab)$/i.test(token)) return "tab";
  if (/^[a-z]$/.test(token) || /^ctrl\+[a-z]$/i.test(token)) return "letter";
  return null;
}

/**
 * Parse one footer, the rows of a wrapped one joined with a space. Null when any segment is neither a
 * hint with a known key nor `type …` prose, or when there are fewer than two segments.
 */
export function parsePiFooter(text: string): PiFooter | null {
  const trimmed = text.trim();
  // A row the terminal wrapped can end in its separator (`… Tab to add note •`, pi--v110-single-narrow).
  const segments = trimmed.split(SEPARATOR).map((s) => s.trim()).filter((s) => s.length > 0 && s !== "•");
  if (segments.length < 2) return null;
  const footer: PiFooter = {
    text: trimmed,
    arrowsMove: false,
    enter: null,
    digitsSelect: false,
    spaceToggles: false,
    escapeVerb: null,
    tabs: false,
  };
  for (const segment of segments) {
    // Typed-text prose: `type a number or an answer`, `type numbers (1,3) or an answer`, `type 1,3`.
    if (/^type\b/i.test(segment)) continue;
    const m = HINT.exec(segment);
    if (m === null) return null;
    const kind = keyKind(m[1]!);
    if (kind === null) return null;
    const verb = m[2]!.trim().toLowerCase();
    switch (kind) {
      case "updown":
        if (verb === "navigate" || verb === "move" || verb === "select") footer.arrowsMove = true;
        break;
      case "enter":
        // Two Enter hints on one footer are two claims; keep the stricter reading.
        footer.enter = combineEnter(footer.enter, enterRole(verb));
        break;
      case "digits":
        if (verb === "select") footer.digitsSelect = true;
        break;
      case "space":
        if (verb === "tick" || verb === "toggle") footer.spaceToggles = true;
        break;
      case "escape":
        footer.escapeVerb = m[2]!.trim();
        break;
      case "leftright":
        footer.tabs = true;
        break;
      case "tab":
      case "letter":
        break;
    }
  }
  return footer;
}

function enterRole(verb: string): EnterRole {
  if (verb === "select" || verb === "confirm") return "select";
  if (verb === "submit") return "submit";
  return "other";
}

function combineEnter(a: EnterRole | null, b: EnterRole): EnterRole {
  if (a === null || a === b) return b;
  return "other";
}

