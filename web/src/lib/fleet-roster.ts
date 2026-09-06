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
import { agentFavoriteStore } from "../../../fleet/ui/agent-favorites.ts";
import { hostName, isMultiHost } from "@/lib/hosts";
import type { TriageSection } from "@/lib/triage";
import { paneDisplayName, type AgentView, type ServerSummary } from "@/lib/types";

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
  favorite: boolean;
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
    label: paneDisplayName(pane),
    context: pane.workspaceLabel,
    favorite: agentFavoriteStore.isFavorite(pane),
  };
  // Denormalised bridge-side, and absent when the Tab's name says nothing (Herdr numbers an
  // unlabelled tab). Absent means it is not a fact to search on, not that it is the empty string.
  if (pane.tabLabel !== undefined) entry.tabLabel = pane.tabLabel;
  if (pane.host !== undefined) entry.host = pane.host;
  // ONE MACHINE, ONE NAME. The snapshot tags a Pane with an id — the lead's is `lead` — and the rails
  // resolve it through `hostName` before showing it. Resolving it here rather than at the row keeps
  // the two from ever disagreeing, which is the bug this replaced: the switcher said `lead` where
  // the sidebar said `vultr`. Only on a pack: naming the only machine on every row says nothing, and
  // `isMultiHost` is the same predicate the rails use to decide a host is worth distinguishing.
  if (isMultiHost(servers)) {
    const named = hostName(servers, pane.host);
    if (named !== undefined && named !== "") entry.hostLabel = named;
  }
  if (pane.session !== undefined) entry.session = pane.session;
  if (pane.kind !== "shell") entry.agent = pane.agent;
  if (pane.lastSeenAt !== undefined) entry.lastSeenAt = pane.lastSeenAt;
  return entry;
}

/**
 * The roster, from Collie's own triage output plus the Panes that are not Agents.
 *
 * `triaged` arrives already bucketed because bucketing is Collie's rule; this adds the fork's part —
 * the shell section, the favourites partition, the empty-section removal and the flattening.
 */
export function paneRosterFrom(
  triaged: readonly TriageSection[],
  shellPanes: readonly AgentView[] = [],
  servers?: readonly ServerSummary[],
): PaneRoster {
  return derivePaneRoster({
    triaged: triaged.map((section) => ({
      key: section.key,
      entries: section.agents.map((pane) => toRosterEntry(pane, servers)),
    })),
    shellPanes: shellPanes.map((pane) => toRosterEntry(pane, servers)),
  });
}
