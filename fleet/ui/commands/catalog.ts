// The command catalog: every thing a key, the command bar, or a settings control can ask Fleet to
// do, and the bindings a stock install ships with.
//
// The catalog is CLOSED. A command that is not here cannot be bound, listed, or invoked, and an
// invocation carries a command id and nothing else — no URL, no request path, no key sequence, no
// object id. That is the whole security posture of this system: the set of things a keystroke can
// cause is a list somebody reviewed, and widening it means adding an adapter and its tests, not
// passing a richer message.
//
// Ordinal families EXPAND into independent ids (`select-tab-1` … `select-tab-9`) rather than one
// parameterised command. A binding maps to an id, so an id has to be the whole address of what
// happens; a parameter would be an argument travelling with a keystroke, which is the thing above
// that this module refuses.

import { parseBinding, type Binding } from "./bindings.ts";

/** Ordinals go to nine because that is how many keys a single digit press can address. */
export const COMMAND_ORDINALS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type CommandOrdinal = (typeof COMMAND_ORDINALS)[number];

/**
 * What must exist for a command to be available.
 *
 * The dispatcher resolves this BEFORE running an adapter, so "no current Pane" is one bounded
 * unavailable result rather than nine adapters each discovering it in their own way.
 */
export type CommandScope =
  /** Always available. */
  | "global"
  /** Needs a current Space. */
  | "space"
  /** Needs a current Tab. */
  | "tab"
  /** Needs a current Pane. */
  | "pane"
  /** Needs a non-empty set of navigation targets. */
  | "navigation";

export type CommandId =
  | "open-command-bar"
  | "open-pane-switcher"
  | "open-fleet-settings"
  | "toggle-fleet-sidebars"
  | "create-tab"
  | "next-tab"
  | "previous-tab"
  | `select-tab-${CommandOrdinal}`
  | "rename-tab"
  | "close-tab"
  | "next-pane-in-tab"
  | "previous-pane-in-tab"
  | "close-pane"
  | "rename-pane"
  | "fit-pane-width"
  | "previous-pane"
  | "next-pane"
  | "last-pane"
  | "previous-agent"
  | "next-agent"
  | `select-agent-${CommandOrdinal}`
  | "copy-fleet-pane-link"
  | "toggle-type-mode"
  | "send-escape"
  | "send-enter"
  | "send-up-arrow"
  | "send-down-arrow"
  | "send-left-arrow"
  | "send-right-arrow"
  | "send-space"
  | "send-ctrl-c";

export interface CommandDefinition {
  readonly id: CommandId;
  /**
   * The English name, and the only name. It is what the command bar lists, what the acknowledgement
   * says, and what a search matches — one string rather than a display name and a search name that
   * can disagree.
   */
  readonly name: string;
  readonly scope: CommandScope;
  /** The bindings a stock install ships. An empty array means the command ships unbound. */
  readonly defaults: readonly string[];
}

/**
 * `Ctrl+Shift+P` is the ONLY direct-chord default.
 *
 * Everything else that ships bound is a prefix binding, because a direct chord is best-effort — a
 * browser or an extension may take it before page script sees it — while a prefix sequence's second
 * chord is a plain key nothing else is listening for. The command bar is the exception because a
 * discovery surface reachable only by a sequence is not discoverable: you would have to already know
 * the prefix to find out what the prefix does.
 *
 * Pane mode has no chord of its own. It is the same overlay with the leading `/` removed, so an
 * operator who wants a direct way in binds `open-pane-switcher` themselves.
 */
