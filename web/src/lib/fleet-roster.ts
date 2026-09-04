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
import type { TriageSection } from "@/lib/triage";
import { paneDisplayName, type AgentView } from "@/lib/types";

/** The same fields as {@link RosterEntry}, writable while one is assembled. */
interface RosterEntryDraft {
  paneId: string;
  host?: string;
  session?: string;
  kind: "agent" | "shell";
  agent?: string;
  label: string;
  context?: string;
  lastSeenAt?: number;
  favorite: boolean;
}

/**
 * One Collie row as the roster names it.
 *
 * Built with statements rather than conditional spreads: an absent host and a host of `""` are
 * different facts on a pack, and a spread that collapses to `{}` hides which one a row is.
 */
export function toRosterEntry(pane: AgentView): RosterEntry {
  const entry: RosterEntryDraft = {
    paneId: pane.paneId,
    kind: pane.kind === "shell" ? "shell" : "agent",
    // The same name the rail and the hierarchy show, so a row is called one thing everywhere.
    label: paneDisplayName(pane),
    context: pane.workspaceLabel,
    favorite: agentFavoriteStore.isFavorite(pane),
  };
  if (pane.host !== undefined) entry.host = pane.host;
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
): PaneRoster {
  return derivePaneRoster({
    triaged: triaged.map((section) => ({
      key: section.key,
      entries: section.agents.map(toRosterEntry),
    })),
    shellPanes: shellPanes.map(toRosterEntry),
  });
}
