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
import { usePointerMenuGestures } from "@/components/fleet-pointer-menu";
import { FleetWebfonts } from "@/components/fleet-webfonts";
import { NativeAgentRail } from "@/components/native-agent-rail";
import { NativeNavigationProvider } from "@/components/native-navigation-context";
import { NativeNavigationTree } from "@/components/native-navigation-tree";
import { PaneActionsSheet } from "@/components/pane-actions-sheet";
import { TabActionsSheet } from "@/components/tab-actions-sheet";
import { hostName, paneScope } from "@/lib/hosts";
import { t } from "@/lib/i18n";
import type { HomeData } from "@/lib/loaders";
import { homePath, panePath, spacePath } from "@/lib/nav";
import { usePairing } from "@/lib/pairing";
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
  // The member order is the ROSTER's, lead first, so the rail does not reorder itself as panes come
  // and go. A host present only in the rows sorts after the roster's, by id, rather than vanishing.
  const hostIds = useMemo(() => {
    const roster = (data.servers ?? []).toSorted((a, b) => Number(b.isLead) - Number(a.isLead));
    const ordered = roster.map((server) => server.id);
    const known = new Set(ordered);
    const extra = [...new Set(allPanes.map((pane) => pane.host ?? ""))]
      .filter((host) => host !== "" && !known.has(host))
      .toSorted();
    // A solo snapshot has no roster at all, and its rows carry no host: one member, spelled "".
    return ordered.length === 0 && extra.length === 0 ? [""] : [...ordered, ...extra];
  }, [data.servers, allPanes]);
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
  const { refused: notPaired } = usePairing();
  // The same two gates every other write surface composes by AND: a device the operator has not
  // authorised, and one that holds no pairing credential. The sheets below show their own read-only
  // note rather than offering an action that would be refused.
  const readOnly = isReadOnly(data.device) || notPaired;
  // Which row's actions are open, if any. Resolved to Collie's own row objects at render, so the
  // sheets act on exactly the pane or tab the snapshot describes rather than on a copy of it.
  const [actions, setActions] = useState<NavigationSubject | null>(null);
  const actionPane =
    actions?.kind === "pane"
      ? (allPanes.find((pane) => pane.paneId === actions.paneId) ?? null)
      : null;
  const actionTab =
    actions?.kind === "tab" ? (data.tabs.find((tab) => tab.tabId === actions.tabId) ?? null) : null;

  const [hierarchyOpen, setHierarchyOpen] = useState(false);
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
    <NativeNavigationProvider value={navigation}>
      <div
        data-slot="native-navigation-shell"
        className="relative flex min-h-0 flex-1 overflow-hidden"
      >
        {/* Renders nothing; keeps the document's webfont state matching the three settings that can
            name a face. Here rather than in a route because it must outlive every navigation. */}
        <FleetWebfonts />
        <Rail title={t("fleet.navigation.hierarchy")} width={preferences.left.preferredWidth}>
          {hierarchyOpen ? null : hierarchy}
        </Rail>
        <RailSeparator
          side="left"
          width={preferences.left.preferredWidth}
          onWidth={(width) => preferenceStore.setWidth("left", width)}
          label={t("fleet.navigation.resizeHierarchy")}
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
        />
        <Rail title={t("fleet.navigation.agents")} width={preferences.right.preferredWidth}>
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
        <PaneActionsSheet
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
        <TabActionsSheet
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
  children,
}: {
  title: string;
  width: number;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      style={{ width }}
      // --chrome, the same raised ground the header and the composer dock stand on: the rails are
      // chrome around the route, not more of the page. The rule between rail and route lives on the
      // SEPARATOR, not here — see RailSeparator.
      className="hidden min-h-0 shrink-0 flex-col bg-chrome xl:flex"
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
}: {
  side: SidebarSide;
  width: number;
  onWidth: (width: number) => void;
  label: string;
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
      tabIndex={0}
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
        "group relative z-10 hidden w-1 shrink-0 cursor-col-resize bg-chrome outline-none xl:block",
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
          "absolute inset-y-0 left-0 flex w-[min(90vw,24rem)] flex-col border-r border-rule bg-chrome shadow-xl transition-transform duration-200 motion-reduce:transition-none",
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
