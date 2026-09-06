/**
 * The one switch that chooses which surface a Pane is drawn as.
 *
 * Global rather than per Pane, because the operator asked for one mode and not a per-Pane memory to
 * maintain; browser-local rather than server-side, because it is a preference about how THIS browser
 * draws a Pane and not a fact about the deployment. `../native-navigation/preferences.ts` is the
 * same shape for the same reason.
 *
 * Default off, and recoverable to off from anything: an unreadable, absent, corrupt or foreign value
 * renders the mirror. The mirror is the surface that works everywhere, so it is what a browser that
 * cannot tell us what it wants gets.
 */

import type { JsonValue } from "../../../bridge/json.ts";
import { jsonRecord } from "../../../bridge/stt/json.ts";

export const TERMINAL_SWITCH_STORAGE_KEY = "herdr-fleet:pane-surface:v1";
export const TERMINAL_SWITCH_MAX_BYTES = 256;

export type PaneSurface = "mirror" | "terminal";

export const DEFAULT_PANE_SURFACE: PaneSurface = "mirror";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What a stored value may be. Anything else is the default, never a failure. */
export function parsePaneSurface(raw: string | null): PaneSurface {
  if (raw === null || new TextEncoder().encode(raw).byteLength > TERMINAL_SWITCH_MAX_BYTES) {
    return DEFAULT_PANE_SURFACE;
  }
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns the JsonValue representation; the two fields below are checked
    // against literals before either becomes a surface.
    parsed = JSON.parse(raw) as JsonValue;
  } catch {
    return DEFAULT_PANE_SURFACE;
  }
  const value = jsonRecord(parsed);
  if (value === null || value.version !== 1) return DEFAULT_PANE_SURFACE;
  return value.surface === "terminal" ? "terminal" : DEFAULT_PANE_SURFACE;
}

function serialize(surface: PaneSurface): string {
  return JSON.stringify({ version: 1, surface });
}

export interface PaneSurfaceStore {
  snapshot(): PaneSurface;
  subscribe(listener: () => void): () => void;
  set(surface: PaneSurface): void;
  toggle(): void;
}

export class PaneSurfacePreferenceStore implements PaneSurfaceStore {
  private value: PaneSurface;
  private readonly listeners = new Set<() => void>();

  private readonly storage: StorageLike | null;

  constructor(storage: StorageLike | null = null) {
    this.storage = storage;
    let raw: string | null = null;
    try {
      raw = storage?.getItem(TERMINAL_SWITCH_STORAGE_KEY) ?? null;
    } catch {
      // A browser that refuses storage still gets a working app; it gets the default surface.
      raw = null;
    }
    this.value = parsePaneSurface(raw);
  }

  snapshot = (): PaneSurface => this.value;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  set = (surface: PaneSurface): void => {
    if (this.value === surface) return;
    this.value = surface;
    try {
      this.storage?.setItem(TERMINAL_SWITCH_STORAGE_KEY, serialize(surface));
    } catch {
      // Not persisting is a smaller failure than not switching: the operator asked for this now.
    }
    for (const listener of Array.from(this.listeners)) listener();
  };

  toggle = (): void => {
    this.set(this.value === "terminal" ? "mirror" : "terminal");
  };
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The app's own store. One per document, read once at module load, exactly as the rails' is. */
export const paneSurfaceStore: PaneSurfaceStore = new PaneSurfacePreferenceStore(browserStorage());
