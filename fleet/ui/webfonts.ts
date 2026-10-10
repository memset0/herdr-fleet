import type { JsonValue } from "../../bridge/json.ts";
import { jsonRecord, jsonStringField } from "../../bridge/stt/json.ts";

/**
 * A face Fleet can put UNDER the operator's chosen font, fetched from a provider rather than shipped.
 *
 * WHY A FALLBACK AT ALL. A monospace face chosen for code is chosen on its Latin shapes, and almost
 * none of them draw CJK. The browser then falls through to whatever the system has, which on a phone
 * is a proportional face at a width that is not twice the Latin advance — so a terminal mirror that
 * is monospaced in English stops being monospaced the moment a line has Chinese in it. Naming one
 * face for those codepoints, after the operator's own and before the system's, fixes the grid
 * without touching their choice.
 *
 * WHY NOT SHIP IT. A full CJK face is tens of megabytes; putting one in the install would be paid by
 * every device on every update, for glyphs most installs never paint. The provider below splits its
 * faces into ~200 `unicode-range` chunks, so a browser fetches only the ranges a page actually draws
 * and caches each one — and a device that renders no CJK downloads nothing but the stylesheet.
 *
 * WHY IT MAY SIMPLY BE ABSENT. The provider is a third party. If it is unreachable the `@font-face`
 * rules never arrive, the family name resolves to nothing, and every stack falls through to the
 * system exactly as it did before — the degradation is the pre-existing behavior, which is why a
 * brief outage is not an incident here.
 */
export interface FleetWebfont {
  /** Stored value and select key. Kebab-case, stable across releases. */
  id: string;
  /** A monospace face eligible for terminal CJK fallback. */
  monospace: boolean;
  /** The exact family name the provider's stylesheet declares. */
  family: string;
  /** The provider stylesheet, which declares that family in `unicode-range` chunks. */
  href: string;
  /** Shown in the picker. A face is a proper noun, so this is not translated. */
  label: string;
}

/**
 * The catalog, and it is CLOSED.
 *
 * Monospace fallback and proportional UI entries. The value that reaches `--font-cjk` and the URL that reaches a `<link>` both come
 * from here and never from stored text, so a hand-edited preference can name a face this list does
 * not have and get the default instead of a family name or an origin of its own choosing.
 *
 * Maple Mono NF CN already contains Maple Mono's Latin, which is why the same entry serves as the
 * Latin face in the two pickers as well: choosing "Maple Mono" and choosing this fallback resolve to
 * one family and one download.
 */
export const FLEET_WEBFONTS: readonly FleetWebfont[] = [
  {
    id: "maple-mono-cn",
    monospace: true,
    family: "Maple Mono NF CN",
    href: "https://fontsapi.zeoseven.com/442/main/result.css",
    label: "Maple Mono NF CN",
  },
  {
    id: "source-han-sans", monospace: false,
    family: "Noto Sans CJK",
    href: "https://fontsapi.zeoseven.com/69/main/result.css",
    label: "Source Han Sans",
  },
  {
    id: "lxgw-wenkai", monospace: false,
    family: "LXGW WenKai",
    href: "https://fontsapi.zeoseven.com/292/main/result.css",
    label: "LXGW WenKai",
  },
];

/** The picker's "no fallback" value. Not an id, so it can never collide with one. */
export const CJK_FALLBACK_NONE = "none";

/** What a device gets before it says otherwise. */
export const DEFAULT_CJK_FALLBACK = CJK_FALLBACK_NONE;
export const UI_CJK_FALLBACK_STORAGE_KEY = "herdr-fleet:ui-cjk-fallback:v1";
export type CjkRole = "ui" | "terminal";

export const CJK_FALLBACK_STORAGE_KEY = "herdr-fleet:cjk-fallback:v1";
export const CJK_FALLBACK_MAX_BYTES = 512;

/**
 * The family name a stack falls through to when no fallback is chosen.
 *
 * A name nothing will ever match, so the browser skips it and lands on the generic tail exactly as
 * it did before this existed. It is spelled rather than left empty because a stack cannot hold an
 * empty entry — `var(--font-cjk)` resolving to nothing would put two commas side by side and
 * invalidate the whole declaration.
 */
export const CJK_FALLBACK_UNSET_FAMILY = "Herdr Fleet CJK Unset";

export function fleetWebfont(id: string): FleetWebfont | null {
  return FLEET_WEBFONTS.find((font) => font.id === id) ?? null;
}

