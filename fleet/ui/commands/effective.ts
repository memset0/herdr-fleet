// Resolving what is actually bound, and turning the catalog into rows the command bar can draw.
//
// "Effective" is one word doing real work. The shipped defaults are one document and the operator's
// settings are another, and the rule between them is REPLACEMENT per command, never a merge: a
// command the operator names takes exactly the bindings they gave it, including none at all, and a
// command they did not name keeps its shipped default. That is the same posture Collie already took
// for the operator's own command rows, and for the same reason — a half-chosen list belongs to
// nobody, and an operator who unbinds a key must not find it back tomorrow.
//
// Pure, so the settings editor can validate a document without a browser and the bar can be tested
// without one either.

import {
  bindingKey,
  formatBinding,
  modifierKeyOf,
  MODIFIER_NAMES,
  type Binding,
  type Chord,
  type ModifierName,
  type ModifierSide,
} from "./bindings.ts";
import { COMMAND_CATALOG, defaultBindings, type CommandDefinition, type CommandId } from "./catalog.ts";

/** One command as the command bar draws it. */
export interface CommandRow {
  readonly command: CommandDefinition;
  readonly bindings: readonly Binding[];
  /** How each binding is spelled, with the prefix rendered as the chord it actually is. */
  readonly labels: readonly string[];
}

/**
 * Resolve the effective bindings.
 *
 * `overrides` is the operator's document, already parsed. A command present there replaces its
 * default outright; a command absent keeps it. An empty array is a real answer — "bound to nothing"
 * — and is exactly why this cannot be written as `overrides.get(id) ?? defaults.get(id)` over a map
 * that treats empty as missing.
 */
export function resolveBindings(
  overrides?: ReadonlyMap<CommandId, readonly Binding[]>,
): ReadonlyMap<CommandId, readonly Binding[]> {
  const defaults = defaultBindings();
  if (overrides === undefined || overrides.size === 0) return defaults;
  const out = new Map<CommandId, readonly Binding[]>();
  for (const command of COMMAND_CATALOG) {
    const override = overrides.get(command.id);
    out.set(command.id, override ?? defaults.get(command.id) ?? []);
  }
  return out;
}

/**
 * How a binding is spelled for a human: a prefix binding as the prefix chord, a space, then the
 * second chord — `Ctrl+B Shift+P` rather than the literal word `Prefix`, which names the setting
 * and not the keys the hand pressed.
 */
export function describeBinding(binding: Binding, prefixLabel: string): string {
  if (binding.kind !== "prefix") return formatBinding(binding);
  return `${prefixLabel} ${formatBinding({ kind: "direct", chord: binding.chord })}`;
}

/** Every command, in catalog order, with its effective bindings and their labels. */
export function commandRows(
  bindings: ReadonlyMap<CommandId, readonly Binding[]>,
  prefixLabel: string,
): readonly CommandRow[] {
  return COMMAND_CATALOG.map((command) => {
    const own = bindings.get(command.id) ?? [];
    return {
      command,
      bindings: own,
      labels: own.map((binding) => describeBinding(binding, prefixLabel)),
    };
  });
}

export type DuplicateBinding = {
  readonly label: string;
  readonly commands: readonly [CommandId, CommandId];
};

/**
 * The one binding two commands both claim, if there is one.
 *
 * Checked over the EFFECTIVE set rather than over the operator's document alone, because a document
 * that rebinds one command onto another's untouched default collides just as hard as one that names
 * the same chord twice — and only the effective view can see that.
 */
export function findDuplicateBinding(
  bindings: ReadonlyMap<CommandId, readonly Binding[]>,
): DuplicateBinding | null {
  const seen = new Map<string, CommandId>();
  for (const [id, own] of bindings) {
    for (const binding of own) {
      const key = bindingKey(binding);
      const previous = seen.get(key);
      if (previous !== undefined) {
        return { label: formatBinding(binding), commands: [previous, id] };
      }
      seen.set(key, id);
    }
  }
  return null;
}

/**
 * A modifier bound as a key, and a binding that also wants it as a modifier.
 *
 * Named `claim` and `qualifier` because that is the relationship: the first CLAIMS the key, and the
 * second wanted to hold it while pressing something else. The two cannot both work.
 */
export interface ModifierConflict {
  /** The binding that took the modifier as its own key. */
  readonly claim: string;
  readonly claimedBy: ConflictOwner;
  /** The binding that wanted to hold it. */
  readonly qualifier: string;
  readonly qualifierOf: ConflictOwner;
}

/** Which binding a chord came from. The prefix is not a command and says so. */
export type ConflictOwner = { readonly kind: "command"; readonly id: CommandId } | { readonly kind: "prefix" };

interface OwnedChord {
  readonly chord: Chord;
  readonly label: string;
  readonly owner: ConflictOwner;
}

/**
 * The rule that makes a modifier bindable as a key at all.
 *
 * A MODIFIER CANNOT BE BOTH. The recognizer dispatches a modifier's own keydown so that `RAlt` can
 * fire — which means that if anything else were bound to `RAlt+Q`, pressing the right Alt to reach
 * it would fire the bare binding before the `Q` ever arrived. There is no ordering that rescues
 * this: the bare press genuinely happens first, and the machine cannot know whether a `Q` is coming.
 *
 * So the document decides instead. Claiming a modifier as a key takes it out of circulation as a
 * qualifier, and the two spellings compose the way the operator would expect:
 *
 *   - claim `RAlt`  → `RAlt+Q` is refused, and so is `Alt+Q`, which includes the right Alt.
 *     `LAlt+Q` still works.
 *   - claim `LAlt` and `RAlt` → `Alt` is gone entirely as a qualifier.
 *   - claim `Alt` (either side) → the same, in one line.
 *
 * The prefix chord is checked alongside the bindings, because it is a chord like any other and an
 * operator who claims `LCtrl` while running the default `Ctrl+B` prefix has broken their prefix.
 */
export function findModifierConflict(
  bindings: ReadonlyMap<CommandId, readonly Binding[]>,
  prefix: Chord | null,
): ModifierConflict | null {
  const all: OwnedChord[] = [];
  for (const [id, own] of bindings) {
    for (const binding of own) {
      all.push({ chord: binding.chord, label: formatBinding(binding), owner: { kind: "command", id } });
    }
  }
  if (prefix !== null) {
    all.push({
      chord: prefix,
      label: formatBinding({ kind: "direct", chord: prefix }),
      owner: { kind: "prefix" },
    });
  }

  const claims: { family: ModifierName; side: ModifierSide | null; owned: OwnedChord }[] = [];
  for (const owned of all) {
    const key = modifierKeyOf(owned.chord.code);
    if (key !== null) claims.push({ family: key.family, side: key.side, owned });
  }
  if (claims.length === 0) return null;

  for (const owned of all) {
    for (const family of MODIFIER_NAMES) {
      const asked = owned.chord[family];
      if (asked === "absent") continue;
      const taken = claims.find(
        (claim) =>
          claim.family === family &&
          // A claim with no side takes the whole family; a query with no side wants the whole
          // family, so either being unsided is enough for the two to collide.
          (claim.side === null || asked === "either" || claim.side === asked),
      );
      if (taken === undefined) continue;
      return {
        claim: taken.owned.label,
        claimedBy: taken.owned.owner,
        qualifier: owned.label,
        qualifierOf: owned.owner,
      };
    }
  }
  return null;
}

/** How a conflict's owner is named back to the operator. */
export function describeConflictOwner(owner: ConflictOwner): string {
  return owner.kind === "prefix" ? "the prefix" : owner.id;
}
