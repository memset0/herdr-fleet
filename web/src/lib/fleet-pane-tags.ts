import { bindingPlace } from "../../../fleet/bindings/place.ts";
import {
  parseTagSnapshot, TAGS_PATH, type TagCommand, type TagSnapshot, type PanePlace,
} from "../../../fleet/pane-tags/document.ts";
import { paneRowKey } from "@/lib/hosts";
import { panePlaceParts } from "@/lib/pane-name";
import { asJsonObject, asJsonString, parseJson } from "@/lib/json";
import type { AgentView } from "@/lib/types";

export function tagPanePlace(pane: AgentView): PanePlace {
  return bindingPlace(pane, { row: paneRowKey(pane), space: panePlaceParts(pane).space });
}
export type TagError = "conflict" | "duplicate" | "limit" | "missing" | "invalid" | "unavailable";
export interface TagClientState {
  snapshot: TagSnapshot | null;
  available: boolean;
  loading: boolean;
  busy: boolean;
  error: TagError | null;
}

/** One client per shell; a mutation invalidates every older refresh before it can land. */
export function createPaneTagClient(fetcher: typeof fetch = fetch) {
  let state: TagClientState = { snapshot: null, available: false, loading: true, busy: false, error: null };
  let generation = 0;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<TagClientState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const refresh = async () => {
    if (state.busy) return;
    const own = ++generation;
    try {
      const response = await fetcher(TAGS_PATH, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const snapshot = response.ok ? parseTagSnapshot(await response.text()) : null;
      if (own !== generation) return;
      if (!snapshot) throw new Error("unavailable");
      update({ snapshot, available: true, loading: false, error: state.error === "unavailable" ? null : state.error });
    } catch {
      if (own === generation) update({ available: false, loading: false });
    }
  };
  const mutate = async (command: TagCommand, expectedVersion?: string): Promise<boolean> => {
    if (state.busy || !state.available || !state.snapshot) return false;
    ++generation;
    const version = expectedVersion ?? state.snapshot.version;
    update({ busy: true, error: null });
    try {
      const response = await fetcher(TAGS_PATH, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ version, command }), signal: AbortSignal.timeout(10_000),
      });
      const text = await response.text();
      const snapshot = parseTagSnapshot(text);
      if (response.ok && snapshot) { update({ snapshot, available: true, error: null }); return true; }
      if (response.status === 409 && snapshot) {
        update({ snapshot, error: "conflict" }); return false;
      }
      const error = asJsonString(asJsonObject(parseJson(text))?.error);
      if (error === "duplicate" || error === "limit" || error === "missing" || error === "invalid") {
        update({ error }); return false;
      }
      throw new Error("unavailable");
    } catch {
      update({ available: false, error: "unavailable" }); return false;
    } finally { update({ busy: false }); }
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh, mutate,
    clearError() { update({ error: null }); },
  };
}
export type PaneTagClient = ReturnType<typeof createPaneTagClient>;
