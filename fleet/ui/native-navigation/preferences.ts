export type SidebarSide = "left" | "right";
export type NavigationOverlay = "hierarchy" | "agents" | null;

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
  collapsed: boolean;
}

export interface NativeNavigationPreferences {
  version: 1;
  left: SidebarPreference;
  right: SidebarPreference;
  disclosedSpaces: readonly string[];
  disclosedTabs: readonly string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface NativeNavigationPreferenceStore {
  snapshot(): NativeNavigationPreferences;
  subscribe(listener: () => void): () => void;
  setWidth(side: SidebarSide, width: number): void;
  toggleCollapsed(side: SidebarSide): void;
  toggleDisclosure(kind: "space" | "tab", id: string): void;
  ensureDisclosed(spaceId: string, tabId: string): void;
}

export interface OverlayCloseResult {
  next: null;
  restore: Exclude<NavigationOverlay, null> | null;
}

function defaultPreferences(): NativeNavigationPreferences {
  return {
    version: 1,
    left: { preferredWidth: SIDEBAR_BOUNDS.left.default, collapsed: false },
    right: { preferredWidth: SIDEBAR_BOUNDS.right.default, collapsed: false },
    disclosedSpaces: [],
    disclosedTabs: [],
  };
}

export function clampSidebarWidth(side: SidebarSide, width: number): number {
  const bounds = SIDEBAR_BOUNDS[side];
  if (!Number.isFinite(width)) return bounds.default;
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(width)));
}

function parseSidebar(value: JsonValue | undefined, side: SidebarSide): SidebarPreference | null {
  const record = jsonRecord(value);
  if (
    record === null ||
    Object.keys(record).some((key) => key !== "preferredWidth" && key !== "collapsed")
  ) return null;
  const preferredWidth = jsonNumberField(record.preferredWidth);
  const collapsed =
    record.collapsed === true ? true : record.collapsed === false ? false : null;
  if (preferredWidth === null || collapsed === null) return null;
  return {
    preferredWidth: clampSidebarWidth(side, preferredWidth),
    collapsed,
  };
}

function parseDisclosureList(value: JsonValue | undefined): readonly string[] | null {
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
        key !== "disclosedSpaces" &&
        key !== "disclosedTabs",
    ) ||
    value.version !== 1
  ) return defaultPreferences();
  const left = parseSidebar(value.left, "left");
  const right = parseSidebar(value.right, "right");
  const disclosedSpaces = parseDisclosureList(value.disclosedSpaces);
  const disclosedTabs = parseDisclosureList(value.disclosedTabs);
  if (left && right && disclosedSpaces && disclosedTabs) {
    return { version: 1, left, right, disclosedSpaces, disclosedTabs };
  }
  return defaultPreferences();
}

function boundedAppend(values: readonly string[], id: string): readonly string[] {
  if (id.length === 0 || id.length > NATIVE_NAVIGATION_MAX_ID_LENGTH) return values;
  if (values.includes(id)) return values;
  return [...values.slice(-(NATIVE_NAVIGATION_MAX_DISCLOSURES - 1)), id];
}

function toggle(values: readonly string[], id: string): readonly string[] {
  if (id.length === 0 || id.length > NATIVE_NAVIGATION_MAX_ID_LENGTH) return values;
  return values.includes(id) ? values.filter((value) => value !== id) : boundedAppend(values, id);
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
    this.commit({ ...this.value, [side]: { ...this.value[side], preferredWidth } });
  }

  toggleCollapsed(side: SidebarSide): void {
    this.commit({
      ...this.value,
      [side]: { ...this.value[side], collapsed: !this.value[side].collapsed },
    });
  }

  toggleDisclosure(kind: "space" | "tab", id: string): void {
    const field = kind === "space" ? "disclosedSpaces" : "disclosedTabs";
    const next = toggle(this.value[field], id);
    if (next === this.value[field]) return;
    this.commit({ ...this.value, [field]: next });
  }

  ensureDisclosed(spaceId: string, tabId: string): void {
    const disclosedSpaces = boundedAppend(this.value.disclosedSpaces, spaceId);
    const disclosedTabs = boundedAppend(this.value.disclosedTabs, tabId);
    if (
      disclosedSpaces === this.value.disclosedSpaces &&
      disclosedTabs === this.value.disclosedTabs
    ) {
      return;
    }
    this.commit({ ...this.value, disclosedSpaces, disclosedTabs });
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

export function nextOverlay(
  current: NavigationOverlay,
  requested: Exclude<NavigationOverlay, null>,
): NavigationOverlay {
  return current === requested ? null : requested;
}

export function closeOverlay(current: NavigationOverlay): OverlayCloseResult {
  return { next: null, restore: current };
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const nativeNavigationPreferences = new NavigationPreferenceStore(browserStorage());
import type { JsonValue } from "../../../bridge/json.ts";
import {
  jsonNumberField,
  jsonRecord,
  jsonStringField,
} from "../../../bridge/stt/json.ts";
