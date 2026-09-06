// The one definition of what the right rail can list.
//
// Four surfaces need this list and they must not disagree about its ORDER: the rail draws it, the
// command bar snapshots it, `next-agent`/`previous-agent` step through it, and `select-agent-N`
// indexes into it. When the order lived inside the rail component, the other three had to
// re-derive it, and re-derivation is how "the fifth row" comes to mean two different Panes.
//
// **This module does not bucket.** It takes the sections Collie's own triage already produced and
// adds what the fork owns on top: the shell section, favourites-first inside every section, the
// removal of empty sections, and the flattening. Two reasons, and both are load-bearing. `fleet/ui`
// imports downward only — never from `web/src` — which is what lets the root suite run it with no
// browser; and bucketing is Collie's rule, so a copy of it here would be a second answer to "which
// section is this Pane in" that drifts the first time upstream changes its mind.
//
// The shell section is LAST and is the command bar's alone. The Agent surface's own specification
// says shell rows never appear in it, so the rail consumes `sections` minus that one — see
// {@link agentSections}.

/** The four sections Collie's triage produces, plus the one the fork appends. */
export type RosterSectionKey = "needs" | "ready" | "working" | "recent" | "shell";

export const TRIAGE_SECTION_KEYS = ["needs", "ready", "working", "recent"] as const;
export type TriageSectionKey = (typeof TRIAGE_SECTION_KEYS)[number];

/**
 * One listable row.
 *
 * Structural rather than imported from Collie's `AgentView`: this module is about ORDER, and the
 * fields below are exactly the ones ordering and identity need. A caller maps its own rows into
 * these and back out by `paneId`, the same shape the navigation model already uses.
 */
export interface RosterEntry {
  readonly paneId: string;
  /**
   * The pack member this row came from, as the snapshot IDENTIFIES it. Absent, or `""`, on a solo
   * install. This is the id and not a name — the lead's is `lead` — so it addresses and identifies,
   * and never appears on screen.
   */
  readonly host?: string;
  /**
   * The same machine as a PERSON names it, resolved by the caller through the application's own
   * host naming so that one machine has one name everywhere. Absent where there is only one machine,
   * because naming it on every row says nothing.
   */
  readonly hostLabel?: string;
  readonly session?: string;
  readonly kind: "agent" | "shell";
  /** The Agent implementation behind an agent row. Absent on a shell row. */
  readonly agent?: string;
  /** What the row is called — the operator's own name where they gave one. */
  readonly label: string;
  /** Where the work is, shown beside the label. The Space's own name. */
  readonly context?: string;
  /** The Tab this Pane sits in, where the Tab says anything. Searchable, and shown when matched. */
  readonly tabLabel?: string;
  /** When this Pane was last seen, used to order the shell section. */
  readonly lastSeenAt?: number;
  readonly favorite: boolean;
}

/**
 * What a Pane search matches, in a fixed order.
 *
 * FOUR FACTS NAME A PANE and an operator remembers whichever one they were last looking at — the
 * machine it is on, the Space, the Tab, or what the Pane itself is called. Matching only the last of
 * those made the switcher useless for the two questions it is most often opened with ("the one on
 * the other box", "the one in the deploy tab"), so all four are hit conditions.
 *
 * THE ORDER IS PART OF THE CONTRACT. `fuzzyMatchAny` answers which field it scored, and the row uses
 * that index to show the operator WHY it is in the list — so a caller reads the index through
 * {@link rosterSearchField} rather than counting positions in this array.
 */
export const ROSTER_SEARCH_FIELD_ORDER = ["label", "context", "tabLabel", "host"] as const;

export type RosterSearchField = (typeof ROSTER_SEARCH_FIELD_ORDER)[number];

/**
 * The four strings, in {@link ROSTER_SEARCH_FIELD_ORDER}. An absent fact searches as empty.
 *
 * The host is searched by the NAME that is displayed, never by the id behind it: an operator types
 * what they can see, and the id is on screen nowhere.
 */
export function rosterSearchFields(entry: RosterEntry): readonly string[] {
  return [entry.label, entry.context ?? "", entry.tabLabel ?? "", entry.hostLabel ?? ""];
}

/** Which field an index from `fuzzyMatchAny` names, or `null` for an index from somewhere else. */
export function rosterSearchField(index: number): RosterSearchField | null {
  return ROSTER_SEARCH_FIELD_ORDER[index] ?? null;
}

