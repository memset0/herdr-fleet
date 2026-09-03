/**
 * Whether a label is a NAME rather than a multiplexer's ordinal.
 *
 * Herdr labels an unnamed pane with its number, so a surface that took that value would read `1`
 * where the Tab beside it carries the name the operator actually typed. Digits only — a name that
 * merely CONTAINS a number (`v2`, `pass 3`) is still a name, and a person who deliberately names a
 * pane `7` gets the same answer as the counter, which is the one collision this rule cannot tell
 * apart and does not try to.
 *
 * It lives on its own because two surfaces ask it: the hierarchy, when a Tab is elided into its one
 * Pane, and the Agent rail's row, whose first line names the same thing.
 */
export function operatorChosenName(label: string | undefined): string | undefined {
  if (label === undefined || label.length === 0) return undefined;
  return /^\d+$/.test(label) ? undefined : label;
}