/** Catalog membership is checked for the role before a value reaches CSS. */
export function isCjkFallback(value: string, role: CjkRole = "terminal"): boolean {
  return value === CJK_FALLBACK_NONE || (fleetWebfont(value) !== null && (role === "ui" || fleetWebfont(value)?.monospace === true));
}

function readRecord(raw: string | null): ReturnType<typeof jsonRecord> {
  if (raw === null || new TextEncoder().encode(raw).byteLength > CJK_FALLBACK_MAX_BYTES) return null;
  try {
    // SAFETY: the JSON reader validates its shape before values enter the closed font catalog.
    return jsonRecord(JSON.parse(raw) as JsonValue);
  } catch { return null; }
}

interface CjkPreference { font: string; only: boolean }
function readPreference(raw: string | null, role: CjkRole): CjkPreference {
  const record = readRecord(raw);
  const font = record === null ? null : jsonStringField(record.font);
  if (!record || record.version !== 1 || Object.keys(record).some(key => !["version", "font", "only"].includes(key)) || (record.only !== undefined && record.only !== true && record.only !== false) || font === null || !isCjkFallback(font, role)) {
    return { font: DEFAULT_CJK_FALLBACK, only: false };
  }
  return { font, only: record.only === true };
}
export function parseCjkFallback(raw: string | null, role: CjkRole = "terminal"): string {
  return readPreference(raw, role).font;
}

export function exclusiveCjkStack(font: FleetWebfont, role: CjkRole): string {
  return role === "terminal"
    ? `"Nerd Font Symbols", "${font.family}", ui-monospace, monospace`
    : `"${font.family}", ui-sans-serif, system-ui, sans-serif`;
}

export interface CjkFallbackStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CjkFallbackStore {
  snapshot(): string;
  subscribe(listener: () => void): () => void;
  set(font: string): void;
}

export class FleetCjkFallbackStore implements CjkFallbackStore {
  private value: string;
  private readonly listeners = new Set<() => void>();
  private readonly storage: CjkFallbackStorage | null;

  private exclusive = false;
  private readonly role: CjkRole;
  private readonly key: string;

  constructor(storage: CjkFallbackStorage | null = null, role: CjkRole = "terminal") {
    this.storage = storage;
    this.role = role;
    this.key = role === "ui" ? UI_CJK_FALLBACK_STORAGE_KEY : CJK_FALLBACK_STORAGE_KEY;
    let selected = { font: DEFAULT_CJK_FALLBACK, only: false };
    try {
      const raw = storage?.getItem(this.key) ?? null;
      selected = readPreference(raw, role);
      const nativeKey = role === "ui" ? "collie:design:v1" : "collie:display-prefs:v4";
      const native = readRecord(storage?.getItem(nativeKey) ?? null);
      const old = native && jsonStringField(role === "ui" ? native.font : native.fontFamily);
      const migrated = old === "maple" ? "maple-mono-cn" : role === "ui" && (old === "source-han-sans" || old === "lxgw-wenkai") ? old : null;
      if (migrated !== null && native) {
        selected = { font: migrated, only: true };
        storage?.setItem(this.key, JSON.stringify({ version: 1, ...selected }));
        storage?.setItem(nativeKey, JSON.stringify({ ...native, [role === "ui" ? "font" : "fontFamily"]: role === "ui" ? "aldrich" : "system" }));
      } else if (role === "ui" && raw === null) {
        // An explicitly saved shared fallback is adopted once; absent data means None.
        selected = readPreference(storage?.getItem(CJK_FALLBACK_STORAGE_KEY) ?? null, role);
        storage?.setItem(this.key, JSON.stringify({ version: 1, ...selected }));
      }
    } catch { /* Keep the last validated in-memory choice. */ }
    this.value = selected.font;
    this.exclusive = selected.only;
  }

  snapshot = (): string => this.value;
  only = (): boolean => this.exclusive;

  setOnly(value: boolean): void {
    if (value === this.exclusive) return;
    this.exclusive = value;
    this.persist();
  }

  private persist(): void {
    try { this.storage?.setItem(this.key, JSON.stringify({ version: 1, font: this.value, only: this.exclusive })); } catch { /* Browser-local memory remains usable. */ }
    for (const listener of this.listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(font: string): void {
    if (!isCjkFallback(font, this.role) || font === this.value) return;
    this.value = font;
    this.persist();
  }
}

function browserStorage(): CjkFallbackStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const fleetUiCjkFallback = new FleetCjkFallbackStore(browserStorage(), "ui");
export const fleetCjkFallback = new FleetCjkFallbackStore(browserStorage());
