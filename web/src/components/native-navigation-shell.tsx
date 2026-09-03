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
import { useLocation, useNavigate, useParams } from "react-router";

import {
  deriveNavigationTree,
  type NavigationPaneInput,
} from "../../../fleet/ui/native-navigation/model.ts";
import {
  nativeNavigationPreferences,
  SIDEBAR_BOUNDS,
  widthFromPointerDrag,
  widthFromSeparatorKey,
  type NativeNavigationPreferenceStore,
  type SidebarSide,
} from "../../../fleet/ui/native-navigation/preferences.ts";
import { NativeAgentRail } from "@/components/native-agent-rail";
import { NativeNavigationProvider } from "@/components/native-navigation-context";
import { NativeNavigationTree } from "@/components/native-navigation-tree";
import { ambientPanes, hostName, paneScope } from "@/lib/hosts";
import { t } from "@/lib/i18n";
import type { HomeData } from "@/lib/loaders";
import { panePath, spacePath } from "@/lib/nav";
import { paneDisplayName, type AgentView } from "@/lib/types";
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
  const navigate = useNavigate();
  const location = useLocation();
  const { paneId, spaceId } = useParams();
  const preferences = useSyncExternalStore(
    preferenceStore.subscribe,
    preferenceStore.snapshot,
    preferenceStore.snapshot,
  );
  const localPanes = useMemo(
    () => ambientPanes(data.agents, data.shellPanes, data.scope, data.servers, data.sessions),
    [data.agents, data.shellPanes, data.scope, data.servers, data.sessions],
  );
  const allLocalPanes = useMemo(
    () => [...localPanes.agents, ...localPanes.shellPanes],
    [localPanes.agents, localPanes.shellPanes],
  );
  // The machine whose rows these are. A solo snapshot has no roster, so Collie's own resolver
  // returns nothing and the tree says "this host" rather than inventing a name for it.
  const hostLabel = hostName(data.servers, data.scope.host) ?? t("fleet.navigation.thisHost");
  const tree = useMemo(
    () =>
      deriveNavigationTree({
        hostId: data.scope.host ?? "",
        hostLabel,
        workspaces: data.workspaces,
        tabs: data.tabs,
        agents: localPanes.agents.map(toNavigationPane),
        shellPanes: localPanes.shellPanes.map(toNavigationPane),
        selectedPaneId: paneId,
      }),
    [
      data.scope.host,
      hostLabel,
      data.workspaces,
      data.tabs,
      localPanes.agents,
      localPanes.shellPanes,
      paneId,
    ],
  );

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

  const openSpace = (id: string) => {
    navigate(spacePath(id, data.scope));
    closeHierarchy();
  };
  const openPaneId = (id: string) => {
    const pane = allLocalPanes.find((candidate) => candidate.paneId === id);
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
      preferenceStore={preferenceStore}
    />
  );
  // Memoised on its own inputs, not rebuilt per render: this element is also the Pane page's
  // switcher content, published through context, and a fresh element every poll would re-render
  // that page for a list that did not change.
  const agents = useMemo(
    () => (
      <NativeAgentRail
        agents={localPanes.agents}
        bridge={data.bridge}
        error={data.error}
        lastSeenAt={data.lastSeenAt}
        onOpen={openAgent}
      />
    ),
    [localPanes.agents, data.bridge, data.error, data.lastSeenAt, openAgent],
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
        <Rail side="left" title={t("fleet.navigation.hierarchy")} width={preferences.left.preferredWidth}>
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
        <Rail side="right" title={t("fleet.navigation.agents")} width={preferences.right.preferredWidth}>
          {agents}
        </Rail>

        <HierarchyOverlay
          open={hierarchyOpen}
          closeRef={closeControl}
          onClose={closeHierarchy}
        >
          {hierarchyOpen ? hierarchy : null}
        </HierarchyOverlay>
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
  side,
  title,
  width,
  children,
}: {
  side: SidebarSide;
  title: string;
  width: number;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      style={{ width }}
      className={cn(
        // --chrome, the same raised ground the header and the composer dock stand on: the rails are
        // chrome around the route, not more of the page.
        "hidden min-h-0 shrink-0 flex-col bg-chrome xl:flex",
        side === "left" ? "border-r border-rule" : "border-l border-rule",
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
      // PAGE showing between them read as a dark seam down each side of the route column. The grab
      // affordance is still the hairline inside, which only appears on hover or focus.
      className="group relative z-10 hidden w-1 shrink-0 cursor-col-resize bg-chrome outline-none xl:block"
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
      <section
        id="fleet-hierarchy-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(90vw,24rem)] flex-col border-r border-rule bg-card shadow-xl transition-transform duration-200 motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-rule px-3">
          <span className="text-sm font-semibold">{title}</span>
          <button
            ref={closeRef}
            type="button"
            aria-label={t("fleet.navigation.close")}
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-md border border-transparent hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </div>
  );
}
