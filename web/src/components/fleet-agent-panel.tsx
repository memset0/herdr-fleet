import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { GripVertical, Users, X } from "lucide-react";
import { PANEL_SLOT_COUNT } from "../../../fleet/view-state/document.ts";
import { resolveTerminalReference, terminalKey, terminalReference, type TerminalRef } from "../../../fleet/bindings/identity.ts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { NativeAgentCardProps } from "@/components/native-agent-card";
import { NativeAgentRail } from "@/components/native-agent-rail";
import { FleetPanelTile } from "@/components/fleet-panel-tile";
import { useFleetView } from "@/components/fleet-view-experience";
import { resolvePanelTerminal } from "@/lib/fleet-panel-inventory";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";
import { paneName } from "@/lib/pane-name";
import { hostName } from "@/lib/hosts";
import type { HomeData } from "@/lib/loaders";
import type { AgentView } from "@/lib/types";
import { useNav } from "@/hooks/use-nav";
import { cn } from "@/lib/utils";
import "./fleet-agent-panel.css";

interface Drag { pointer: number; x: number; y: number; ref: TerminalRef; moved: boolean; name: string }

export function FleetAgentPanel({ data }: { data: HomeData }) {
  useFleetLocale();
  const view = useFleetView();
  const nav = useNav();
  const [chosen, setChosen] = useState<TerminalRef | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [carried, setCarried] = useState<{ x: number; y: number; name: string } | null>(null);
  const suppressClick = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const queue = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef<number | undefined>(undefined);
  const cleanup = () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); drag.current = null; };
  useEffect(() => {
    const block = (event: TouchEvent) => { if (drag.current) event.preventDefault(); };
    document.addEventListener("touchmove", block, { passive: false, capture: true });
    return () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); document.removeEventListener("touchmove", block, true); };
  }, []);
  if (!view) return null;
  const { client, state, inventory } = view;
  const slots = state.snapshot?.slots ?? Array.from({ length: PANEL_SLOT_COUNT }, () => null);
  const rows = state.snapshot?.rows ?? 3, columns = state.snapshot?.columns ?? 4;
  // SAFETY: React CSSProperties permits custom properties at runtime; this numeric grid variable is owned here.
  const gridStyle = { "--panel-columns": columns, "--panel-rows": rows } as CSSProperties;
  const live = (agent: AgentView) => {
    const ref = terminalReference(agent);
    return ref !== null && resolvePanelTerminal(ref, inventory).status === "resolved";
  };
  const assign = async (index: number, terminal: TerminalRef | null) => {
    const accepted = await client.mutate({ type: "slot", index, expected: slots[index] ?? null, terminal, rows, columns });
    if (accepted) setChosen(null);
  };
  const open = (agent: AgentView) => {
    if (!live(agent)) return;
    const terminal = terminalReference(agent);
    if (terminal) void client.mutate({ type: "select", terminal });
  };
  const targetAt = (x: number, y: number) => {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-panel-slot]");
    if (!hit || !root.current?.contains(hit)) return null;
    return Number(hit.dataset.panelSlot);
  };
  const scrollDrag = () => {
    const active = drag.current;
    const scroller = queue.current;
    if (!active || !scroller) return;
    const bounds = scroller.getBoundingClientRect();
    if (active.y > bounds.top && active.y < bounds.bottom) {
      if (active.y < bounds.top + 36) scroller.scrollTop -= 12;
      if (active.y > bounds.bottom - 36) scroller.scrollTop += 12;
    }
    const grid = root.current?.querySelector<HTMLElement>(".fleet-panel-grid-region");
    if (grid) {
      const area = grid.getBoundingClientRect();
      if (active.x >= area.left && active.x <= area.right && active.y >= area.top && active.y <= area.bottom) {
        if (active.y < area.top + 28) grid.scrollTop -= 10;
        if (active.y > area.bottom - 28) grid.scrollTop += 10;
        if (active.x < area.left + 28) grid.scrollLeft -= 10;
        if (active.x > area.right - 28) grid.scrollLeft += 10;
      }
    }
    setCarried({ x: active.x, y: active.y, name: active.name });
    setHovered(targetAt(active.x, active.y));
    frame.current = requestAnimationFrame(scrollDrag);
  };
  const begin = (event: ReactPointerEvent<HTMLElement>, agent: AgentView) => {
    suppressClick.current = false;
    if (!(event.target instanceof Element) || !event.target.closest("[data-panel-handle]")) return;
    if (event.button !== 0 || !live(agent) || !state.available || state.busy) return;
    const ref = terminalReference(agent);
    if (!ref) return;
    cleanup();
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, ref, moved: false, name: paneName(agent) };
    suppressClick.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setChosen(null); scrollDrag();
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointer) return;
    active.moved ||= Math.hypot(event.clientX - active.x, event.clientY - active.y) > 2;
    active.x = event.clientX; active.y = event.clientY;
    event.preventDefault(); setHovered(targetAt(active.x, active.y));
  };
  const finish = (event: ReactPointerEvent<HTMLElement>, cancel = false) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const target = !cancel ? targetAt(event.clientX, event.clientY) : null;
    cleanup(); setHovered(null); setCarried(null);
    suppressClick.current = true;
    if (cancel || target !== null) setChosen(null);
    if (!cancel && target === null && !active.moved) setChosen(active.ref);
    if (target !== null) void assign(target, active.ref);
  };

  const rowPresentation = (agent: AgentView): Pick<NativeAgentCardProps, "actions" | "unavailable" | "interaction" | "current"> => {
    const ref = terminalReference(agent), available = live(agent);
    const picked = ref && chosen && terminalKey(ref) === terminalKey(chosen);
    const selected = ref && state.snapshot?.selection && terminalKey(ref) === terminalKey(state.snapshot.selection);
    return { unavailable: !available, current: !!selected,
      interaction: {
        onPointerDown: (event) => begin(event, agent), onPointerMove: move,
        onPointerUp: (event) => finish(event), onPointerCancel: (event) => finish(event, true),
        onLostPointerCapture: (event) => finish(event, true),
        onContextMenu: (event) => event.preventDefault(),
        onClickCapture: (event) => { if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } },
      },
      actions: <Button variant="ghost" size="icon" data-panel-handle="" aria-pressed={!!picked} aria-label={ft("fleet.panel.assign", { name: paneName(agent) })}
        disabled={!available || !state.available || state.busy} className={cn("touch-none size-11", picked && "bg-primary/10 text-primary ring-1 ring-inset ring-primary/40")}
        onClick={() => setChosen(picked ? null : ref)}><GripVertical className="size-5" /></Button>,
    };

  };

  return <div ref={root} data-slot="fleet-agent-panel" className="flex h-(--app-h) w-full flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
    <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 px-3">
      <h1 className="text-sm font-medium">{ft("fleet.panel.title")}</h1>
      <span role="status" data-slot="panel-sync-receivers" className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
        <Users className="size-4" />{state.activeViewers == null ? ft("fleet.panel.unavailable") : ft("fleet.panel.receivers", { count: state.activeViewers })}
      </span>
    </div>
    <div className="fleet-panel-body" style={gridStyle}>
    <div className="fleet-panel-grid-region">
      <div role="group" aria-label={ft("fleet.panel.slots")} className="fleet-panel-grid" style={gridStyle}>
        {slots.map((ref, index) => {
          const resolved = ref ? resolvePanelTerminal(ref, inventory) : null;
          const agent = resolved?.status === "resolved" ? resolved.pane : null;
          const observed = ref ? resolveTerminalReference(ref, inventory.panes, true) : null;
          const shown = observed?.status === "resolved" ? observed.pane : null;
          const current = ref && state.snapshot?.selection && terminalKey(ref) === terminalKey(state.snapshot.selection);
          return <div key={index} data-panel-slot={index} className={cn("fleet-panel-slot relative aspect-square min-w-0 overflow-hidden rounded-md border border-border bg-card", hovered === index && "border-primary ring-2 ring-primary", current && "border-primary ring-2 ring-inset ring-primary/50")}>
            <button type="button" aria-label={ft("fleet.panel.slot", { index: index + 1 })}
              disabled={!state.available || state.busy || (!chosen && !agent)}
              onClick={() => { if (chosen) void assign(index, chosen); else if (agent) open(agent); }}
              className="fleet-panel-slot-button flex size-full min-w-0 flex-col items-center justify-center gap-1 overflow-hidden p-2 text-center focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60">
              <span className="absolute left-2 top-1 text-[10px] tabular-nums text-muted-foreground">{index + 1}</span>
              <FleetPanelTile agent={shown} available={agent !== null} reference={ref} host={shown ? hostName(data.servers, shown.host) : undefined} />
            </button>
            {ref && <Button variant="ghost" size="icon" className="absolute right-0 top-0 size-7" aria-label={ft("fleet.panel.clearSlot", { index: index + 1 })}
              disabled={!state.available || state.busy} onClick={() => void assign(index, null)}><X className="size-3" /></Button>}
          </div>;
        })}
      </div>
    </div>
    <div ref={queue} data-slot="panel-agent-queue" className="fleet-panel-queue pb-[env(safe-area-inset-bottom)]">
      <div className="sticky top-0 z-10 flex min-h-10 items-center gap-2 border-b border-rule bg-background py-1 text-xs text-muted-foreground" role="status">
        <span className="min-w-0 flex-1">{state.error ? ft(state.error === "conflict" ? "fleet.panel.conflict" : state.error === "occupied" ? "fleet.panel.occupied" : "fleet.panel.unavailable") : ft(chosen ? "fleet.panel.chooseSlot" : "fleet.panel.hint")}</span>
        {chosen && <Button variant="ghost" size="sm" onClick={() => setChosen(null)}>{ft("fleet.panel.cancel")}</Button>}
      </div>
      <h2 className="py-3 text-xs font-medium">{ft("fleet.panel.allAgents", { count: inventory.agents.length })}</h2>
      <NativeAgentRail agents={[...inventory.agents]} bridge={data.bridge} tabs={data.allTabs ?? data.tabs} servers={data.servers}
        onOpen={open} rowPresentation={rowPresentation} />
      <div className="flex flex-col gap-3 border-t border-rule py-6">
        <h2 className="text-xs font-medium">{ft("fleet.panel.layout")}</h2>
        <div className="flex gap-3">{(["rows", "columns"] as const).map((dimension) => <label key={dimension} className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
          {ft(dimension === "rows" ? "fleet.panel.rows" : "fleet.panel.columns")}
          <Select value={dimension === "rows" ? rows : columns} disabled={!state.available || state.busy}
            onChange={(event) => void client.mutate({ type: "layout", rows: dimension === "rows" ? Number(event.target.value) : rows,
              columns: dimension === "columns" ? Number(event.target.value) : columns, expectedRows: rows, expectedColumns: columns })}>
            {[1, 2, 3, 4, 5, 6].map((number) => <option key={number} value={number}>{number}</option>)}
          </Select>
        </label>)}</div>
        <Button variant="outline" size="lg" className="w-full" onClick={() => nav.upTo("/")}>{ft("fleet.panel.exit")}</Button>
      </div>
    </div>
    </div>
    {carried && <div data-slot="panel-drag-preview" className="fleet-panel-drag-preview" style={{ left: carried.x, top: carried.y }}>
      <GripVertical className="size-4 shrink-0" /><span className="truncate">{carried.name}</span>
    </div>}
  </div>;
}
