import { X } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocation, useNavigate, useParams, useRevalidator } from "react-router";

import {
  deriveNavigationTree,
  type NavigationHostFault,
  type NavigationPaneInput,
  type NavigationSubject,
} from "../../../fleet/ui/native-navigation/model.ts";
import {
  nativeNavigationPreferences,
  SIDEBAR_BOUNDS,
  widthFromPointerDrag,
  widthFromSeparatorKey,
  type NativeNavigationPreferenceStore,
  type SidebarSide,
} from "../../../fleet/ui/native-navigation/preferences.ts";
import { agentFavoriteStore } from "../../../fleet/ui/agent-favorites.ts";
import { COMMAND_ORDINALS, type CommandId, type CommandScope } from "../../../fleet/ui/commands/catalog.ts";
import {
  EMPTY_PANE_HISTORY,
  hierarchyPaneOrder,
  paneForTab,
  prunePaneHistory,
  stepPaneEverywhere,
  stepPaneInTab,
  stepTabInSpace,
  swapPaneHistory,
  tabOrdinalInSpace,
  visitPane,
  type PaneHistory,
} from "../../../fleet/ui/commands/targets.ts";
import {
  rosterEntryKey,
  rosterOrdinal,
  stepRoster,
} from "../../../fleet/ui/pane-roster.ts";
import {
  FleetCommandsProvider,
  type CommandAdapters,
} from "@/components/fleet-commands";
import { usePointerMenuGestures } from "@/components/fleet-context-menu";
import { FleetWebfonts } from "@/components/fleet-webfonts";
import { NativeAgentRail } from "@/components/native-agent-rail";
import { NativeNavigationProvider } from "@/components/native-navigation-context";
import { NativeNavigationTree } from "@/components/native-navigation-tree";
import { FleetConfirmDialog } from "@/components/fleet-confirm-dialog";
import { FleetRenameDialog, type RenameTarget } from "@/components/fleet-rename-dialog";
import { FleetPaneActions, FleetSpaceActions, FleetTabActions } from "@/components/fleet-row-actions";
import { hostName, paneScope } from "@/lib/hosts";
import { t } from "@/lib/i18n";
import type { HomeData } from "@/lib/loaders";
import { closePane, closeTab } from "@/lib/api";
import { describeApiError, describeThrownError } from "@/lib/api-error-message";
import { paneRosterFrom } from "@/lib/fleet-roster";
import { setStatus } from "@/lib/status";
import { useFleetSettings } from "@/lib/fleet-settings";
import { homePath, panePath, settingsPath, spacePath } from "@/lib/nav";
import { triage } from "@/lib/triage";
import { usePairing } from "@/lib/pairing";
import { useSpaceActions } from "@/hooks/use-spaces";
import { isReadOnly, paneDisplayName, type AgentView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";

interface NativeNavigationShellProps {
  data: HomeData;
  children: ReactNode;
  preferenceStore?: NativeNavigationPreferenceStore;
}

/**
 * The persistent shell: two rails and, between them, the column that holds the one application
 * header and the route outlet.
 *
 * IT WRAPS THE HEADER, which is the whole reason the header stops running edge to edge over the
 * rails. Nesting is the only mechanism that gets that right without a measurement: the rails are
 * siblings of the column the header heads, so the header's width is the column's by construction
 * and stays correct when the prerelease strip appears or the safe-area inset changes.
 *
 * On a wide viewport both rails are always shown. There is no collapse control, because a rail the
 * operator keeps open is not worth a control that hides it — the widths are the adjustment, and
 * they persist. Below that breakpoint the rails are gone entirely and the hierarchy arrives as one
 * overlay from the header's leading trigger, while the Agent list is presented by the Pane page's
 * own switcher entry (components/native-navigation-context.tsx states that seam).
 */
/**
 * How old the lead's last receipt from a member may be before its refusal is believed as a label.
 * Above the lead's own idle sweep and below two of them, so one missed exchange is invisible and a
 * machine that has actually gone stays named within a sweep of going.
 */
const MISSED_SWEEP_MS = 20_000;

export function NativeNavigationShell({
  data,
  children,
  preferenceStore = nativeNavigationPreferences,
}: NativeNavigationShellProps) {
  useLocale();
  // One recorder for the app's lifetime: every right-click in the document is noted here so the row
  // actions a pointer opens can stand at the cursor. Mounted in the shell because the shell is what
  // outlives every navigation, and claimed only by a surface that opens right after the gesture.
  usePointerMenuGestures();
  const navigate = useNavigate();
  const location = useLocation();
  const { paneId, spaceId } = useParams();
  const preferences = useSyncExternalStore(
    preferenceStore.subscribe,
    preferenceStore.snapshot,
    preferenceStore.snapshot,
  );
  // THE RAILS ASK A DIFFERENT QUESTION FROM THE ROUTE. `ambientPanes` narrows rows to the address
  // the URL is on, which is exactly right for the route and exactly wrong here: a rail's job is to
  // say what this pack contains, so it takes the merged rows and groups them by member.
  const allPanes = useMemo(
    () => [...data.agents, ...data.shellPanes],
    [data.agents, data.shellPanes],
  );
  // WHY A MEMBER IS NOT ANSWERING, decided once, here, and carried down as data.
  //
  // The lead's own boolean is the honest signal for a WRITE, and it is deliberately unsmoothed there.
  // A label in a list is a different question: the lead's per-peer probe budget is strictly below its
  // poll interval, so one slow exchange on a loaded member fails a single sweep, and repainting the
  // row for that is the same flap as calling a stale receipt unreachable — one layer down.
  //
  // So a refusal must be corroborated by a receipt old enough that it cannot be a single missed
  // sweep. Both clocks here are the LEAD's — `ts` is when it assembled the body, `lastSeenAt` when it
  // last heard from the member — so this subtraction is honest, unlike one against the phone's clock.
  // An incompatible protocol needs no corroboration: it is a verdict, not a missed poll.
  const hostFaults = useMemo(() => {
    const faults = new Map<string, NavigationHostFault>();
    for (const server of data.servers ?? []) {
      if (server.isLead) continue;
      if (server.protocol === "incompatible") {
        faults.set(server.id, "incompatible");
      } else if (!server.reachable && data.ts > 0 && data.ts - server.lastSeenAt > MISSED_SWEEP_MS) {
        faults.set(server.id, "refused");
      }
    }
    return faults;
  }, [data.servers, data.ts]);
  // The member order is the ROSTER's, lead first, so the rail does not reorder itself as panes come
  // and go — except that a member which is not answering sinks below the ones that are, because it
  // has nothing current to contribute and should not sit between two machines that do. A host
  // present only in the rows sorts after the roster's, by id, rather than vanishing.
  const hostIds = useMemo(() => {
    const rank = (server: { id: string; isLead: boolean }): number =>
      hostFaults.has(server.id) ? 2 : server.isLead ? 0 : 1;
    const ordered = (data.servers ?? [])
      .toSorted((a, b) => rank(a) - rank(b))
      .map((server) => server.id);
    const known = new Set(ordered);
    const extra = [...new Set(allPanes.map((pane) => pane.host ?? ""))]
      .filter((host) => host !== "" && !known.has(host))
      .toSorted();
    // A solo snapshot has no roster at all, and its rows carry no host: one member, spelled "".
    return ordered.length === 0 && extra.length === 0 ? [""] : [...ordered, ...extra];
  }, [data.servers, allPanes, hostFaults]);
  const tree = useMemo(
    () =>
      deriveNavigationTree({
        hosts: hostIds.map((hostId) => {
          const on = <T extends { host?: string }>(rows: readonly T[]): T[] =>
            hostId === "" ? [...rows] : rows.filter((row) => (row.host ?? "") === hostId);
          return {
            hostId,
            // Naming a host is Collie's job; its resolver falls back to the id, and a solo snapshot
            // has no roster at all, so the tree says "this host" rather than inventing a name.
            hostLabel: hostName(data.servers, hostId || undefined) ?? t("fleet.navigation.thisHost"),
            fault: hostFaults.get(hostId),
            workspaces: on(data.allWorkspaces ?? data.workspaces),
            tabs: on(data.allTabs ?? data.tabs),
            agents: on(data.agents).map(toNavigationPane),
            shellPanes: on(data.shellPanes).map(toNavigationPane),
          };
        }),
        selectedPaneId: paneId,
      }),
    [
      hostIds,
      hostFaults,
      data.servers,
      data.allWorkspaces,
      data.workspaces,
      data.allTabs,
      data.tabs,
      data.agents,
      data.shellPanes,
      paneId,
    ],
  );

  const revalidator = useRevalidator();
  // Collie's own create-and-jump flow, reused whole rather than reimplemented. It carries four
  // things a bare `createTab` call does not: the write gate, the API error message, the revalidate,
  // and — the one that actually made the command look broken — the fresh Pane handed to the route
  // through navigation state. Without that last piece the new Pane is not in the snapshot yet, so
  // the page it lands on reports an Agent that is gone.
  const { newTab } = useSpaceActions();
  // The operator's own bindings and prefix. Absent, unserved or unreadable answers the shipped
  // defaults, so this can never leave the keyboard with nothing bound.
  const fleetSettings = useFleetSettings();
  const { refused: notPaired } = usePairing();
  // The same two gates every other write surface composes by AND: a device the operator has not
  // authorised, and one that holds no pairing credential. The sheets below show their own read-only
  // note rather than offering an action that would be refused.
  const readOnly = isReadOnly(data.device) || notPaired;
  // Which row's actions are open, if any. Resolved to Collie's own row objects at render, so the
  // sheets act on exactly the pane or tab the snapshot describes rather than on a copy of it.
  const [actions, setActions] = useState<NavigationSubject | null>(null);
  // Renaming is the fork's own input at the command bar's position — a rename begun from the
  // keyboard has to put its field where the operator is already looking. Closing stays on Collie's
  // sheet above, which is where the blast-radius confirmation already lives.
  const [renaming, setRenaming] = useState<RenameTarget | null>(null);
  // A close begun with a key is confirmed with a key. The row-actions surface keeps its own
  // two-activation confirm for the pointer; this is the keyboard's, on the keyboard's own panel.
  const [closing, setClosing] = useState<
    { kind: "tab"; tabId: string; label: string } | { kind: "pane"; paneId: string; label: string } | null
  >(null);
  const actionPane =
    actions?.kind === "pane"
      ? (allPanes.find((pane) => pane.paneId === actions.paneId) ?? null)
      : null;
  const actionTab =
    actions?.kind === "tab" ? (data.tabs.find((tab) => tab.tabId === actions.tabId) ?? null) : null;
  // A Space is resolved to the snapshot's own row for the same reason a Pane and a Tab are: the
  // sheet acts on what the current snapshot describes, never on a copy the tree took a poll ago.
  const actionSpace =
    actions?.kind === "space"
      ? ((data.allWorkspaces ?? data.workspaces).find(
          (workspace) => workspace.workspaceId === actions.workspaceId,
        ) ?? null)
      : null;

  const [hierarchyOpen, setHierarchyOpen] = useState(false);
  // Both rails together, never one — the command collapses the CHROME, and a half-collapsed frame is
  // an asymmetry nobody asked for. Not persisted: it is a "get out of my way for a minute" gesture,
  // and a rail that stayed hidden across a reload would look like the feature had broken.
  const [railsCollapsed, setRailsCollapsed] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const closeControl = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const lastLocation = useRef(`${location.pathname}${location.search}`);

  const closeHierarchy = useCallback(() => setHierarchyOpen(false), []);
  const toggleHierarchy = useCallback(() => setHierarchyOpen((open) => !open), []);
  const setTrigger = useCallback((element: HTMLButtonElement | null) => {
    trigger.current = element;
  }, []);

  // FOCUS RETURNS IN AN EFFECT, not in the click handler. While the overlay stands, the whole route
  // column — the header with it — is inert, so the trigger cannot take focus until the commit that
  // lifts that inertness has landed. An effect runs after exactly that commit; a frame callback
  // scheduled from the event would race it.
  useEffect(() => {
    if (hierarchyOpen) {
      closeControl.current?.focus();
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      trigger.current?.focus();
    }
  }, [hierarchyOpen]);

  useEffect(() => {
    if (globalThis.matchMedia === undefined) return;
    const wide = globalThis.matchMedia("(min-width: 1280px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setHierarchyOpen(false);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!hierarchyOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeHierarchy();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeHierarchy, hierarchyOpen]);

  useEffect(() => {
    const current = `${location.pathname}${location.search}`;
    if (current !== lastLocation.current) {
      lastLocation.current = current;
      setHierarchyOpen(false);
    }
  }, [location.pathname, location.search]);

  // A row carries the member it belongs to, so activating one opens THAT member rather than the one
  // the current address happens to name.
  const openSpace = (id: string, host?: string) => {
    navigate(spacePath(id, host === undefined ? data.scope : { ...data.scope, host }));
    closeHierarchy();
  };
  const openPaneId = (id: string, host?: string) => {
    const pane = allPanes.find(
      (candidate) => candidate.paneId === id && (host === undefined || (candidate.host ?? "") === host),
    );
    navigate(panePath(id, paneScope(data.scope, pane, data.servers, data.sessions)));
    closeHierarchy();
  };
  const openAgent = useCallback(
    (agent: AgentView) => {
      navigate(panePath(agent.paneId, paneScope(data.scope, agent, data.servers, data.sessions)));
      closeHierarchy();
    },
    [navigate, data.scope, data.servers, data.sessions, closeHierarchy],
  );

  // Favourites are browser-local and change without the snapshot moving, so the roster has to be
  // recomputed when they do. The rail already reads the store directly; this subscribes so the
  // command layer's copy of the order cannot fall behind the one on screen.
  useSyncExternalStore(
    agentFavoriteStore.subscribe,
    agentFavoriteStore.snapshot,
    agentFavoriteStore.snapshot,
  );

  // Recomputed every render rather than memoised, which is what the rail beside it already does with
  // the same two calls: `triage()` and the favourites partition are cheap, and a memo here would have
  // to name the favourites revision as a dependency it never actually reads.
  // The rail draws exactly these sections, from this same function — so `next-agent` and the ninth
  // ordinal address the row the rail drew ninth, rather than agreeing by coincidence.
  const roster = paneRosterFrom(triage(data.agents, "newest"), data.shellPanes);

  // The whole pack's tabs, matching the rails: a Tab command must be able to address the Space the
  // operator is actually on, and on a pack that Space may not be the one the URL's scope narrows to.
  const tabsForCommands = data.allTabs ?? data.tabs;
  const currentPane = allPanes.find((pane) => pane.paneId === paneId);
  const hierarchyOrder = useMemo(() => hierarchyPaneOrder(tree), [tree]);

  // The two-entry history behind `last-pane`, kept for the page session only.
  const history = useRef<PaneHistory>(EMPTY_PANE_HISTORY);
  const currentKey = currentPane === undefined ? null : rosterEntryKey(currentPane);
  history.current = visitPane(history.current, currentKey);

  const openEntry = useCallback(
    (entry: { paneId: string; host?: string; session?: string }) => {
      const pane = allPanes.find(
        (candidate) =>
          candidate.paneId === entry.paneId && (candidate.host ?? "") === (entry.host ?? ""),
      );
      navigate(panePath(entry.paneId, paneScope(data.scope, pane, data.servers, data.sessions)));
      closeHierarchy();
    },
    [allPanes, navigate, data.scope, data.servers, data.sessions, closeHierarchy],
  );

  const available = useCallback(
    (scope: CommandScope) => {
      if (scope === "global") return true;
      if (scope === "navigation") return roster.entries.length > 0 || hierarchyOrder.length > 0;
      if (scope === "space") return currentPane !== undefined || spaceId !== undefined;
      return currentPane !== undefined;
    },
    [roster.entries.length, hierarchyOrder.length, currentPane, spaceId],
  );

  const adapters = useMemo<CommandAdapters>(() => {
    const open = (target: { paneId: string; host?: string } | null) => {
      if (target !== null) openEntry(target);
    };
    const built: CommandAdapters = {
      "open-fleet-settings": () => navigate(settingsPath(data.scope)),
      "toggle-fleet-sidebars": () => setRailsCollapsed((collapsed) => !collapsed),
      "next-pane": () => open(stepPaneEverywhere(hierarchyOrder, currentPane ?? null, 1)),
      "previous-pane": () => open(stepPaneEverywhere(hierarchyOrder, currentPane ?? null, -1)),
      "next-agent": () => open(stepRoster(roster.entries, currentKey, 1)),
      "previous-agent": () => open(stepRoster(roster.entries, currentKey, -1)),
      "last-pane": () => {
        const pruned = prunePaneHistory(history.current, (key) =>
          allPanes.some((pane) => rosterEntryKey(pane) === key),
        );
        const swapped = swapPaneHistory(pruned);
        history.current = swapped;
        const target = allPanes.find((pane) => rosterEntryKey(pane) === swapped.current);
        if (target !== undefined) openEntry(target);
      },
    };
    if (currentPane !== undefined) {
      Object.assign(built, {
        // RENAME AND CLOSE ARE COLLIE'S OWN SHEETS, opened on the current target. The label input,
        // the blank-clears rule for a Pane, the read-only refusal and the two-tap confirmation all
        // already live there; a Fleet-owned copy would be a second place for those rules to drift.
        "rename-pane": () =>
          setRenaming({
            kind: "pane",
            paneId: currentPane.paneId,
            // The operator's OWN name only. `paneDisplayName` falls back through a session name and
            // an agent's name, and prefilling one of those would offer to rename a Pane to a label
            // it never had.
            label: currentPane.paneLabel ?? "",
          }),
        "close-pane": () =>
          setClosing({
            kind: "pane",
            paneId: currentPane.paneId,
            label: paneDisplayName(currentPane),
          }),
        "rename-tab": () =>
          setRenaming({
            kind: "tab",
            tabId: currentPane.tabId,
            label:
              tabsForCommands.find((tab) => tab.tabId === currentPane.tabId)?.label ??
              currentPane.tabLabel ??
              "",
          }),
        "close-tab": () =>
          setClosing({
            kind: "tab",
            tabId: currentPane.tabId,
            label:
              tabsForCommands.find((tab) => tab.tabId === currentPane.tabId)?.label ??
              currentPane.tabLabel ??
              "",
          }),
        "create-tab": () => newTab(currentPane.workspaceId),
        "copy-fleet-pane-link": async () => {
          // Built from the validated current route and nothing else: no cookie, no token, and
          // nothing at all when the route is not complete.
          const path = panePath(
            currentPane.paneId,
            paneScope(data.scope, currentPane, data.servers, data.sessions),
          );
          await navigator.clipboard.writeText(new URL(path, globalThis.location.origin).toString());
        },
        "next-tab": () => {
          const tab = stepTabInSpace(tabsForCommands, currentPane, 1);
          if (tab !== null) open(paneForTab(allPanes, tab));
        },
        "previous-tab": () => {
          const tab = stepTabInSpace(tabsForCommands, currentPane, -1);
          if (tab !== null) open(paneForTab(allPanes, tab));
        },
        "next-pane-in-tab": () => open(stepPaneInTab(allPanes, currentPane, 1)),
        "previous-pane-in-tab": () => open(stepPaneInTab(allPanes, currentPane, -1)),
      } satisfies CommandAdapters);
    }
    for (const ordinal of COMMAND_ORDINALS) {
      const tabId: CommandId = `select-tab-${ordinal}`;
      const agentId: CommandId = `select-agent-${ordinal}`;
      built[tabId] = () => {
        if (currentPane === undefined) return;
        const tab = tabOrdinalInSpace(tabsForCommands, currentPane, ordinal);
        if (tab !== null) open(paneForTab(allPanes, tab, currentPane.paneId));
      };
      built[agentId] = () => open(rosterOrdinal(roster.entries, ordinal));
    }
    return built;
  }, [
    navigate,
    newTab,
    data.scope,
    data.servers,
    data.sessions,
    tabsForCommands,
    allPanes,
    hierarchyOrder,
    currentPane,
    roster.entries,
    currentKey,
    openEntry,
  ]);

  const hierarchy = (
    <NativeNavigationTree
      tree={tree}
      selectedSpaceId={spaceId}
      onOpenSpace={openSpace}
      onOpenPane={openPaneId}
      onRowActions={setActions}
      preferenceStore={preferenceStore}
    />
  );
  // Memoised on its own inputs, not rebuilt per render: this element is also the Pane page's
  // switcher content, published through context, and a fresh element every poll would re-render
  // that page for a list that did not change.
  const agents = useMemo(
    () => (
      <NativeAgentRail
        agents={data.agents}
        bridge={data.bridge}
        error={data.error}
        lastSeenAt={data.lastSeenAt}
        onOpen={openAgent}
      />
    ),
    [data.agents, data.bridge, data.error, data.lastSeenAt, openAgent],
  );

  const navigation = useMemo(
    () => ({
      hierarchyOpen,
      toggleHierarchy,
      setTrigger,
      paneSwitcher: { title: t("fleet.navigation.agents"), content: agents },
    }),
    [hierarchyOpen, toggleHierarchy, setTrigger, agents],
  );

  return (
    <FleetCommandsProvider
      adapters={adapters}
      available={available}
      roster={roster}
      onOpenPane={openEntry}
      overrides={fleetSettings.bindings}
      prefix={fleetSettings.prefix}
    >
      <NativeNavigationProvider value={navigation}>
      <div
        data-slot="native-navigation-shell"
        className="relative flex min-h-0 flex-1 overflow-hidden"
      >
        {/* Renders nothing; keeps the document's webfont state matching the three settings that can
            name a face. Here rather than in a route because it must outlive every navigation. */}
        <FleetWebfonts />
        <Rail
          title={t("fleet.navigation.hierarchy")}
          width={preferences.left.preferredWidth}
          collapsed={railsCollapsed}
        >
          {hierarchyOpen ? null : hierarchy}
        </Rail>
        <RailSeparator
          side="left"
          width={preferences.left.preferredWidth}
          onWidth={(width) => preferenceStore.setWidth("left", width)}
          label={t("fleet.navigation.resizeHierarchy")}
          collapsed={railsCollapsed}
        />

        <div
          aria-hidden={hierarchyOpen}
          inert={hierarchyOpen ? true : undefined}
          className="flex min-w-0 flex-1 flex-col"
        >
          {children}
        </div>

        <RailSeparator
          side="right"
          width={preferences.right.preferredWidth}
          onWidth={(width) => preferenceStore.setWidth("right", width)}
          label={t("fleet.navigation.resizeAgents")}
          collapsed={railsCollapsed}
        />
        <Rail
          title={t("fleet.navigation.agents")}
          width={preferences.right.preferredWidth}
          collapsed={railsCollapsed}
        >
          {agents}
        </Rail>

        <HierarchyOverlay
          open={hierarchyOpen}
          closeRef={closeControl}
          onClose={closeHierarchy}
        >
          {hierarchyOpen ? hierarchy : null}
        </HierarchyOverlay>

        {/* Collie's OWN action sheets, opened from a hierarchy row. Renaming and closing a Pane or a
            Tab is one write with one set of rules, already spelled here — a second copy of it in the
            tree would be a second place for those rules to drift. Nothing here can act on a Space:
            the bridge has no rename or close for one, and a row that offered it would be offering an
            action that cannot land. */}
        {/* RENAMING FROM THE KEYBOARD IS NOT THE ROW-ACTIONS SURFACE. A rename begun with a key has
            to put its field where the operator is already looking, which is where the command bar
            opens; the row actions stay exactly as they are for the pointer, and closing stays with
            them either way because a close needs their blast-radius confirmation.

            Mounted per target — the `key` is what makes the prefill an initial value rather than an
            effect, so a poll landing a fresh label cannot overwrite a half-typed name. */}
        {renaming !== null && (
          <FleetRenameDialog
            key={renaming.kind === "tab" ? renaming.tabId : renaming.paneId}
            target={renaming}
            scope={data.scope}
            onClose={() => setRenaming(null)}
            onRenamed={() => revalidator.revalidate()}
          />
        )}

        {closing !== null && (
          <FleetConfirmDialog
            key={closing.kind === "tab" ? closing.tabId : closing.paneId}
            title={t(closing.kind === "tab" ? "fleet.confirm.closeTab" : "fleet.confirm.closePane", {
              name: closing.label,
            })}
            detail={t(closing.kind === "tab" ? "fleet.confirm.closeTabCost" : "fleet.confirm.closePaneCost")}
            onClose={() => setClosing(null)}
            onConfirm={() => {
              const target = closing;
              void (async () => {
                try {
                  const result =
                    target.kind === "tab"
                      ? await closeTab(target.tabId, data.scope)
                      : await closePane(target.paneId, data.scope);
                  if (!result.ok) {
                    setStatus(describeApiError(result, t("fleet.confirm.failed")), "error");
                    return;
                  }
                  // Closing the Pane on screen leaves nowhere to be; every other close only needs
                  // the snapshot to catch up.
                  if (target.kind === "pane" && target.paneId === paneId) {
                    navigate(homePath(data.scope));
                  } else {
                    revalidator.revalidate();
                  }
                } catch (thrown) {
                  setStatus(describeThrownError(thrown), "error");
                }
              })();
            }}
          />
        )}

        <FleetPaneActions
          open={actionPane !== null}
          onClose={() => setActions(null)}
          pane={actionPane}
          scope={data.scope}
          readOnly={readOnly}
          onRenamed={() => revalidator.revalidate()}
          onClosed={(closed) => {
            if (closed === paneId) navigate(homePath(data.scope));
            else revalidator.revalidate();
          }}
        />
        <FleetSpaceActions
          open={actionSpace !== null}
          onClose={() => setActions(null)}
          space={actionSpace}
          readOnly={readOnly}
        />
        <FleetTabActions
          open={actionTab !== null}
          onClose={() => setActions(null)}
          tab={actionTab}
          scope={data.scope}
          readOnly={readOnly}
          onRenamed={() => revalidator.revalidate()}
          onClosed={() => revalidator.revalidate()}
        />
      </div>
      </NativeNavigationProvider>
    </FleetCommandsProvider>
  );
}

function toNavigationPane(pane: AgentView): NavigationPaneInput {
  const result: NavigationPaneInput = {
    paneId: pane.paneId,
    workspaceId: pane.workspaceId,
    tabId: pane.tabId,
    label: paneDisplayName(pane),
    agent: pane.agent,
  };
  // The operator's own name for the Pane, and only that. `paneDisplayName` above already falls back
  // through a session name, a terminal title and the Agent's own name; the model needs to know which
  // of the two values was chosen by a person, because an elided row is named by a person's choice.
  if (pane.paneLabel) result.ownLabel = pane.paneLabel;
  if (pane.status) result.status = pane.status;
  if (pane.kind) result.kind = pane.kind;
  return result;
}

/**
 * A rail's own top strip carries the safe-area inset and its title, and nothing else — no rule, and
 * no floor borrowed from the header. Both were tried: the rule cut the label off the list it names
 * (DESIGN.md §4 — a rule separates REGIONS, and these are one), and the floor spent 30px of blank
 * under a 11px label to line up with a header edge that, without a rule, nobody can see.
 */
function Rail({
  title,
  width,
  collapsed,
  children,
}: {
  title: string;
  width: number;
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      // COLLAPSED IS A WIDTH, NOT AN UNMOUNT. The rail keeps its DOM, so its scroll position and its
      // disclosure state are exactly where the operator left them when it comes back — and the route
      // column beside it grows into the released space rather than re-laying itself out.
      aria-hidden={collapsed}
      inert={collapsed ? true : undefined}
      style={{ width: collapsed ? 0 : width }}
      // --chrome, the same raised ground the header and the composer dock stand on: the rails are
      // chrome around the route, not more of the page. The rule between rail and route lives on the
      // SEPARATOR, not here — see RailSeparator.
      className={cn(
        "hidden min-h-0 shrink-0 flex-col overflow-hidden bg-chrome transition-[width,opacity] duration-200 motion-reduce:transition-none xl:flex",
        collapsed && "pointer-events-none opacity-0",
      )}
    >
      <div className="shrink-0 [padding-top:env(safe-area-inset-top)]">
        {/* The title sits DIRECTLY over its list. It carried the header's 60px floor so the three
            columns' first line agreed, but with no rule under it that agreement bought nothing and
            spent 30px of blank between a label and the thing it labels. */}
        <div className="flex items-center px-3 pb-1 pt-2">
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

function RailSeparator({
  side,
  width,
  onWidth,
  label,
  collapsed,
}: {
  side: SidebarSide;
  width: number;
  onWidth: (width: number) => void;
  label: string;
  collapsed: boolean;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const bounds = SIDEBAR_BOUNDS[side];
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onWidth(widthFromPointerDrag(side, drag.current.width, drag.current.x, event.clientX));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = widthFromSeparatorKey(side, width, event.key);
    if (next === null) return;
    event.preventDefault();
    onWidth(next);
  };
  return (
    <div
      role="separator"
      tabIndex={collapsed ? -1 : 0}
      aria-hidden={collapsed}
      inert={collapsed ? true : undefined}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={width}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      // `bg-chrome`, not transparent: the rails and the header share that ground now, and 4px of the
      // PAGE showing between them read as a dark seam down each side of the route column.
      //
      // THE RULE IS ON THIS ELEMENT'S OUTER EDGE, and that is the whole of the fix. It used to sit on
      // the rail, which put it four pixels INSIDE a continuous band of chrome — a line with the same
      // colour on both sides, and then the real chrome-to-page edge four pixels further out with no
      // line on it at all. Two visible boundaries where there is one region change. Drawn here, the
      // rule lands exactly where the ground changes, which is what a rule is for (DESIGN.md §4).
      className={cn(
        "group relative z-10 hidden shrink-0 cursor-col-resize bg-chrome outline-none transition-[width,opacity] duration-200 motion-reduce:transition-none xl:block",
        collapsed ? "w-0 opacity-0" : "w-1",
        side === "left" ? "border-r border-rule" : "border-l border-rule",
      )}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover:bg-ring group-focus-visible:w-0.5 group-focus-visible:bg-ring" />
    </div>
  );
}

function HierarchyOverlay({
  open,
  closeRef,
  onClose,
  children,
}: {
  open: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const title = t("fleet.navigation.hierarchy");
  return (
    <div
      aria-hidden={!open}
      inert={!open ? true : undefined}
      className={cn(
        "fixed inset-0 z-40 xl:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label={t("fleet.navigation.close")}
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/45 transition-opacity duration-200 motion-reduce:transition-none",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      {/* THE SAME RAIL, ARRIVING FROM THE EDGE. It wears the rail's ground and the rail's title —
          same token, same 11px uppercase caption, same absence of a rule under it — so the surface a
          phone slides in is the one a desktop keeps open, rather than a second design of it. What it
          adds is the one thing a drawer needs and a rail does not: a way to send it back. */}
      <section
        id="fleet-hierarchy-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          // A DRAWER IS NOT THE SCREEN. At 90vw it covered all but a sliver of the page, which reads
          // as a route change rather than as a panel you can dismiss by tapping past — and the rows
          // inside are a tree of short names that never needed that width. 76vw leaves a real strip
          // of the pane visible to tap back to; the 20rem cap is the wide-phone/tablet end, where the
          // rail's own resting width is the honest number rather than a share of the viewport.
          "absolute inset-y-0 left-0 flex w-[min(76vw,20rem)] flex-col border-r border-rule bg-chrome shadow-xl transition-transform duration-200 motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="shrink-0 [padding-top:env(safe-area-inset-top)]">
          <div className="flex items-center justify-between gap-2 pb-1 pl-3 pr-1 pt-2">
            <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </span>
            <button
              ref={closeRef}
              type="button"
              aria-label={t("fleet.navigation.close")}
              onClick={onClose}
              className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </div>
  );
}
