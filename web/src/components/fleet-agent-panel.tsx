import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { GripVertical, X } from "lucide-react";
import { PANEL_SLOT_COUNT } from "../../../fleet/view-state/document.ts";
import { resolveTerminalReference, terminalKey, terminalReference, type TerminalRef } from "../../../fleet/bindings/identity.ts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { NativeAgentCard } from "@/components/native-agent-card";
import { FleetPanelTile } from "@/components/fleet-panel-tile";
import { useFleetView, FleetSyncControl } from "@/components/fleet-view-experience";
import { resolvePanelTerminal } from "@/lib/fleet-panel-inventory";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";
import { paneName } from "@/lib/pane-name";
import { hostName, paneRowKey } from "@/lib/hosts";
import { panePath } from "@/lib/nav";
import type { HomeData } from "@/lib/loaders";
import type { AgentView } from "@/lib/types";
import { useNav } from "@/hooks/use-nav";
import { cn } from "@/lib/utils";
import "./fleet-agent-panel.css";

interface Drag { pointer: number; x: number; y: number; ref: TerminalRef; active: boolean; touch: boolean }

export function FleetAgentPanel({ data }: { data: HomeData }) {
  useFleetLocale();
  const view = useFleetView();
  const nav = useNav();
  const [chosen, setChosen] = useState<TerminalRef | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const queue = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const cleanup = () => { clearTimeout(hold.current); if (frame.current !== undefined) cancelAnimationFrame(frame.current); drag.current = null; };
  useEffect(() => () => { clearTimeout(hold.current); if (frame.current !== undefined) cancelAnimationFrame(frame.current); }, []);
  if (!view) return null;
  const { client, state, inventory } = view;
  const slots = state.snapshot?.slots ?? Array.from({ length: PANEL_SLOT_COUNT }, () => null);
  const rows = state.snapshot?.rows ?? 3, columns = state.snapshot?.columns ?? 4;
  // SAFETY: React CSSProperties permits custom properties at runtime; this numeric grid variable is owned here.
  const gridStyle = { "--panel-columns": columns } as CSSProperties;
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
    if (state.joined && terminal) { void client.mutate({ type: "select", terminal }); return; }
    nav.open(panePath(agent.paneId, { host: agent.host || undefined, session: agent.bindingSession ?? agent.session }));
  };
  const targetAt = (x: number, y: number) => {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-panel-slot]");
    if (!hit || !root.current?.contains(hit)) return null;
    return Number(hit.dataset.panelSlot);
  };
  const scrollDrag = () => {
    const active = drag.current;
    const scroller = queue.current;
    if (!active?.active || !scroller) return;
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
    setHovered(targetAt(active.x, active.y));
    frame.current = requestAnimationFrame(scrollDrag);
  };
  const begin = (event: ReactPointerEvent<HTMLButtonElement>, agent: AgentView) => {
    if (event.button !== 0 || !live(agent) || !state.available || state.busy) return;
    const ref = terminalReference(agent);
    if (!ref) return;
    cleanup();
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, ref, active: false, touch: event.pointerType !== "mouse" };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const arm = () => { if (drag.current) { drag.current.active = true; setChosen(ref); scrollDrag(); } };
    if (drag.current.touch) hold.current = setTimeout(arm, 350);
  };
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointer) return;
    if (!active.active && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 8) {
      if (active.touch) { cleanup(); return; }
      active.active = true; setChosen(active.ref); scrollDrag();
    }
    active.x = event.clientX; active.y = event.clientY;
    if (active.active) { event.preventDefault(); setHovered(targetAt(active.x, active.y)); }
  };
  const finish = (event: ReactPointerEvent<HTMLButtonElement>, cancel = false) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const target = active.active && !cancel ? targetAt(event.clientX, event.clientY) : null;
    cleanup(); setHovered(null);
    if (cancel || target !== null) setChosen(null);
    // A tap on the handle arms select-then-slot without opening the Pane.
    else if (!active.active) setChosen(active.ref);
    if (target !== null) void assign(target, active.ref);
  };

  return <div ref={root} data-slot="fleet-agent-panel" className="flex h-(--app-h) w-full flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
    <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 px-3">
      <h1 className="text-sm font-medium">{ft("fleet.panel.title")}</h1>
      <FleetSyncControl />
    </div>
    <div className="fleet-panel-body">
    <div className="fleet-panel-grid-region">
      <div role="group" aria-label={ft("fleet.panel.slots")} className="fleet-panel-grid" style={gridStyle}>
        {slots.map((ref, index) => {
          const resolved = ref ? resolvePanelTerminal(ref, inventory) : null;
          const agent = resolved?.status === "resolved" ? resolved.pane : null;
          const observed = ref ? resolveTerminalReference(ref, inventory.panes, true) : null;
          const shown = observed?.status === "resolved" ? observed.pane : null;
          const current = ref && state.joined && state.snapshot?.selection && terminalKey(ref) === terminalKey(state.snapshot.selection);
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
      <div className="flex flex-col divide-y divide-rule">
        {inventory.agents.map((agent) => {
          const ref = terminalReference(agent), available = live(agent);
          const picked = ref && chosen && terminalKey(ref) === terminalKey(chosen);
          const selected = ref && state.joined && state.snapshot?.selection && terminalKey(ref) === terminalKey(state.snapshot.selection);
          return <div key={paneRowKey(agent)} className={cn("relative py-1", !available && "opacity-50")}>
            <NativeAgentCard agent={agent} unavailable={!available} onOpen={() => open(agent)} pinned={false} onPinToggle={() => {}} current={!!selected}
              actions={<Button variant="ghost" size="icon" aria-pressed={!!picked} aria-label={ft("fleet.panel.assign", { name: paneName(agent) })}
              disabled={!available || !state.available || state.busy} className={cn("touch-none size-11", picked && "bg-primary/10 text-primary ring-1 ring-inset ring-primary/40")}
              onPointerDown={(event) => begin(event, agent)} onPointerMove={move}
              onPointerUp={(event) => finish(event)} onPointerCancel={(event) => finish(event, true)}
              onLostPointerCapture={(event) => finish(event, true)}
              onContextMenu={(event) => event.preventDefault()}
              onClick={(event) => { if (event.detail === 0) setChosen(picked ? null : ref); }}><GripVertical className="size-5" /></Button>} />
            {!available && <span className="sr-only">{ft("fleet.panel.unavailable")}</span>}
          </div>;
        })}
      </div>
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
  </div>;
}
