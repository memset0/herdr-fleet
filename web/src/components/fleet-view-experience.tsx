import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLocation, useMatch } from "react-router";
import { Link2, Link2Off, LoaderCircle } from "lucide-react";
import { terminalReference } from "../../../fleet/bindings/identity.ts";
import { createViewClient, type ViewClient, type ViewClientState } from "@/lib/fleet-view-state";
import { loadPanelInventory, resolvePanelTerminal, type PanelInventory } from "@/lib/fleet-panel-inventory";
import { findPane } from "@/lib/hosts";
import { panePath } from "@/lib/nav";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";
import type { HomeData } from "@/lib/loaders";
import { useNav } from "@/hooks/use-nav";
import { ToggleButton } from "@/components/ui/toggle-button";
import { Button } from "@/components/ui/button";
const FleetAgentPanel = lazy(async () => ({ default: (await import("@/components/fleet-agent-panel")).FleetAgentPanel }));

interface ViewContextValue { client: ViewClient; state: ViewClientState; inventory: PanelInventory }
const ViewContext = createContext<ViewContextValue | null>(null);
export function useFleetView() { return useContext(ViewContext); }

/** Owns the optional stream across normal routes and the fullscreen panel. */
export function FleetViewExperience({ data, children }: { data: HomeData; children: ReactNode }) {
  const location = useLocation();
  const paneId = useMatch("/pane/:paneId/*")?.params.paneId;
  const nav = useNav();
  const client = useMemo(() => createViewClient(), []);
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const [inventory, setInventory] = useState<PanelInventory>({
    agents: data.agents, panes: [...data.agents, ...data.shellPanes], fresh: new Set(),
  });
  const previous = useRef(inventory);
  previous.current = inventory;
  const here = useRef(location.pathname + location.search);
  here.current = location.pathname + location.search;
  const followed = useRef<string | null>(null);
  const panel = location.pathname === "/panel";

  const current = paneId ? findPane([...data.agents, ...data.shellPanes], paneId, data.scope, data.servers, data.sessions) : undefined;
  const currentRef = current && !data.error ? terminalReference(current) : null;
  useEffect(() => {
    if (paneId && !currentRef) return;
    client.observeRoute(location.pathname + location.search, currentRef, location.key);
  }, [client, location.pathname, location.search, location.key, currentRef, paneId]);

  useEffect(() => {
    if (!panel && !state.joined) return;
    let stopped = false;
    let active: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (stopped || document.hidden || active) return;
      const controller = new AbortController();
      active = controller;
      const load = async () => {
        try {
          const next = await loadPanelInventory(controller.signal, previous.current);
          if (!stopped && !controller.signal.aborted) setInventory(next);
        } catch {
          if (!stopped && !controller.signal.aborted) setInventory({ ...previous.current, fresh: new Set() });
        }
      };
      await Promise.all([client.refresh(), load(), client.presence(client.getSnapshot().joined && !panel)]);
      if (active === controller) active = null;
      if (!stopped) timer = setTimeout(() => void poll(), 1500);
      // Visibility may return while the aborted request is still unwinding.
      if (!stopped && !document.hidden && controller.signal.aborted) { clearTimeout(timer); void poll(); }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.hidden) { active?.abort(); void client.presence(false, true); }
      else void poll();
    };
    const withdraw = () => { void client.presence(false, true); };
    document.addEventListener("pagehide", withdraw);
    document.addEventListener("visibilitychange", visibility);
    void poll();
    return () => { stopped = true; clearTimeout(timer); active?.abort(); document.removeEventListener("visibilitychange", visibility); document.removeEventListener("pagehide", withdraw); withdraw(); };
  }, [client, panel, state.joined]);

  useEffect(() => {
    if (!state.joined || !state.available) { followed.current = null; return; }
    const snapshot = state.snapshot;
    if (!state.available || client.getSnapshot().busy || !snapshot?.selection) return;
    const stamp = `${snapshot.generation}:${snapshot.revision}`;
    const resolved = resolvePanelTerminal(snapshot.selection, inventory);
    if (resolved.status !== "resolved") { followed.current = null; return; }
    const pane = resolved.pane;
    const path = panePath(pane.paneId, { host: pane.host || undefined, session: pane.bindingSession ?? pane.session });
    if (followed.current === stamp + path) return;
    followed.current = stamp + path;
    // A panel is a controller. Following must not force it out of its independent route.
    if (panel || here.current === path) return;
    client.markFollow(path);
    nav.open(path);
  }, [state.joined, state.snapshot, state.available, state.busy, inventory, client, nav, panel]);

  const context = useMemo(() => ({ client, state, inventory }), [client, state, inventory]);
  return <ViewContext.Provider value={context}>
    {panel ? <Suspense fallback={<div className="flex h-(--app-h) items-center justify-center" aria-busy="true"><LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" /></div>}><FleetAgentPanel data={data} /></Suspense> : children}
  </ViewContext.Provider>;
}

export function FleetSyncControl({ compact = false }: { compact?: boolean }) {
  useFleetLocale();
  const view = useFleetView();
  if (!view) return null;
  const { client, state } = view;
  const unavailable = state.error === "unavailable" || (state.joined && (!state.available || (state.snapshot?.selection && resolvePanelTerminal(state.snapshot.selection, view.inventory).status !== "resolved")));
  const label = ft(state.joined ? "fleet.sync.leave" : "fleet.sync.join");
  const toggle = () => { if (state.joined) client.leave(); else void client.join(); };
  const icon = state.joining || state.busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : state.joined ? <Link2 className="size-4" /> : <Link2Off className="size-4" />;
  if (compact) return <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-pressed={state.joined}
    aria-label={unavailable ? `${label} · ${ft("fleet.panel.unavailable")}` : label} title={label}
    aria-busy={state.joining || state.busy} onClick={toggle}>{icon}</Button>;
  return <div className="flex min-h-11 items-center gap-2" aria-busy={state.joining || state.busy}>
    <ToggleButton pressed={state.joined} label={ft(state.joined ? "fleet.sync.leave" : "fleet.sync.join")}
      text={ft("fleet.sync.label")} icon={icon}
      onPressedChange={(joined) => { if (!joined) client.leave(); else void client.join(); }} />
    <span className="min-w-0 text-xs text-muted-foreground">
      {unavailable ? ft("fleet.panel.unavailable") : ""}
    </span>
  </div>;
}
