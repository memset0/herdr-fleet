import type { JsonValue } from "../../bridge/json.ts";
import { jsonNumberField, jsonRecord } from "../../bridge/stt/json.ts";

export const MIN_MANUAL_PANE_FIT_COLS = 20;
export const MAX_MANUAL_PANE_FIT_COLS = 500;

/**
 * The rows a device asks for, and the bounds the PICKER has rather than the ones the wire has.
 *
 * The controller accepts anything a pty does, which is four digits of rows nobody wants. This is a
 * number typed on a phone: below four the mirror shows less than a prompt and its own wrap, and past
 * two hundred the operator is asking for a scrollback rather than a viewport. Both ends are the
 * picker's judgement; the wire's own validation is unchanged and still refuses what it always did.
 */
export const MIN_MANUAL_PANE_FIT_ROWS = 4;
export const MAX_MANUAL_PANE_FIT_ROWS = 200;

export const MANUAL_PANE_FIT_ROWS_STORAGE_KEY = "herdr-fleet:pane-fit-rows:v1";
export const MANUAL_PANE_FIT_ROWS_MAX_BYTES = 256;

/**
 * The row count typed into the picker, or `null` for "leave the pane's own".
 *
 * `null` is the default and it is not the same as a number: it means this device has no opinion, so
 * a fit keeps whatever height the pane already has — which is exactly what fitting did before the
 * picker existed, and what an operator who never opens it keeps getting.
 */
export function parsePaneFitRows(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number.parseInt(trimmed, 10);
  return validManualPaneFitRows(value) ? value : null;
}

export function validManualPaneFitRows(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_MANUAL_PANE_FIT_ROWS &&
    value <= MAX_MANUAL_PANE_FIT_ROWS
  );
}

export interface PaneFitRowsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PaneFitRowsStore {
  snapshot(): number | null;
  subscribe(listener: () => void): () => void;
  set(rows: number | null): void;
}

export function parseStoredPaneFitRows(raw: string | null): number | null {
  if (raw === null || new TextEncoder().encode(raw).byteLength > MANUAL_PANE_FIT_ROWS_MAX_BYTES) {
    return null;
  }
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns the JsonValue representation; the readers below validate every
    // field, and the only one that survives is a bounded integer.
    parsed = JSON.parse(raw) as JsonValue;
  } catch {
    return null;
  }
  const record = jsonRecord(parsed);
  if (record === null) return null;
  if (Object.keys(record).some((key) => key !== "version" && key !== "rows")) return null;
  if (record.version !== 1) return null;
  const rows = jsonNumberField(record.rows);
  return rows !== null && validManualPaneFitRows(rows) ? rows : null;
}

export class ManualPaneFitRowsStore implements PaneFitRowsStore {
  private value: number | null;
  private readonly listeners = new Set<() => void>();
  private readonly storage: PaneFitRowsStorage | null;

  constructor(storage: PaneFitRowsStorage | null = null) {
    this.storage = storage;
    let raw: string | null = null;
    try {
      raw = storage?.getItem(MANUAL_PANE_FIT_ROWS_STORAGE_KEY) ?? null;
    } catch {
      raw = null;
    }
    this.value = parseStoredPaneFitRows(raw);
  }

  snapshot = (): number | null => this.value;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(rows: number | null): void {
    const next = rows !== null && validManualPaneFitRows(rows) ? rows : null;
    if (next === this.value) return;
    this.value = next;
    try {
      this.storage?.setItem(
        MANUAL_PANE_FIT_ROWS_STORAGE_KEY,
        JSON.stringify(next === null ? { version: 1 } : { version: 1, rows: next }),
      );
    } catch {
      // The in-memory number stays authoritative for this page.
    }
    for (const listener of this.listeners) listener();
  }
}

function browserRowsStorage(): PaneFitRowsStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const manualPaneFitRows = new ManualPaneFitRowsStore(browserRowsStorage());

const PROBE_CELLS = 100;

export interface ManualPaneFitGeometry {
  readonly scrollportWidth: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly cellWidth: number;
}

