import {
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Rows3,
  X,
} from "lucide-react";
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
  closeOverlay,
  nativeNavigationPreferences,
  nextOverlay,
  SIDEBAR_BOUNDS,
  widthFromPointerDrag,
  widthFromSeparatorKey,
  type NativeNavigationPreferenceStore,
  type NavigationOverlay,
  type SidebarSide,
} from "../../../fleet/ui/native-navigation/preferences.ts";
import { NativeAgentRail } from "@/components/native-agent-rail";
import { NativeNavigationTree } from "@/components/native-navigation-tree";
import { Button } from "@/components/ui/button";
import { ambientPanes, paneScope } from "@/lib/hosts";
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
  const tree = useMemo(
    () =>
      deriveNavigationTree({
        workspaces: data.workspaces,
        tabs: data.tabs,
        agents: localPanes.agents.map(toNavigationPane),
        shellPanes: localPanes.shellPanes.map(toNavigationPane),
        selectedPaneId: paneId,
      }),
    [data.workspaces, data.tabs, localPanes.agents, localPanes.shellPanes, paneId],
  );

  const [overlay, setOverlay] = useState<NavigationOverlay>(null);
  const hierarchyTrigger = useRef<HTMLButtonElement>(null);
  const agentsTrigger = useRef<HTMLButtonElement>(null);
  const hierarchyClose = useRef<HTMLButtonElement>(null);
  const agentsClose = useRef<HTMLButtonElement>(null);
  const lastLocation = useRef(`${location.pathname}${location.search}`);

  const restoreTrigger = useCallback((target: Exclude<NavigationOverlay, null> | null) => {
    const trigger = target === "hierarchy" ? hierarchyTrigger.current : agentsTrigger.current;
    if (trigger) requestAnimationFrame(() => trigger.focus());
  }, []);

  const closeResponsive = useCallback(
    (restore = true) => {
      const result = closeOverlay(overlay);
      setOverlay(result.next);
      if (restore) restoreTrigger(result.restore);
    },
    [overlay, restoreTrigger],
  );

  useEffect(() => {
    if (overlay === "hierarchy") hierarchyClose.current?.focus();
    if (overlay === "agents") agentsClose.current?.focus();
  }, [overlay]);

  useEffect(() => {
    if (globalThis.matchMedia === undefined) return;
    const wide = globalThis.matchMedia("(min-width: 1280px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOverlay(null);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (overlay === null) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeResponsive();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeResponsive, overlay]);

  useEffect(() => {
    const current = `${location.pathname}${location.search}`;
    if (current !== lastLocation.current) {
      lastLocation.current = current;
      if (overlay !== null) closeResponsive();
    }
  }, [closeResponsive, location.pathname, location.search, overlay]);

  const openSpace = (id: string) => {
    navigate(spacePath(id, data.scope));
    if (overlay !== null) closeResponsive();
  };
  const openPaneId = (id: string) => {
    const pane = allLocalPanes.find((candidate) => candidate.paneId === id);
    navigate(panePath(id, paneScope(data.scope, pane, data.servers, data.sessions)));
    if (overlay !== null) closeResponsive();
  };
  const openAgent = (agent: AgentView) => {
    navigate(panePath(agent.paneId, paneScope(data.scope, agent, data.servers, data.sessions)));
    if (overlay !== null) closeResponsive();
  };
  const hierarchy = (
    <NativeNavigationTree
      tree={tree}
      selectedSpaceId={spaceId}
      onOpenSpace={openSpace}
      onOpenPane={openPaneId}
      preferenceStore={preferenceStore}
    />
  );
  const agents = (
    <NativeAgentRail
      agents={localPanes.agents}
      bridge={data.bridge}
      error={data.error}
      lastSeenAt={data.lastSeenAt}
      onOpen={openAgent}
    />
  );

  return (
    <div data-slot="native-navigation-shell" className="relative flex min-h-0 flex-1 overflow-hidden">
      <DesktopSidebar
        side="left"
        title={t("fleet.navigation.hierarchy")}
        width={preferences.left.preferredWidth}
        collapsed={preferences.left.collapsed}
        onWidth={(width) => preferenceStore.setWidth("left", width)}
        onToggle={() => preferenceStore.toggleCollapsed("left")}
      >
        {overlay === "hierarchy" ? null : hierarchy}
      </DesktopSidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative z-50 flex shrink-0 items-center justify-between border-b border-rule bg-background px-2 py-1 xl:hidden">
          <Button
            ref={hierarchyTrigger}
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={overlay === "hierarchy"}
            aria-controls="fleet-hierarchy-overlay"
            onClick={() => setOverlay((current) => nextOverlay(current, "hierarchy"))}
          >
            <Rows3 className="size-4" aria-hidden />
            {t("fleet.navigation.hierarchy")}
          </Button>
          <Button
            ref={agentsTrigger}
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={overlay === "agents"}
            aria-controls="fleet-agents-overlay"
            onClick={() => setOverlay((current) => nextOverlay(current, "agents"))}
          >
            <Bot className="size-4" aria-hidden />
            {t("fleet.navigation.agents")}
          </Button>
        </div>
        <div
          aria-hidden={overlay !== null}
          inert={overlay !== null ? true : undefined}
          className="flex min-h-0 flex-1 flex-col"
        >
          {children}
        </div>
      </div>

      <DesktopSidebar
        side="right"
        title={t("fleet.navigation.agents")}
        width={preferences.right.preferredWidth}
        collapsed={preferences.right.collapsed}
        onWidth={(width) => preferenceStore.setWidth("right", width)}
        onToggle={() => preferenceStore.toggleCollapsed("right")}
      >
        {overlay === "agents" ? null : agents}
      </DesktopSidebar>

      <ResponsiveOverlay
        id="fleet-hierarchy-overlay"
        side="left"
        title={t("fleet.navigation.hierarchy")}
        open={overlay === "hierarchy"}
        closeRef={hierarchyClose}
        onClose={() => closeResponsive()}
      >
        {overlay === "hierarchy" ? hierarchy : null}
      </ResponsiveOverlay>
      <ResponsiveOverlay
        id="fleet-agents-overlay"
        side="right"
        title={t("fleet.navigation.agents")}
        open={overlay === "agents"}
        closeRef={agentsClose}
        onClose={() => closeResponsive()}
      >
        {overlay === "agents" ? agents : null}
      </ResponsiveOverlay>
    </div>
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
  if (pane.kind) result.kind = pane.kind;
  return result;
}

function DesktopSidebar({
  side,
  title,
  width,
  collapsed,
  onWidth,
  onToggle,
  children,
}: {
  side: SidebarSide;
  title: string;
  width: number;
  collapsed: boolean;
  onWidth: (width: number) => void;
  onToggle: () => void;
  children: ReactNode;
}) {
  const left = side === "left";
  const CollapseIcon = left ? PanelLeftClose : PanelRightClose;
  const ExpandIcon = left ? PanelLeftOpen : PanelRightOpen;
  const collapseLabel = left
    ? t("fleet.navigation.collapseHierarchy")
    : t("fleet.navigation.collapseAgents");
  const expandLabel = left
    ? t("fleet.navigation.expandHierarchy")
    : t("fleet.navigation.expandAgents");
  const contentId = `fleet-${side}-sidebar-content`;
  const sidebar = (
    <aside
      aria-label={title}
      style={{ width: collapsed ? 48 : width }}
      className={cn(
        "hidden min-h-0 shrink-0 flex-col bg-background transition-[width] duration-200 motion-reduce:transition-none xl:flex",
        left ? "border-r border-rule" : "border-l border-rule",
      )}
    >
      <div className={cn("flex h-11 shrink-0 items-center px-1.5", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && <span className="truncate px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>}
        <button
          type="button"
          aria-controls={contentId}
          aria-expanded={!collapsed}
          aria-label={collapsed ? expandLabel : collapseLabel}
          onClick={onToggle}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {collapsed ? <ExpandIcon className="size-4" aria-hidden /> : <CollapseIcon className="size-4" aria-hidden />}
        </button>
      </div>
      <div
        id={contentId}
        aria-hidden={collapsed}
        inert={collapsed ? true : undefined}
        className={cn("min-h-0 flex-1 overflow-y-auto", collapsed && "invisible")}
      >
        {children}
      </div>
    </aside>
  );

  return left ? (
    <>
      {sidebar}
      {!collapsed && (
        <SidebarSeparator
          side={side}
          width={width}
          onWidth={onWidth}
          label={t("fleet.navigation.resizeHierarchy")}
        />
      )}
    </>
  ) : (
    <>
      {!collapsed && (
        <SidebarSeparator
          side={side}
          width={width}
          onWidth={onWidth}
          label={t("fleet.navigation.resizeAgents")}
        />
      )}
      {sidebar}
    </>
  );
}

function SidebarSeparator({
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
      className="group relative z-10 hidden w-1 shrink-0 cursor-col-resize bg-transparent outline-none xl:block"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover:bg-ring group-focus-visible:w-0.5 group-focus-visible:bg-ring" />
    </div>
  );
}

function ResponsiveOverlay({
  id,
  side,
  title,
  open,
  closeRef,
  onClose,
  children,
}: {
  id: string;
  side: "left" | "right";
  title: string;
  open: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
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
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute inset-y-0 flex w-[min(90vw,24rem)] flex-col border-rule bg-card shadow-xl transition-transform duration-200 motion-reduce:transition-none",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          open
            ? "translate-x-0"
            : side === "left"
              ? "-translate-x-full"
              : "translate-x-full",
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
