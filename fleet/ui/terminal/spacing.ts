/**
 * Line and character spacing for the real-terminal surface, per browser.
 *
 * Beside Collie's own Text size and font choice, which are per-device display preferences kept in
 * this browser; these two are the same kind of choice and are kept the same way. They reach the
 * emulator as its `lineHeight` (a multiplier) and `letterSpacing` (pixels), so they change the cell
 * and therefore the cols×rows the terminal is resized to.
 *
 * The defaults change nothing (1 and 0). A stored value outside its range, off its step, or not a
 * number at all is read as that field's default rather than trusted: xterm throws on a line height
 * below 1, and a terminal that cannot be built is worse than one drawn at the default.
 */

import type { JsonValue } from "../../../bridge/json.ts";
import { jsonRecord } from "../../../bridge/stt/json.ts";

export const TERMINAL_SPACING_STORAGE_KEY = "herdr-fleet:terminal-spacing:v1";

export interface TerminalSpacing {
  readonly lineHeight: number;
  readonly letterSpacing: number;
}

export const DEFAULT_TERMINAL_SPACING: TerminalSpacing = { lineHeight: 1, letterSpacing: 0 };

/** The bounded steps the controls offer. xterm requires lineHeight ≥ 1; letterSpacing is px. */
export const TERMINAL_SPACING_RANGES = {
  lineHeight: { min: 1, max: 2, step: 0.05 },
  letterSpacing: { min: -1, max: 4, step: 0.5 },
} as const;

export type SpacingKey = keyof TerminalSpacing;

/** A value on its range and snapped to its step, or the field's default. */
export function boundSpacing(key: SpacingKey, value: number | null | undefined): number {
  const { min, max, step } = TERMINAL_SPACING_RANGES[key];
  if (value === null || value === undefined || !Number.isFinite(value) || value < min || value > max) {
    return DEFAULT_TERMINAL_SPACING[key];
  }
  // Snapped, then rounded to two places so 1.1500000000000001 is stored and compared as 1.15.
  return Math.round(Math.round((value - min) / step) * step * 100 + min * 100) / 100;
}

export function parseTerminalSpacing(raw: string | null): TerminalSpacing {
  if (raw === null || raw.length > 256) return DEFAULT_TERMINAL_SPACING;
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns the JsonValue representation; every field is checked below.
    parsed = JSON.parse(raw) as JsonValue;
  } catch {
    return DEFAULT_TERMINAL_SPACING;
  }
  const value = jsonRecord(parsed);
  if (value === null || value.version !== 1) return DEFAULT_TERMINAL_SPACING;
  const read = (key: SpacingKey): number => {
    const field = value[key];
    return boundSpacing(key, Number.isFinite(field) ? Number(field) : null);
  };
  return { lineHeight: read("lineHeight"), letterSpacing: read("letterSpacing") };
}

export interface SpacingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class TerminalSpacingPreference {
  private value: TerminalSpacing;
  private readonly listeners = new Set<() => void>();
  private readonly storage: SpacingStorage | null;

  constructor(storage: SpacingStorage | null = null) {
    this.storage = storage;
    let raw: string | null = null;
    try {
      raw = storage?.getItem(TERMINAL_SPACING_STORAGE_KEY) ?? null;
    } catch {
      // A browser that refuses storage draws at the defaults.
    }
    this.value = parseTerminalSpacing(raw);
  }

  snapshot = (): TerminalSpacing => this.value;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Set one field; `null` restores its default. Out-of-range values are bounded, never stored raw. */
  set = (key: SpacingKey, value: number | null): void => {
    const next = { ...this.value, [key]: boundSpacing(key, value) };
    if (next.lineHeight === this.value.lineHeight && next.letterSpacing === this.value.letterSpacing) return;
    this.value = next;
    try {
      this.storage?.setItem(TERMINAL_SPACING_STORAGE_KEY, JSON.stringify({ version: 1, ...next }));
    } catch {
      // Not remembering is a smaller failure than not applying what was asked for now.
    }
    for (const listener of Array.from(this.listeners)) listener();
  };
}

function browserStorage(): SpacingStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const terminalSpacingPreference = new TerminalSpacingPreference(browserStorage());
