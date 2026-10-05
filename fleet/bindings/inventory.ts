import { asJsonObject, asJsonString, parseJson, type JsonValue } from "../../web/src/lib/json.ts";
import type { FleetLeadConfig } from "../config.ts";
import { proxyCollie, type FleetFetcher } from "../proxy.ts";
import { bindingPlace, type PlaceEvidence } from "./place.ts";
import { terminalReference, type BindingPane } from "./identity.ts";

export interface LocatedTerminal extends BindingPane {
  readonly workspace: string;
  readonly fresh: boolean;
  readonly primary: boolean;
}

function rows(value: JsonValue | undefined): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

/** Preserve stale rows for display, but never use them as migration or action evidence. */
export function readBindingInventory(value: JsonValue | undefined): LocatedTerminal[] {
  const doc = asJsonObject(value);
  if (!doc || !Array.isArray(doc.agents) || !Array.isArray(doc.shellPanes)) throw new Error("Terminal inventory unavailable");
  const servers = rows(doc.servers).map(asJsonObject);
  const sessions = rows(doc.sessions).map(asJsonObject);
  const result: LocatedTerminal[] = [];
  for (const item of [...doc.agents, ...doc.shellPanes]) {
    const p = asJsonObject(item);
    const paneId = asJsonString(p?.paneId), bindingId = asJsonString(p?.bindingId);
    const bindingSession = asJsonString(p?.bindingSession);
    const workspace = asJsonString(p?.workspaceLabel) || asJsonString(p?.workspaceId);
    if (!paneId || !workspace || !bindingId || bindingSession === undefined) continue;
    const host = asJsonString(p?.host) ?? "", session = asJsonString(p?.session) ?? "";
    const owner = servers.find((server) => server?.id === host);
    const localSession = sessions.find((entry) => entry?.name === bindingSession && (asJsonString(entry?.host) ?? "") === host);
    const fresh = (host ? owner?.reachable === true : doc.bridge === "connected") && localSession?.reachable !== false;
    const pane = { paneId, bindingId, bindingSession, workspace, host, session, fresh, primary: localSession?.isPrimary === true };
    if (terminalReference(pane)) result.push(pane);
  }
  return result;
}

export function placeEvidence(panes: readonly LocatedTerminal[]): PlaceEvidence[] {
  return panes.filter((pane) => pane.fresh).flatMap((pane) => {
    const legacy = { row: [pane.host ?? "", pane.session ?? "", pane.paneId].join("\u0000"), space: pane.workspace };
    const evidence = { legacy, current: bindingPlace(pane, legacy), target: legacy.row };
    if (!pane.primary || !pane.session) return [evidence];
    return [evidence, { ...evidence, legacy: { ...legacy, row: [pane.host ?? "", "", pane.paneId].join("\u0000") } }];
  });
}

/** Uses the existing authenticated HTTP boundary, never another member's multiplexer socket. */
export async function fetchBindingInventory(
  request: Request, config: FleetLeadConfig, fetcher?: FleetFetcher,
): Promise<LocatedTerminal[]> {
  const read = async (host?: string) => {
    const url = new URL("/api/snapshot", config.public.origin);
    url.searchParams.set("sessions", "all");
    if (host) url.searchParams.set("host", host);
    const response = await proxyCollie(new Request(url, { headers: request.headers, signal: AbortSignal.timeout(10_000) }), config, fetcher);
    if (!response.ok) throw new Error("Terminal inventory unavailable");
    return parseJson(await response.text());
  };
  const initial = await read();
  const doc = asJsonObject(initial);
  const hosts = rows(doc?.servers).map(asJsonObject).filter((host) => host?.isLead === false && host.reachable === true);
  const peers = await Promise.all(hosts.map(async (host) => {
    const id = asJsonString(host?.id);
    if (!id) return [];
    try { return readBindingInventory(await read(id)).filter((pane) => pane.host === id); }
    catch { return []; }
  }));
  const widened = new Set(hosts.map((host) => asJsonString(host?.id)));
  return [...readBindingInventory(initial).filter((pane) => !widened.has(pane.host)), ...peers.flat()];
}