export type ManualPaneFitAttempt =
  | { readonly ok: true; readonly cols: number; readonly rows: number }
  | {
      readonly ok: false;
      readonly reason: "geometry" | "unsupported" | "conflict" | "failed";
    };

export interface ManualPaneFitRequestResult {
  readonly ok: boolean;
  readonly cols?: number;
  readonly rows?: number;
  readonly reason?: "unsupported" | "geometry" | "conflict" | "failed";
}

export function manualPaneFitColumns(geometry: ManualPaneFitGeometry): number {
  const { scrollportWidth, paddingLeft, paddingRight, cellWidth } = geometry;
  if (
    !Number.isFinite(scrollportWidth) ||
    scrollportWidth <= 0 ||
    !Number.isFinite(paddingLeft) ||
    paddingLeft < 0 ||
    !Number.isFinite(paddingRight) ||
    paddingRight < 0 ||
    !Number.isFinite(cellWidth) ||
    cellWidth <= 0
  ) {
    throw new Error("invalid terminal geometry");
  }
  const usableWidth = scrollportWidth - paddingLeft - paddingRight;
  if (!Number.isFinite(usableWidth) || usableWidth <= 0) {
    throw new Error("invalid terminal geometry");
  }
  return Math.max(
    MIN_MANUAL_PANE_FIT_COLS,
    Math.min(MAX_MANUAL_PANE_FIT_COLS, Math.floor(usableWidth / cellWidth)),
  );
}

export function measureManualPaneFitColumns(scrollport: HTMLElement, fontSize: number): number {
  if (!Number.isFinite(fontSize) || fontSize <= 0) throw new Error("invalid terminal geometry");
  const style = getComputedStyle(scrollport);
  const paddingLeft = cssPixels(style.paddingLeft);
  const paddingRight = cssPixels(style.paddingRight);
  const probe = document.createElement("span");
  probe.className = "font-mono tracking-normal [font-variant-ligatures:none]";
  probe.textContent = "M".repeat(PROBE_CELLS);
  probe.setAttribute("aria-hidden", "true");
  Object.assign(probe.style, {
    position: "fixed",
    visibility: "hidden",
    pointerEvents: "none",
    whiteSpace: "pre",
    fontSize: `${fontSize}px`,
    left: "-10000px",
    top: "0",
  });
  scrollport.appendChild(probe);
  const cellWidth = probe.getBoundingClientRect().width / PROBE_CELLS;
  probe.remove();
  return manualPaneFitColumns({
    scrollportWidth: scrollport.clientWidth,
    paddingLeft,
    paddingRight,
    cellWidth,
  });
}

/**
 * Fit the pane: columns MEASURED from what is on screen, rows TYPED by the operator.
 *
 * The two halves answer different questions and only one of them can be measured. Columns are a
 * property of the viewport — how many cells fit across the mirror at this font size — so asking the
 * operator for them would be asking them to count pixels. Rows are a choice: how much of the
 * terminal they want to see at once, against a keyboard that takes half the screen. `rows === null`
 * is that choice not made, and the pane keeps whatever height it has.
 */
export async function runManualPaneFit(
  scrollport: HTMLElement | null,
  fontSize: number,
  rows: number | null,
  request: (cols: number, rows: number | null) => Promise<ManualPaneFitRequestResult>,
): Promise<ManualPaneFitAttempt> {
  if (scrollport === null) return { ok: false, reason: "geometry" };
  let cols: number;
  try {
    cols = measureManualPaneFitColumns(scrollport, fontSize);
  } catch {
    return { ok: false, reason: "geometry" };
  }
  try {
    const result = await request(cols, rows !== null && validManualPaneFitRows(rows) ? rows : null);
    if (
      result.ok &&
      validResultDimension(result.cols) &&
      validResultDimension(result.rows)
    ) {
      return { ok: true, cols: result.cols, rows: result.rows };
    }
    return {
      ok: false,
      reason:
        result.reason === "unsupported" ||
        result.reason === "geometry" ||
        result.reason === "conflict"
          ? result.reason
          : "failed",
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

function cssPixels(value: string): number {
  if (value.trim() === "") throw new Error("invalid terminal geometry");
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("invalid terminal geometry");
  return parsed;
}

function validResultDimension(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}
