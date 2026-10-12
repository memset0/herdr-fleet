import { resolveTerminalReference, terminalKey, terminalReference, type TerminalRef } from "../../../fleet/bindings/identity.ts";
import { fetchSnapshot } from "@/lib/api";
import type { AgentView, SnapshotResponse } from "@/lib/types";

export interface PanelInventory {
  readonly agents: readonly AgentView[];
  readonly panes: readonly AgentView[];
  readonly fresh: ReadonlySet<string>;
}

export function inventoryFromSnapshots(snapshots: readonly SnapshotResponse[], stale: readonly AgentView[] = [], widenedHosts?: readonly string[], failedHosts: readonly string[] = []): PanelInventory {
  const panes: AgentView[] = [];
  const fresh = new Set<string>();
  const observations = new Set<string>();
  // Each widened member response replaces that member's primary-only rows in the merged lead body.
  const widened = new Set(widenedHosts ?? snapshots.slice(1).flatMap((snap) => [...snap.agents, ...(snap.shellPanes ?? [])].map((pane) => pane.host ?? "")));
  snapshots.forEach((snap, index) => {
    for (const pane of [...snap.agents, ...(snap.shellPanes ?? [])]) {
      if (index === 0 && widened.has(pane.host ?? "")) continue;
      // A host-scoped snapshot still contains other members' primary rows.
      if (index > 0 && widenedHosts && (pane.host ?? "") !== widenedHosts[index - 1]) continue;
      const ref = terminalReference(pane);
      const placement = JSON.stringify([pane.host ?? "", pane.bindingSession ?? pane.session ?? "", pane.paneId, ref?.id ?? null]);
      if (observations.has(placement)) continue;
      observations.add(placement);
      panes.push(pane);
      const host = snap.servers?.find((server) => server.id === pane.host);
      const session = snap.sessions?.find((entry) => entry.name === (pane.bindingSession ?? pane.session) && (entry.host ?? "") === (pane.host ?? ""));
      const hostFresh = pane.host ? host?.reachable === true && (!host.isLead || snap.bridge === "connected") : snap.bridge === "connected";
      if (ref && !failedHosts.includes(pane.host ?? "") && hostFresh && session?.reachable !== false) fresh.add(terminalKey(ref));
    }
  });
  // Retain unavailable members for display; never retain a removed terminal on a live member.
  const lead = snapshots[0];
  for (const pane of stale) {
    const host = lead?.servers?.find((server) => server.id === pane.host);
    const ref = terminalReference(pane);
    const alreadyListed = ref && panes.some((row) => {
      const candidate = terminalReference(row);
      return candidate !== null && terminalKey(candidate) === terminalKey(ref);
    });
    if ((host?.reachable === false || failedHosts.includes(pane.host ?? "")) && ref && !alreadyListed) panes.push(pane);
  }
  return { panes, agents: panes.filter((pane) => pane.kind !== "shell"), fresh };
}

export async function loadPanelInventory(signal: AbortSignal, previous: PanelInventory): Promise<PanelInventory> {
  const lead = await fetchSnapshot(undefined, signal, true);
  const peers = await Promise.all((lead.servers ?? []).filter((server) => !server.isLead && server.reachable).map(async (server) => {
    try { return { host: server.id, snapshot: await fetchSnapshot({ host: server.id, session: undefined }, signal, true) }; }
    catch { return { host: server.id, snapshot: null }; }
  }));
  return inventoryFromSnapshots([lead, ...peers.flatMap((peer) => peer.snapshot ? [peer.snapshot] : [])], previous.panes,
    peers.filter((peer) => peer.snapshot !== null).map((peer) => peer.host), peers.filter((peer) => peer.snapshot === null).map((peer) => peer.host));
}

export function resolvePanelTerminal(ref: TerminalRef, inventory: PanelInventory) {
  return resolveTerminalReference(ref, inventory.panes.filter((pane) => {
    const candidate = terminalReference(pane);
    return candidate !== null && inventory.fresh.has(terminalKey(candidate));
  }), true);
}
