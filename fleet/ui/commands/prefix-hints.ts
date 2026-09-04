// What the prefix leads to, as rows a panel can draw while it waits.
//
// Derived from the SAME effective bindings the recognizer was built from, and never from the machine
// itself. The machine answers one question — does this key complete a binding — and a second
// interface asking it "which keys would" would give a state machine two jobs. Reading its input
// instead keeps the two in step by construction, and keeps this pure.
//
// Only `prefix` bindings appear. A direct chord is not what a pending prefix is waiting for, and
// listing one would suggest the operator should press it now.

import { formatBinding, type Binding } from "./bindings.ts";
import { commandById, type CommandId, type CommandScope } from "./catalog.ts";

/** How many entries a panel that cannot scroll is willing to draw. */
export const PREFIX_HINT_LIMIT = 60;

/** The groups, in the order they are shown. Roughly outside-in: the app, then the thing in it. */
export const PREFIX_HINT_GROUPS: readonly CommandScope[] = [
  "global",
  "space",
  "tab",
  "pane",
  "navigation",
];

export interface PrefixHint {
  readonly id: CommandId;
  /** The second chord, spelled as the operator would press it — `Shift+P`, `Tab`, `?`, `1`. */
  readonly chord: string;
  /** The command's English name, the same one every other surface shows. */
  readonly name: string;
}

export interface PrefixHintGroup {
  readonly scope: CommandScope;
  readonly hints: readonly PrefixHint[];
}

export interface PrefixHints {
  readonly groups: readonly PrefixHintGroup[];
  /** How many entries did not fit under the ceiling. Zero in every ordinary configuration. */
  readonly elided: number;
}

/**
 * Sort a group's rows into an order a reader can scan.
 *
 * Plain letters first and alphabetically, then everything else — digits, `Tab`, punctuation, the
 * modifier-bearing chords — in their own alphabetical run. The operator is looking for a letter they
 * half-remember far more often than for `Shift+Tab`, and a strict lexicographic sort would file every
 * `Shift+…` above every plain key and bury exactly what they came to find.
 */
function isPlainLetter(hint: PrefixHint): boolean {
  return /^[A-Za-z]$/.test(hint.chord);
}

function byReadability(a: PrefixHint, b: PrefixHint): number {
  const rank = Number(!isPlainLetter(a)) - Number(!isPlainLetter(b));
  if (rank !== 0) return rank;
  return a.chord.localeCompare(b.chord, "en");
}

/**
 * The rows for a pending prefix.
 *
 * `bindings` is the effective map — defaults with the operator's document already applied — so an
 * unbound command contributes nothing and a rebound one appears under its new chord. A command
 * reached by several prefix chords contributes one row each, because each is a different key to
 * press.
 */
export function prefixHints(
  bindings: ReadonlyMap<CommandId, readonly Binding[]>,
  limit: number = PREFIX_HINT_LIMIT,
): PrefixHints {
  const byScope = new Map<CommandScope, PrefixHint[]>();
  let total = 0;

  for (const [id, own] of bindings) {
    for (const binding of own) {
      if (binding.kind !== "prefix") continue;
      const command = commandById(id);
      const rows = byScope.get(command.scope) ?? [];
      rows.push({
        id,
        // Spelled as the second chord alone: the prefix is already pressed, and repeating it on
        // every row would spend the panel's width saying what the operator just did.
        chord: formatBinding({ kind: "direct", chord: binding.chord }),
        name: command.name,
      });
      byScope.set(command.scope, rows);
      total += 1;
    }
  }

  const groups: PrefixHintGroup[] = [];
  let budget = Math.max(0, limit);
  for (const scope of PREFIX_HINT_GROUPS) {
    const rows = byScope.get(scope);
    if (rows === undefined || rows.length === 0) continue;
    if (budget === 0) break;
    const sorted = rows.toSorted(byReadability);
    const taken = sorted.slice(0, budget);
    budget -= taken.length;
    groups.push({ scope, hints: taken });
  }

  const shown = groups.reduce((sum, group) => sum + group.hints.length, 0);
  return { groups, elided: total - shown };
}
