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
 * One entry today. The value that reaches `--font-cjk` and the URL that reaches a `<link>` both come
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
    family: "Maple Mono NF CN",
    href: "https://fontsapi.zeoseven.com/442/main/result.css",
    label: "Maple Mono NF CN",
  },
];

/** The picker's "no fallback" value. Not an id, so it can never collide with one. */
export const CJK_FALLBACK_NONE = "none";

/** What a device gets before it says otherwise. */
export const DEFAULT_CJK_FALLBACK = "maple-mono-cn";

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

/** Total over any string: a known id, or `none`. Anything else is not a choice this app offers. */
export function isCjkFallback(value: string): boolean {
  return value === CJK_FALLBACK_NONE || fleetWebfont(value) !== null;
}

export function parseCjkFallback(raw: string | null): string {
  if (raw === null || new TextEncoder().encode(raw).byteLength > CJK_FALLBACK_MAX_BYTES) {
    return DEFAULT_CJK_FALLBACK;
  }
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns the JsonValue representation; the reader below validates the one
    // field against the closed catalog before it can become a family name or a URL.
    parsed = JSON.parse(raw) as JsonValue;
  } catch {
    return DEFAULT_CJK_FALLBACK;
  }
  const record = jsonRecord(parsed);
  if (record === null || Object.keys(record).some((key) => key !== "version" && key !== "font")) {
    return DEFAULT_CJK_FALLBACK;
  }
  if (record.version !== 1) return DEFAULT_CJK_FALLBACK;
  const font = jsonStringField(record.font);
  return font !== null && isCjkFallback(font) ? font : DEFAULT_CJK_FALLBACK;
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

  constructor(storage: CjkFallbackStorage | null = null) {
    this.storage = storage;
    let raw: string | null = null;
    try {
      raw = storage?.getItem(CJK_FALLBACK_STORAGE_KEY) ?? null;
    } catch {
      raw = null;
    }
    this.value = parseCjkFallback(raw);
  }

  snapshot = (): string => this.value;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(font: string): void {
    if (!isCjkFallback(font) || font === this.value) return;
    this.value = font;
    try {
      this.storage?.setItem(CJK_FALLBACK_STORAGE_KEY, JSON.stringify({ version: 1, font }));
    } catch {
      // The in-memory choice remains authoritative for this page; a private-mode browser keeps the
      // face it picked until it is closed, which is better than refusing to change it at all.
    }
    for (const listener of this.listeners) listener();
  }
}

function browserStorage(): CjkFallbackStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const fleetCjkFallback = new FleetCjkFallbackStore(browserStorage());
