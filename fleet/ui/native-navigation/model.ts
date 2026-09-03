export const MAX_NAVIGATION_SPACES = 256;
export const MAX_NAVIGATION_TABS = 512;
export const MAX_NAVIGATION_PANES = 2048;
export const MAX_NAVIGATION_ID_LENGTH = 256;

export interface NavigationWorkspaceInput {
  workspaceId: string;
  label: string;
}

export interface NavigationTabInput {
  tabId: string;
  workspaceId: string;
  label: string;
}

export interface NavigationPaneInput {
  paneId: string;
  workspaceId: string;
  tabId: string;
  label: string;
  agent: string;
  kind?: "agent" | "shell";
}

/**
 * What a row draws in front of its label.
 *
 * `group` is the ONLY folder in the tree, and it is earned rather than assigned by depth: a row
 * gets it when it still groups more than one child after {@link deriveNavigationTree}'s elision.
 * A Space row that merely happens to have children is not a folder — it is a place, and a place
 * named by its own label needs no picture of a place.
 */
export type NavigationIcon = "group" | "agent" | "shell" | "none";

/** What activating a row does. A row without one only discloses. */
export type NavigationTarget =
  | { kind: "space"; workspaceId: string }
  | { kind: "pane"; paneId: string };

export interface NavigationRow {
  /** Unique within the tree; the React key and nothing else. */
  key: string;
  label: string;
  icon: NavigationIcon;
  /** The Agent implementation behind an `agent` icon. */
  agent?: string;
  /**
   * Browser-local disclosure identity. Present exactly when the row has children, so a leaf can
   * never occupy a disclosure slot and an elided level can never leave one behind.
   */
  disclosureId?: string;
  target?: NavigationTarget;
  selected: boolean;
  children: NavigationRow[];
}

export interface NavigationSelection {
  paneId: string;
  /** The disclosure identities from the top row down to the selected Pane's parent. */
  ancestors: readonly string[];
}

/**
 * One machine's rows, under a heading naming it.
 *
 * The Host is a HEADING and not a disclosable row while there is one of them: a control that
 * collapses the only machine in the tree hides everything and reveals nothing, and giving it a
 * default-open state would need a second kind of preference (a row that is open until closed)
 * for exactly one row. The level is reserved by existing; a later Host-aware change gives it a
 * disclosure control when there is more than one to choose between.
 */
export interface NavigationHost {
  key: string;
  label: string;
  rows: NavigationRow[];
}

export interface NavigationTree {
  hosts: NavigationHost[];
  selection: NavigationSelection | null;
}

function validId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_NAVIGATION_ID_LENGTH;
}

export function spaceDisclosureId(workspaceId: string): string {
  return JSON.stringify(["space", workspaceId]);
}

export function tabDisclosureId(workspaceId: string, tabId: string): string {
  return JSON.stringify(["tab", workspaceId, tabId]);
}

function paneRow(pane: NavigationPaneInput, selected: boolean): NavigationRow {
  const row: NavigationRow = {
    key: `pane:${pane.workspaceId}:${pane.tabId}:${pane.paneId}`,
    label: pane.label,
    icon: pane.kind === "shell" ? "shell" : "agent",
    target: { kind: "pane", paneId: pane.paneId },
    selected,
    children: [],
  };
  if (pane.kind !== "shell") row.agent = pane.agent;
  return row;
}

/**
 * Derive the Host → Space → Tab → Pane rows the hierarchy draws, already elided.
 *
 * THE ELISION RULE IS ABOUT TABS, and only about tabs. A Herdr Tab is a container the operator
 * rarely names and never navigates to on its own — there is no Tab route — so a Tab that groups one
 * Pane, or a Space that holds one Tab, is a level the tree spends a row and an indentation step on
 * to say nothing. Both cases collapse: the single Pane takes the Tab's place under its OWN name and
 * icon (the deeper name wins, because the Pane is the thing the operator is looking for), and a
 * lone Tab disappears so its Panes hang directly off their Space.
 *
 * Hosts and Spaces are NOT elided even when they hold one child. Both are places the operator
 * navigates to or reasons about — a Space has its own route — so removing one would hide a name
 * rather than a redundancy.
 *
 * A Tab with no Pane is dropped. It has no route of its own, so a row for it can neither be opened
 * nor disclosed; it would be a dead line in a tree whose whole purpose is reaching Panes. An empty
 * SPACE is kept, because its row still opens the Space route.
 *
 * `hostLabel` arrives resolved. Naming a host is Collie's job (its roster names members and its
 * helper falls back to the id), and this module stays free of the web tree so it can be tested as
 * pure data.
 */
