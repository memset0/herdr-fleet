import { parseViewSnapshot, VIEW_STATE_PATH, type ViewCommand, type ViewSnapshot } from "../../../fleet/view-state/document.ts";
import type { TerminalRef } from "../../../fleet/bindings/identity.ts";
import { VIEW_PRESENCE_PATH } from "../../../fleet/view-state/document.ts";
import { asJsonNumber, asJsonObject, parseJson } from "@/lib/json";
import { mounted } from "@/lib/base-path";

export interface ViewClientState {
  readonly activeViewers?: number | null;
  readonly snapshot: ViewSnapshot | null;
  readonly joined: boolean;
  readonly joining: boolean;
  readonly available: boolean;
  readonly busy: boolean;
  readonly error: "conflict" | "occupied" | "unavailable" | null;
}

/** A shell-local client: no stale refresh can roll back a write or publish a followed route. */
export function createViewClient(fetcher: typeof fetch = fetch) {
  const tabId = crypto.randomUUID();
  let pulseSequence = 0;
  let state: ViewClientState = { activeViewers: null, snapshot: null, joined: false, joining: false, available: false, busy: false, error: null };
  let generation = 0;
  let participation = 0;
  let lastRoute = "";
  let followedRoute: string | null = null;
  let writes = Promise.resolve();
  const listeners = new Set<() => void>();
  const update = (patch: Partial<ViewClientState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const refresh = async () => {
    if (state.busy) return;
    const own = ++generation;
    try {
      const response = await fetcher(mounted(VIEW_STATE_PATH), { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const snapshot = response.ok ? parseViewSnapshot(parseJson(await response.text())) : null;
      if (own !== generation) return;
      if (!snapshot) throw new Error("View state unavailable");
      update({ snapshot, available: true, error: state.error === "unavailable" ? null : state.error });
    } catch {
      if (own === generation) update({ available: false, error: "unavailable" });
    }
  };
  const mutate = (command: ViewCommand): Promise<boolean> => {
    if (!state.available) return Promise.resolve(false);
    ++generation;
    update({ busy: true, error: null });
    const result = writes.then(async () => {
      if (!state.available) return false;
      try {
        const response = await fetcher(mounted(VIEW_STATE_PATH), {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(command), signal: AbortSignal.timeout(10_000),
        });
        const snapshot = parseViewSnapshot(parseJson(await response.text()));
        if (snapshot && (response.ok || response.status === 409 || response.status === 422)) {
          update({ snapshot, available: true, error: response.ok ? null : response.status === 409 ? "conflict" : "occupied" });
          return response.ok;
        }
        throw new Error("View state unavailable");
      } catch { update({ available: false, error: "unavailable" }); return false; }
    });
    writes = result.then(() => undefined);
    const tail = writes;
    void writes.then(() => { if (writes === tail) update({ busy: false }); return undefined; });
    return result;
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh, mutate,
    async presence(active: boolean, keepalive = false) {
      const sequence = ++pulseSequence;
      try {
        const response = await fetcher(mounted(VIEW_PRESENCE_PATH), { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: tabId, sequence, active }), keepalive, signal: AbortSignal.timeout(10_000) });
        const count = response.ok ? asJsonNumber(asJsonObject(parseJson(await response.text()))?.active) : undefined;
        if (sequence === pulseSequence) update({ activeViewers: count !== undefined && Number.isSafeInteger(count) && count >= 0 ? count : null });
      } catch { if (sequence === pulseSequence) update({ activeViewers: null }); }
    },
    async join() { const own = ++participation; update({ joining: true }); await writes; if (own !== participation) return; await refresh(); if (own === participation) update({ joined: state.available, joining: false }); },
    leave() { participation += 1; followedRoute = null; update({ joined: false, joining: false }); },
    markFollow(route: string) { followedRoute = route; },
    observeRoute(route: string, terminal: TerminalRef | null, visit = route) {
      if (visit === lastRoute) return;
      lastRoute = visit;
      if (route === followedRoute) { followedRoute = null; return; }
      followedRoute = null;
      if (state.joined && state.available && terminal) void mutate({ type: "select", terminal });
    },
  };
}
export type ViewClient = ReturnType<typeof createViewClient>;