const DEFINITIONS: readonly CommandDefinition[] = [
  { id: "open-command-bar", name: "Open Command Bar", scope: "global", defaults: ["Ctrl+Shift+P", "Prefix+?"] },
  { id: "open-pane-switcher", name: "Open Pane Switcher", scope: "global", defaults: [] },
  { id: "open-fleet-settings", name: "Open Fleet Settings", scope: "global", defaults: ["Prefix+S"] },
  { id: "toggle-fleet-sidebars", name: "Toggle Fleet Sidebars", scope: "global", defaults: ["Prefix+B"] },

  // NO `rename-space` OR `close-space`, and that is a fact about the multiplexer rather than a gap
  // here: the bridge exposes creating a Space and nothing else for one. A command that cannot land is
  // worse than an absent command — it is a row in the palette that fails every time it is chosen — so
  // the catalog does not carry them. The hierarchy's own row actions already make the same choice.

  // Three aliases, one command. They are aliases rather than three commands because a split and a
  // new tab are different operations and only one of them exists here.
  { id: "create-tab", name: "Create Tab", scope: "space", defaults: ["Prefix+C", "Prefix+V", "Prefix+-"] },
  { id: "next-tab", name: "Next Tab", scope: "tab", defaults: ["Prefix+N"] },
  { id: "previous-tab", name: "Previous Tab", scope: "tab", defaults: ["Prefix+P"] },
  ...COMMAND_ORDINALS.map(
    (n): CommandDefinition => ({
      id: `select-tab-${n}`,
      name: `Select Tab ${n}`,
      scope: "tab",
      defaults: [`Prefix+${n}`],
    }),
  ),
  { id: "rename-tab", name: "Rename Tab", scope: "tab", defaults: ["Prefix+Shift+T"] },
  { id: "close-tab", name: "Close Tab", scope: "tab", defaults: ["Prefix+Shift+X"] },

  { id: "next-pane-in-tab", name: "Next Pane in Tab", scope: "tab", defaults: ["Prefix+Tab"] },
  { id: "previous-pane-in-tab", name: "Previous Pane in Tab", scope: "tab", defaults: ["Prefix+Shift+Tab"] },
  { id: "close-pane", name: "Close Pane", scope: "pane", defaults: ["Prefix+X"] },
  { id: "rename-pane", name: "Rename Pane", scope: "pane", defaults: ["Prefix+Shift+P"] },
  { id: "fit-pane-width", name: "Fit Current Pane Width", scope: "pane", defaults: ["Prefix+R"] },

  // The whole-hierarchy walk and the roster walk. Both shipped on `Alt` once; neither ships bound
  // now, because no `Alt` chord is a default any more and moving them behind the prefix would be
  // choosing a key for an operator who has not asked for one.
  { id: "previous-pane", name: "Previous Pane in Fleet", scope: "navigation", defaults: [] },
  { id: "next-pane", name: "Next Pane in Fleet", scope: "navigation", defaults: [] },
  { id: "last-pane", name: "Last Pane", scope: "navigation", defaults: [] },
  { id: "previous-agent", name: "Previous Agent", scope: "navigation", defaults: [] },
  { id: "next-agent", name: "Next Agent", scope: "navigation", defaults: [] },
  ...COMMAND_ORDINALS.map(
    (n): CommandDefinition => ({
      id: `select-agent-${n}`,
      name: `Select Agent ${n}`,
      scope: "navigation",
      defaults: [],
    }),
  ),

  { id: "copy-fleet-pane-link", name: "Copy Fleet Pane Link", scope: "pane", defaults: [] },
  { id: "toggle-type-mode", name: "Toggle Type Mode", scope: "pane", defaults: [] },

  // Fixed sends. Every one of them is a constant sequence chosen by its id; none of them accepts a
  // sequence from a caller. They ship unbound because a key that writes into a terminal is a key an
  // operator should choose deliberately.
  { id: "send-escape", name: "Send Escape", scope: "pane", defaults: [] },
  { id: "send-enter", name: "Send Enter", scope: "pane", defaults: [] },
  { id: "send-up-arrow", name: "Send Up Arrow", scope: "pane", defaults: [] },
  { id: "send-down-arrow", name: "Send Down Arrow", scope: "pane", defaults: [] },
  { id: "send-left-arrow", name: "Send Left Arrow", scope: "pane", defaults: [] },
  { id: "send-right-arrow", name: "Send Right Arrow", scope: "pane", defaults: [] },
  { id: "send-space", name: "Send Space", scope: "pane", defaults: [] },
  { id: "send-ctrl-c", name: "Send Ctrl+C", scope: "pane", defaults: [] },
];

export const COMMAND_CATALOG: readonly CommandDefinition[] = DEFINITIONS;

const BY_ID = new Map<string, CommandDefinition>(DEFINITIONS.map((command) => [command.id, command]));

/** The catalog's closure, as a predicate: an id from a document is only a command if this says so. */
export function isCommandId(value: string): value is CommandId {
  return BY_ID.has(value);
}

export function commandById(id: CommandId): CommandDefinition {
  const found = BY_ID.get(id);
  // Unreachable through the type, and worth saying rather than asserting: the only way here is
  // an id that came from outside TypeScript, which is exactly when a silent `undefined` would
  // travel furthest before anyone noticed.
  if (found === undefined) throw new Error(`unknown command id: ${id}`);
  return found;
}

/** The default prefix. An operator's document may replace it; nothing else may. */
export const DEFAULT_COMMAND_PREFIX = "Ctrl+B";

/**
 * The shipped bindings, parsed.
 *
 * Parsed rather than stored as text so a typo in the table above is a test failure here rather than
 * a command that silently ships unbound. The catalog's own test asserts every entry parses.
 */
export function defaultBindings(): ReadonlyMap<CommandId, readonly Binding[]> {
  const out = new Map<CommandId, readonly Binding[]>();
  for (const command of DEFINITIONS) {
    const parsed: Binding[] = [];
    for (const text of command.defaults) {
      const result = parseBinding(text);
      if (result.ok) parsed.push(result.binding);
    }
    out.set(command.id, parsed);
  }
  return out;
}
