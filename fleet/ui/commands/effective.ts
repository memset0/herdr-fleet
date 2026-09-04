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

import { bindingKey, formatBinding, type Binding } from "./bindings.ts";
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