export function deriveNavigationTree(input: {
  hostId: string;
  hostLabel: string;
  workspaces: readonly NavigationWorkspaceInput[];
  tabs: readonly NavigationTabInput[];
  agents: readonly NavigationPaneInput[];
  shellPanes: readonly NavigationPaneInput[];
  selectedPaneId?: string;
}): NavigationTree {
  const panes = [...input.agents, ...input.shellPanes]
    .filter(
      (pane) =>
        validId(pane.paneId) &&
        validId(pane.workspaceId) &&
        validId(pane.tabId) &&
        pane.label.length <= MAX_NAVIGATION_ID_LENGTH,
    )
    .slice(0, MAX_NAVIGATION_PANES);
  const tabs = input.tabs
    .filter(
      (tab) =>
        validId(tab.tabId) &&
        validId(tab.workspaceId) &&
        tab.label.length <= MAX_NAVIGATION_ID_LENGTH,
    )
    .slice(0, MAX_NAVIGATION_TABS);

  let selection: NavigationSelection | null = null;
  const remember = (paneId: string, ancestors: readonly string[]): void => {
    selection = { paneId, ancestors };
  };

  const spaces = input.workspaces
    .filter(
      (workspace) =>
        validId(workspace.workspaceId) && workspace.label.length <= MAX_NAVIGATION_ID_LENGTH,
    )
    .slice(0, MAX_NAVIGATION_SPACES)
    .map((workspace): NavigationRow => {
      const spaceId = spaceDisclosureId(workspace.workspaceId);
      const spaceTabs = tabs
        .filter((tab) => tab.workspaceId === workspace.workspaceId)
        .map((tab) => ({
          tab,
          panes: panes.filter(
            (pane) => pane.workspaceId === workspace.workspaceId && pane.tabId === tab.tabId,
          ),
        }))
        .filter((entry) => entry.panes.length > 0);

      // A lone Tab is not a level; its Panes belong to the Space itself.
      const elideTabLevel = spaceTabs.length === 1;

      const children = spaceTabs.flatMap((entry): NavigationRow[] => {
        const tabId = tabDisclosureId(workspace.workspaceId, entry.tab.tabId);
        const ancestorsOfPane = elideTabLevel ? [spaceId] : [spaceId, tabId];

        // A Tab with one Pane is not a level either: the Pane takes its row, name and icon.
        if (entry.panes.length === 1) {
          const only = entry.panes[0];
          if (!only) return [];
          const selected = only.paneId === input.selectedPaneId;
          if (selected) remember(only.paneId, [spaceId]);
          return [paneRow(only, selected)];
        }

        const paneRows = entry.panes.map((pane) => {
          const selected = pane.paneId === input.selectedPaneId;
          if (selected) remember(pane.paneId, ancestorsOfPane);
          return paneRow(pane, selected);
        });

        if (elideTabLevel) return paneRows;

        return [
          {
            key: `tab:${workspace.workspaceId}:${entry.tab.tabId}`,
            label: entry.tab.label,
            icon: "group",
            disclosureId: tabId,
            selected: false,
            children: paneRows,
          },
        ];
      });

      const row: NavigationRow = {
        key: `space:${workspace.workspaceId}`,
        label: workspace.label,
        icon: "none",
        target: { kind: "space", workspaceId: workspace.workspaceId },
        selected: false,
        children,
      };
      if (children.length > 0) row.disclosureId = spaceId;
      return row;
    });

  return {
    hosts: [{ key: `host:${input.hostId}`, label: input.hostLabel, rows: spaces }],
    selection,
  };
}
