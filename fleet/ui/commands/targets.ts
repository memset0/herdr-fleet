import type { NavigationRow, NavigationTree } from "../native-navigation/model.ts";

// Where a navigation command lands.
//
// Every one of these is a pure function from the topology the app already holds to one Pane target,
// so the scoping rules — "Tabs in the current Space", "Panes in the current Tab", "every Pane in the
// hierarchy" — are stated once and testable without a router. The component that calls them owns
// the navigation itself; nothing here knows what a URL is.
//
// The three scopes are genuinely different and must not be collapsed into one "next thing":
// cycling Tabs inside a Space must never cross into another Space, cycling Panes inside a Tab must
// never cross into a sibling Tab, and the hierarchy walk crosses everything on purpose.

/** Enough to name a Pane: an id is unique only within one machine. */
export interface PaneRef {
  readonly paneId: string;
  readonly host?: string;
}

/** Enough to place a Pane in the topology as well as name it. */
export interface PaneTarget extends PaneRef {
  readonly session?: string;
  readonly workspaceId: string;
  readonly tabId: string;
}

/** The minimum a Tab has to say. */
export interface TabTarget {
  readonly tabId: string;
  readonly workspaceId: string;
  readonly host?: string;
}

/** Wrap-around stepping over any list. Returns null only when there is nothing to step through. */
export function stepBy<T>(items: readonly T[], at: number, direction: 1 | -1): T | null {
  if (items.length === 0) return null;
  // A current position the list does not contain enters from the end the direction implies, rather
  // than refusing: the operator may be somewhere this list does not describe, and "go to the next
  // one" still has an obvious answer.
  if (at < 0) return (direction === 1 ? items[0] : items[items.length - 1]) ?? null;
  return items[(at + direction + items.length) % items.length] ?? null;
}

function sameHost(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "") === (b ?? "");
}

/** The Tabs of one Space on one machine, in the order they arrived. */
export function tabsInSpace(
  tabs: readonly TabTarget[],
  workspaceId: string,
  host: string | undefined,
): readonly TabTarget[] {
  return tabs.filter((tab) => tab.workspaceId === workspaceId && sameHost(tab.host, host));
}

/** The Panes of one Tab on one machine, in the order they arrived. */
export function panesInTab(
  panes: readonly PaneTarget[],
  tabId: string,
  host: string | undefined,
): readonly PaneTarget[] {
  return panes.filter((pane) => pane.tabId === tabId && sameHost(pane.host, host));
}

/**
 * The first Pane of a Tab — what selecting a Tab actually opens, because there is no Tab route.
 *
 * `preferred` is the Pane already displayed when that Tab is the current one, so re-selecting the
 * Tab you are on does not jump you to its first Pane.
 */
export function paneForTab(
  panes: readonly PaneTarget[],
  tab: TabTarget,
  preferredPaneId?: string,
): PaneTarget | null {
  const own = panesInTab(panes, tab.tabId, tab.host);
  const preferred = own.find((pane) => pane.paneId === preferredPaneId);
  return preferred ?? own[0] ?? null;
}

/** Step to the previous or next Tab of the current Space, wrapping inside it. */
export function stepTabInSpace(
  tabs: readonly TabTarget[],
  current: { workspaceId: string; tabId: string; host?: string },
  direction: 1 | -1,
): TabTarget | null {
  const own = tabsInSpace(tabs, current.workspaceId, current.host);
  return stepBy(
    own,
    own.findIndex((tab) => tab.tabId === current.tabId),
    direction,
  );
}

/** The nth Tab of the current Space, one-based, or null when the Space has fewer. */
export function tabOrdinalInSpace(
  tabs: readonly TabTarget[],
  current: { workspaceId: string; host?: string },
  ordinal: number,
): TabTarget | null {
  if (!Number.isInteger(ordinal) || ordinal < 1) return null;
  return tabsInSpace(tabs, current.workspaceId, current.host)[ordinal - 1] ?? null;
}

/** Step to the previous or next Pane of the current Tab, wrapping inside it. */
export function stepPaneInTab(
  panes: readonly PaneTarget[],
  current: { tabId: string; paneId: string; host?: string },
  direction: 1 | -1,
): PaneTarget | null {
  const own = panesInTab(panes, current.tabId, current.host);
  return stepBy(
    own,
    own.findIndex((pane) => pane.paneId === current.paneId),
    direction,
  );
}

/**
 * Step through EVERY Pane, in the order the hierarchy draws them.
 *
 * The caller flattens the tree it already rendered rather than this module re-deriving an order:
 * the hierarchy's order is the product of elision, host grouping and disclosure, all of which the
 * navigation model owns. Re-deriving it here would be a second answer to "what comes after this
 * row", and the two would part company the first time the tree changed its mind.
 */
export function stepPaneEverywhere<T extends PaneRef>(
  ordered: readonly T[],
  current: PaneRef | null,
  direction: 1 | -1,
): T | null {
  const at =
    current === null
      ? -1
      : ordered.findIndex(
          (pane) => pane.paneId === current.paneId && sameHost(pane.host, current.host),
        );
  return stepBy(ordered, at, direction);
}

/**
 * The two-entry, page-session history behind `last-pane`.
 *
 * Two and not more, deliberately: this is the "flip back to what I was just on" key, and a deeper
 * stack turns one predictable toggle into a walk whose position the operator has to remember.
 * Visiting the same Pane twice does not push a duplicate, so a poll-driven re-visit cannot make the
 * key a no-op.
 */
export interface PaneHistory {
  readonly current: string | null;
  readonly previous: string | null;
}

export const EMPTY_PANE_HISTORY: PaneHistory = { current: null, previous: null };

export function visitPane(history: PaneHistory, key: string | null): PaneHistory {
  if (key === null || key === history.current) return history;
  return { current: key, previous: history.current };
}

/** Swap the pair, so pressing the key twice returns you to where you started. */
export function swapPaneHistory(history: PaneHistory): PaneHistory {
  if (history.previous === null) return history;
  return { current: history.previous, previous: history.current };
}

/** Drop a remembered Pane the topology no longer contains. */
export function prunePaneHistory(history: PaneHistory, exists: (key: string) => boolean): PaneHistory {
  const previous = history.previous !== null && exists(history.previous) ? history.previous : null;
  return previous === history.previous ? history : { current: history.current, previous };
}

/**
 * The hierarchy's Panes, in the order it draws them.
 *
 * Read off the tree the shell already rendered rather than re-derived from the snapshot, because
 * that order is the product of host grouping, Space order and the model's own elision. A second
 * derivation would agree today and drift the first time the tree changed its mind about any of the
 * three — and the operator would find that out by pressing a key and landing somewhere else.
 *
 * Disclosure is deliberately NOT consulted: a collapsed Space still holds its Panes, and a walk that
 * skipped them would make the same key do different things depending on what happened to be folded.
 */
export function hierarchyPaneOrder(tree: NavigationTree): readonly PaneRef[] {
  const out: PaneRef[] = [];
  const walk = (rows: readonly NavigationRow[]) => {
    for (const row of rows) {
      if (row.target?.kind === "pane") {
        out.push(row.target.host === undefined ? { paneId: row.target.paneId } : { paneId: row.target.paneId, host: row.target.host });
      }
      walk(row.children);
    }
  };
  walk(tree.rows);
  return out;
}
