import { terminalKey, terminalReference, type BindingPane } from "./identity.ts";

/** Adapt existing row/space stores without introducing a second favorite store. */
export interface BindingPlace { readonly row: string; readonly space: string }
const PREFIX = "fleet-terminal:v1:";
const TERMINAL_SPACE = "@terminal";

export function bindingPlace(pane: BindingPane, legacy: BindingPlace): BindingPlace {
  const reference = terminalReference(pane);
  return reference ? { row: PREFIX + terminalKey(reference), space: TERMINAL_SPACE } : legacy;
}

export function isTerminalPlace(place: BindingPlace): boolean {
  return place.row.startsWith(PREFIX) && place.space === TERMINAL_SPACE;
}

export interface PlaceEvidence {
  readonly legacy: BindingPlace;
  readonly current: BindingPlace;
  readonly target?: string;
}

/** Uniqueness is checked on both sides; no name/cwd/order-based relocation guesses. */
export function migratePlaces<T extends BindingPlace>(
  records: readonly T[], evidence: readonly PlaceEvidence[], fresh: boolean,
): readonly T[] {
  if (!fresh) return records;
  let changed = false;
  const migrated = records.map((record) => {
    if (isTerminalPlace(record)) return record;
    const matches = evidence.filter((entry) => entry.legacy.row === record.row && entry.legacy.space === record.space);
    const match = matches[0];
    if (matches.length !== 1 || !match || !isTerminalPlace(match.current)) return record;
    if (new Set(evidence.filter((entry) => entry.current.row === match.current.row && entry.current.space === match.current.space).map((entry) => entry.target ?? entry.legacy.row)).size !== 1) return record;
    changed = true;
    return { ...record, ...match.current };
  });
  return changed ? migrated : records;
}
