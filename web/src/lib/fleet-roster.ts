// One mapping from Collie's rows to the roster, so the rail and the command layer cannot come to
// hold two ideas of the same order.
//
// The ordering RULE lives in `fleet/ui/pane-roster.ts` and is fs-free and React-free. This file is
// the thin adapter between it and Collie's `AgentView`: it says which of that type's many fields the
// order and the identity actually depend on, and nothing else.

import {
  derivePaneRoster,
  type PaneRoster,
  type RosterEntry,
} from "../../../fleet/ui/pane-roster.ts";
import {
  forgetLegacyFavorites,
  matchesLegacyFavorite,
  readLegacyFavorites,
} from "../../../fleet/ui/agent-favorites.ts";
import { pinnedRows } from "@/lib/dash-view";
import { hostName, isMultiHost } from "@/lib/hosts";
import { groupPanesByWorkspace } from "@/lib/pane-groups";
import { currentPins, pinMatcher, setPinned, type Pin } from "@/lib/pins";
import type { TriageSection } from "@/lib/triage";
import { paneName } from "@/lib/pane-name";
import type { AgentView, ServerSummary, TabView } from "@/lib/types";

/** The same fields as {@link RosterEntry}, writable while one is assembled. */
interface RosterEntryDraft {
  paneId: string;
  host?: string;
  session?: string;
  kind: "agent" | "shell";
  agent?: string;
  label: string;
  context?: string;
  tabLabel?: string;
  hostLabel?: string;
  lastSeenAt?: number;
  lastActiveAt?: number;
}

/**
 * One Collie row as the roster names it.
 *
 * Built with statements rather than conditional spreads: an absent host and a host of `""` are
 * different facts on a pack, and a spread that collapses to `{}` hides which one a row is.
 */
export function toRosterEntry(pane: AgentView, servers?: readonly ServerSummary[]): RosterEntry {
  const entry: RosterEntryDraft = {
    paneId: pane.paneId,
    kind: pane.kind === "shell" ? "shell" : "agent",
    // The same name the rail and the hierarchy show, so a row is called one thing everywhere.
    label: paneName(pane),
    context: pane.workspaceLabel,
  };
  // Denormalised bridge-side, and absent when the Tab's name says nothing (Herdr numbers an
  // unlabelled tab). Absent means it is not a fact to search on, not that it is the empty string.
  if (pane.tabLabel !== undefined) entry.tabLabel = pane.tabLabel;
  if (pane.host !== undefined) entry.host = pane.host;
  // ONE MACHINE, ONE NAME — for SEARCH. The snapshot tags a Pane with an id (the lead's is `lead`),
  // and every surface resolves it through `hostName` before a person sees it. The host TAG does that
  // resolution itself; what it cannot do is be typed into a query, so the same name is resolved here
  // for the searchable fields. Gated on `isMultiHost`, which is the predicate the tag's own hide rule
  // uses, so searching and showing agree about when the host dimension exists.
  if (isMultiHost(servers)) {
    const named = hostName(servers, pane.host);
    if (named !== undefined && named !== "") entry.hostLabel = named;
  }
  if (pane.session !== undefined) entry.session = pane.session;
  if (pane.kind !== "shell") entry.agent = pane.agent;
  if (pane.lastSeenAt !== undefined) entry.lastSeenAt = pane.lastSeenAt;
  if (pane.lastActiveAt !== undefined) entry.lastActiveAt = pane.lastActiveAt;
  return entry;
}

/**
 * The roster, from Collie's own triage output, this device's pinned Agents and the Panes that are
 * not Agents.
 *
 * `triaged` arrives already bucketed because bucketing is Collie's rule, and `pinned` already in
 * Collie's pinned order (see {@link pinnedAgents}); this adds the fork's part — the Pinned section
 * first, each pinned pane listed once, within-group time ordering, the shell section, empty-section
 * removal and the flattening.
 */
export function paneRosterFrom(
  triaged: readonly TriageSection[],
  shellPanes: readonly AgentView[] = [],
  servers?: readonly ServerSummary[],
  pinned: readonly AgentView[] = [],
): PaneRoster {
  return derivePaneRoster({
    triaged: triaged.map((section) => ({
      key: section.key,
      entries: section.agents.map((pane) => toRosterEntry(pane, servers)),
    })),
    pinned: pinned.map((pane) => toRosterEntry(pane, servers)),
    shellPanes: shellPanes.map((pane) => toRosterEntry(pane, servers)),
  });
}

const NO_PANES: readonly AgentView[] = [];

/**
 * The Agent panes this device pinned, in the order Collie's own Pinned group lists them: the
 * dashboard's place order (`pinnedRows` over the fixed workspace grouping), which never reads a
 * status, so no state change moves a pinned row. Shells are not Agent rows and are left out.
 */
export function pinnedAgents(
  agents: readonly AgentView[],
  pins: readonly Pin[],
  tabs?: readonly TabView[],
  servers?: readonly ServerSummary[],
): readonly AgentView[] {
  if (pins.length === 0 || agents.length === 0) return NO_PANES;
  return pinnedRows(groupPanesByWorkspace(agents, [], { order: "fixed", tabs, servers }), pinMatcher(pins));
}

/**
 * THE STAR. Pin or unpin one pane through Collie's own pin store — the same write its hold and its
 * actions sheet make, so the two doors cannot disagree. `herd` is every pane the caller lists; the
 * store's prune reads it (lib/pins.ts).
 *
 * A pin moves the row between groups and React remounts it, so focus would fall to the document.
 * Given the row button's DOM id, the star in the row's new place takes focus after the commit.
 * Only a surface whose row ids are unique may pass one; the Agent rail refocuses inside its own
 * container instead (components/native-agent-rail.tsx).
 */
export function togglePanePin(pane: AgentView, herd: readonly AgentView[], rowId?: string): void {
  setPinned(pane, !pinMatcher(currentPins())(pane), herd);
  if (rowId === undefined) return;
  requestAnimationFrame(() => {
    document
      .getElementById(rowId)
      ?.parentElement?.querySelector<HTMLElement>(":scope > button[aria-pressed]")
      ?.focus();
  });
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * The one-shot migration of the retired Fleet favourites into Collie's pins
 * (fleet/ui/agent-favorites.ts). Called with a FRESH snapshot's Agents only — the caller refuses an
 * error render or an empty list — because a favourite whose pane is not listed is dropped for good.
 * Every live match is pinned (never unpinned), then the retired record is deleted. Returns how many
 * panes it pinned, for the test.
 */
export function migrateLegacyFavorites(
  agents: readonly AgentView[],
  storage: Storage | null = browserStorage(),
): number {
  const stored = readLegacyFavorites(storage);
  if (stored === null) return 0;
  const isPinned = pinMatcher(currentPins());
  let pinned = 0;
  for (const pane of agents) {
    if (isPinned(pane) || !stored.some((favorite) => matchesLegacyFavorite(favorite, pane))) continue;
    setPinned(pane, true, agents);
    pinned += 1;
  }
  forgetLegacyFavorites(storage);
  return pinned;
}