export interface RosterSection {
  readonly key: RosterSectionKey;
  readonly entries: readonly RosterEntry[];
}

export interface PaneRoster {
  /** Non-empty sections, in fixed order. What the rail draws. */
  readonly sections: readonly RosterSection[];
  /** The same rows, flattened. The snapshot order, the cycle order, and the ordinal order. */
  readonly entries: readonly RosterEntry[];
}

export interface PaneRosterInput {
  /**
   * Collie's triage output, already bucketed and already in its own within-section order, in the
   * order triage returns them. Empty sections may be included; they are dropped here.
   */
  readonly triaged: readonly { readonly key: TriageSectionKey; readonly entries: readonly RosterEntry[] }[];
  /** The Panes that are not Agents. Ordered here, not by the caller. */
  readonly shellPanes: readonly RosterEntry[];
}

/**
 * Favourites first, and nothing else moved.
 *
 * A stable partition rather than a sort: both halves keep the order the caller gave them, which for
 * the triage sections is Collie's own comparator and for the shell section is the last-seen order
 * applied just above. A comparator that ranked "favourite" as a key would have re-sorted the rest.
 */
function favoritesFirst(entries: readonly RosterEntry[]): RosterEntry[] {
  const favorites: RosterEntry[] = [];
  const rest: RosterEntry[] = [];
  for (const entry of entries) (entry.favorite ? favorites : rest).push(entry);
  return [...favorites, ...rest];
}

/**
 * Most recently seen first — the shell section's own within-section order.
 *
 * It follows `Recent` rather than the three sections above it, and that is a decision rather than an
 * accident: those three order by last ACTIVITY, which is a statement about an agent's status, and a
 * shell Pane has no agent status for that to be about. Last seen is the fact a shell Pane does have.
 */
function byLastSeenDescending(entries: readonly RosterEntry[]): readonly RosterEntry[] {
  return entries.toSorted((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
}

export function derivePaneRoster(input: PaneRosterInput): PaneRoster {
  const sections: RosterSection[] = [];

  for (const section of input.triaged) {
    if (section.entries.length === 0) continue;
    sections.push({ key: section.key, entries: favoritesFirst(section.entries) });
  }

  if (input.shellPanes.length > 0) {
    sections.push({ key: "shell", entries: favoritesFirst(byLastSeenDescending(input.shellPanes)) });
  }

  const entries: RosterEntry[] = [];
  for (const section of sections) entries.push(...section.entries);
  return { sections, entries };
}

/**
 * What the Agent surface draws: the roster without its shell section.
 *
 * A function rather than a second derivation, so the rail and the command bar cannot come to hold
 * two different ideas of the sections they share.
 */
export function agentSections(roster: PaneRoster): readonly RosterSection[] {
  return roster.sections.filter((section) => section.key !== "shell");
}

/** The joiner, spelled as an escape so it survives every editor and every copy. */
const KEY_SEP = "\u0000";

/** Identity for the two-entry history and for finding a snapshot row again after a refresh. */
export function rosterEntryKey(entry: {
  host?: string;
  session?: string;
  paneId: string;
}): string {
  // NUL-joined for the same reason the host module joins its keys: every part is an opaque string
  // that could itself contain a printable separator.
  return [entry.host ?? "", entry.session ?? "", entry.paneId].join(KEY_SEP);
}

/** Step to the next or previous entry, wrapping. Returns null when there is nowhere to go. */
export function stepRoster(
  entries: readonly RosterEntry[],
  currentKey: string | null,
  direction: 1 | -1,
): RosterEntry | null {
  if (entries.length === 0) return null;
  const at = currentKey === null ? -1 : entries.findIndex((entry) => rosterEntryKey(entry) === currentKey);
  // Not being in the list is not an error — the operator may be on a Pane the roster does not list
  // — so the walk starts at whichever end the direction implies.
  if (at === -1) return (direction === 1 ? entries[0] : entries[entries.length - 1]) ?? null;
  const next = (at + direction + entries.length) % entries.length;
  return entries[next] ?? null;
}

/** The nth entry, 1-based, or null when the roster is shorter than that. */
export function rosterOrdinal(entries: readonly RosterEntry[], ordinal: number): RosterEntry | null {
  if (!Number.isInteger(ordinal) || ordinal < 1) return null;
  return entries[ordinal - 1] ?? null;
}
