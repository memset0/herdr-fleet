import type { JsonValue } from "../../../bridge/json.ts";
import {
  jsonNumberField,
  jsonRecord,
  jsonStringField,
} from "../../../bridge/stt/json.ts";

export type SidebarSide = "left" | "right";

export const NATIVE_NAVIGATION_STORAGE_KEY = "herdr-fleet:native-navigation:v1";
export const NATIVE_NAVIGATION_MAX_BYTES = 16_384;
export const NATIVE_NAVIGATION_MAX_DISCLOSURES = 256;
export const NATIVE_NAVIGATION_MAX_ID_LENGTH = 256;
export const SIDEBAR_KEYBOARD_STEP = 16;

export const SIDEBAR_BOUNDS = {
  left: { min: 220, max: 420, default: 280 },
  right: { min: 260, max: 460, default: 320 },
} as const;

interface SidebarPreference {
  preferredWidth: number;
}

export interface NativeNavigationPreferences {
  version: 1;
  left: SidebarPreference;
  right: SidebarPreference;
  /**
   * One bounded list for every disclosed row, whatever level it sits at. It is one list and not one
   * per level because elision moves a row between levels: the same Space is a parent today and the
   * grandparent of the same Pane tomorrow, and a per-level list would strand its identity when it
   * moved.
   */
  disclosed: readonly string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface NativeNavigationPreferenceStore {
  snapshot(): NativeNavigationPreferences;
  subscribe(listener: () => void): () => void;
  setWidth(side: SidebarSide, width: number): void;
  toggleDisclosure(id: string): void;
  ensureDisclosed(ids: readonly string[]): void;
}

function defaultPreferences(): NativeNavigationPreferences {
  return {
    version: 1,
    left: { preferredWidth: SIDEBAR_BOUNDS.left.default },
    right: { preferredWidth: SIDEBAR_BOUNDS.right.default },
    disclosed: [],
  };
}

export function clampSidebarWidth(side: SidebarSide, width: number): number {
  const bounds = SIDEBAR_BOUNDS[side];
  if (!Number.isFinite(width)) return bounds.default;
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(width)));
}

/**
 * `collapsed` is READ AND DISCARDED, never rejected.
 *
 * The rails are permanently expanded now, so the field is gone from the shape above — but a browser
 * that used the previous shell still has it in storage, and the strict unknown-key check would
 * throw that whole record away, taking the operator's two rail widths and every disclosure with it
 * for the sake of a boolean nothing reads. Tolerating the key is the entire migration.
 */
function parseSidebar(value: JsonValue | undefined, side: SidebarSide): SidebarPreference | null {
  const record = jsonRecord(value);
  if (
    record === null ||
    Object.keys(record).some((key) => key !== "preferredWidth" && key !== "collapsed")
  ) return null;
  const preferredWidth = jsonNumberField(record.preferredWidth);
  if (preferredWidth === null) return null;
  return { preferredWidth: clampSidebarWidth(side, preferredWidth) };
}

function parseDisclosureList(value: JsonValue | undefined): readonly string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > NATIVE_NAVIGATION_MAX_DISCLOSURES) return null;
  const seen = new Set<string>();
  for (const item of value) {
    const field = jsonStringField(item);
    if (
      field === null ||
      field.length === 0 ||
      field.length > NATIVE_NAVIGATION_MAX_ID_LENGTH ||
      seen.has(field)
    ) {
      return null;
    }
    seen.add(field);
  }
  return [...seen];
}

function mergeDisclosures(...lists: readonly (readonly string[])[]): readonly string[] {
  const seen = new Set<string>();
  for (const list of lists) for (const id of list) seen.add(id);
  return [...seen].slice(0, NATIVE_NAVIGATION_MAX_DISCLOSURES);
}

