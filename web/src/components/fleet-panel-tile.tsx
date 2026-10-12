import { useEffect, useRef, useState } from "react";
import { Check, Grid2X2 } from "lucide-react";
import { terminalKey, type TerminalRef } from "../../../fleet/bindings/identity.ts";
import { AgentIcon } from "@/components/agent-icon";
import { StatusDot } from "@/components/status-badge";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";
import { paneName } from "@/lib/pane-name";
import { statusLabel, type AgentStatus, type AgentView } from "@/lib/types";

/** Slot feedback is bounded and follows one terminal, never a reused position. */
export function FleetPanelTile({ agent, reference, host, available = true }: { agent: AgentView | null; reference: TerminalRef | null; host?: string; available?: boolean }) {
  useFleetLocale();
  const previous = useRef<{ key: string; status: AgentStatus } | null>(null);
  const [feedback, setFeedback] = useState<{ status: AgentStatus; sequence: number } | null>(null);
  const sequence = useRef(0);
  const key = reference ? terminalKey(reference) : null;
  const status = available ? agent?.status : undefined;
  useEffect(() => {
    const old = previous.current;
    previous.current = key && status ? { key, status } : null;
    setFeedback(null);
    if (!key || !status || !old || old.key !== key || old.status === status) return;
    sequence.current += 1;
    setFeedback({ status, sequence: sequence.current });
    const timer = setTimeout(() => setFeedback(null), 1400);
    return () => clearTimeout(timer);
  }, [key, status]);
  return <>
    {feedback && <span key={feedback.sequence} data-slot="panel-status-feedback" data-status={feedback.status} aria-hidden
      className="fleet-panel-feedback absolute inset-0 flex items-center justify-center rounded-md">
      {feedback.status === "done" && <Check className="fleet-panel-check size-12" strokeWidth={3} />}
    </span>}
    {agent ? <>
      <AgentIcon agent={agent.agent} className="fleet-panel-tile-icon size-7 shrink-0" />
      <span className="w-full truncate text-xs font-medium">{paneName(agent)}</span>
      <span className="fleet-panel-tile-meta w-full truncate text-[10px] text-muted-foreground">{host ? `${host} · ` : ""}{agent.workspaceLabel}</span>
      <span className="flex items-center gap-1 text-[10px]"><StatusDot status={agent.status} stale={!available} className="size-2" />{available ? statusLabel(agent.status) : ft("fleet.panel.unavailable")}
        {available && agent.status === "done" && <Check className="size-3 text-status-done" />}
      </span>
    </> : <><Grid2X2 className="size-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{ft(reference ? "fleet.panel.unavailable" : "fleet.panel.emptySlot")}</span></>}
  </>;
}