export function parseNativeNavigationPreferences(raw: string | null): NativeNavigationPreferences {
  if (
    raw === null ||
    new TextEncoder().encode(raw).byteLength > NATIVE_NAVIGATION_MAX_BYTES
  ) return defaultPreferences();
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns the JsonValue representation; domain readers below validate every
    // field before it enters navigation preferences.
    parsed = JSON.parse(raw) as JsonValue;
  } catch {
    return defaultPreferences();
  }
  const value = jsonRecord(parsed);
  if (
    value === null ||
    Object.keys(value).some(
      (key) =>
        key !== "version" &&
        key !== "left" &&
        key !== "right" &&
        key !== "disclosed" &&
        // The previous shell's two per-level lists, read once and merged; never written back.
        key !== "disclosedSpaces" &&
        key !== "disclosedTabs",
    ) ||
    value.version !== 1
  ) return defaultPreferences();
  const left = parseSidebar(value.left, "left");
  const right = parseSidebar(value.right, "right");
  const disclosed = parseDisclosureList(value.disclosed);
  const legacySpaces = parseDisclosureList(value.disclosedSpaces);
  const legacyTabs = parseDisclosureList(value.disclosedTabs);
  if (left && right && disclosed && legacySpaces && legacyTabs) {
    return {
      version: 1,
      left,
      right,
      disclosed: mergeDisclosures(disclosed, legacySpaces, legacyTabs),
    };
  }
  return defaultPreferences();
}

function boundedAppend(values: readonly string[], id: string): readonly string[] {
  if (id.length === 0 || id.length > NATIVE_NAVIGATION_MAX_ID_LENGTH) return values;
  if (values.includes(id)) return values;
  return [...values.slice(-(NATIVE_NAVIGATION_MAX_DISCLOSURES - 1)), id];
}

export class NavigationPreferenceStore implements NativeNavigationPreferenceStore {
  private value: NativeNavigationPreferences;
  private readonly listeners = new Set<() => void>();
  private readonly storage: StorageLike | null;

  constructor(storage: StorageLike | null = null) {
    this.storage = storage;
    let raw: string | null = null;
    try {
      raw = storage?.getItem(NATIVE_NAVIGATION_STORAGE_KEY) ?? null;
    } catch {
      raw = null;
    }
    this.value = parseNativeNavigationPreferences(raw);
  }

  snapshot = (): NativeNavigationPreferences => this.value;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setWidth(side: SidebarSide, width: number): void {
    const preferredWidth = clampSidebarWidth(side, width);
    if (this.value[side].preferredWidth === preferredWidth) return;
    this.commit({ ...this.value, [side]: { preferredWidth } });
  }

  toggleDisclosure(id: string): void {
    if (id.length === 0 || id.length > NATIVE_NAVIGATION_MAX_ID_LENGTH) return;
    const next = this.value.disclosed.includes(id)
      ? this.value.disclosed.filter((value) => value !== id)
      : boundedAppend(this.value.disclosed, id);
    if (next === this.value.disclosed) return;
    this.commit({ ...this.value, disclosed: next });
  }

  ensureDisclosed(ids: readonly string[]): void {
    let disclosed = this.value.disclosed;
    for (const id of ids) disclosed = boundedAppend(disclosed, id);
    if (disclosed === this.value.disclosed) return;
    this.commit({ ...this.value, disclosed });
  }

  private commit(value: NativeNavigationPreferences): void {
    this.value = value;
    try {
      this.storage?.setItem(NATIVE_NAVIGATION_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // The bounded in-memory preference remains authoritative for this page.
    }
    for (const listener of this.listeners) listener();
  }
}

export function widthFromSeparatorKey(
  side: SidebarSide,
  current: number,
  key: string,
): number | null {
  const bounds = SIDEBAR_BOUNDS[side];
  if (key === "Home") return bounds.min;
  if (key === "End") return bounds.max;
  if (key === "ArrowLeft") {
    const delta = side === "right" ? SIDEBAR_KEYBOARD_STEP : -SIDEBAR_KEYBOARD_STEP;
    return clampSidebarWidth(side, current + delta);
  }
  if (key === "ArrowRight") {
    const delta = side === "right" ? -SIDEBAR_KEYBOARD_STEP : SIDEBAR_KEYBOARD_STEP;
    return clampSidebarWidth(side, current + delta);
  }
  return null;
}

export function widthFromPointerDrag(
  side: SidebarSide,
  startWidth: number,
  startX: number,
  currentX: number,
): number {
  const delta = currentX - startX;
  return clampSidebarWidth(side, startWidth + (side === "left" ? delta : -delta));
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const nativeNavigationPreferences = new NavigationPreferenceStore(browserStorage());
